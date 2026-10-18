import { describe, expect, it, vi } from 'vitest'
import { createSessionStore } from './sessionStore.js'

const join = (key, t) => ({ type: 'join', participantKey: key, studentId: null, t, tEnd: null, text: null, occurredAt: null })
const on = (key, t) => ({ type: 'speech_on', participantKey: key, studentId: null, t, tEnd: null, text: null, occurredAt: null })
const say = (key, t, tEnd, text) => ({ type: 'transcript', participantKey: key, studentId: null, t, tEnd, text, occurredAt: null })

/**
 * Doble de Firestore SIN consultas de coleccion ni lecturas fuera de transaccion: si el codigo
 * intentara releer la ventana de liveEvents, estos tests fallarian. Simula reintentos por
 * conflicto (abortFirst) y create() sobre un documento existente.
 */
function fakeFirestore({ docs = {}, abortFirst = 0, createExists = false } = {}) {
  const committed = []
  const readPaths = []
  const created = []
  const updates = []
  const db = {
    doc: (path) => ({
      path,
      create: vi.fn(async (data) => {
        if (createExists) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 })
        created.push({ path, data })
      }),
    }),
    runTransaction: async (fn) => {
      for (let attempt = 0; ; attempt += 1) {
        const pending = []
        const tx = {
          get: async (ref) => {
            readPaths.push(ref.path)
            return { exists: ref.path in docs, data: () => structuredClone(docs[ref.path]) }
          },
          set: (ref, data) => pending.push({ path: ref.path, data }),
          update: (ref, data) => pending.push({ path: ref.path, update: data }),
        }
        const result = await fn(tx)
        if (attempt < abortFirst) continue // conflicto: se descartan las escrituras y se reintenta
        updates.push(...pending.filter((w) => w.update))
        const writes = pending.filter((w) => !w.update)
        committed.push(...writes)
        for (const { path, data } of writes) docs[path] = structuredClone(data)
        return result
      }
    },
  }
  return { firebase: { db, FieldValue: { serverTimestamp: () => 'SERVER_TS' } }, committed, readPaths, created, docs, updates }
}

const STATE = 'learningSessions/s1/live/state'
const VIEW = 'learningSessions/s1/live/view'
const SESSION = 'learningSessions/s1'

describe('processLiveEvent: Firestore cost per event', () => {
  it('costs 2 reads (state + session, because it is the first evaluation) and 3 writes on the first event (state, view, raw join)', async () => {
    const { firebase, committed, readPaths } = fakeFirestore()
    const result = await createSessionStore(firebase).processLiveEvent('s1', 'evt-1', join('a', 0))

    expect(result.ops).toEqual({ reads: 2, writes: 3, attempts: 1 })
    expect(result.evaluated).toBe(true)
    expect(readPaths).toEqual([STATE, SESSION])
    expect(committed.map((w) => w.path)).toEqual([STATE, VIEW, 'learningSessions/s1/liveEvents/evt-1'])
    expect(committed[2].data).toMatchObject({ type: 'join', receivedAt: 'SERVER_TS' })
    expect(committed[0].data).toMatchObject({ v: 1, lastT: 0, lastEvalT: 0, presence: [{ k: 'a', s: 0 }] })
  })

  it('costs exactly 1 read and 1 write for a speech event between evaluations: it only updates the state', async () => {
    const { firebase, readPaths, committed } = fakeFirestore()
    const store = createSessionStore(firebase)
    await store.processLiveEvent('s1', 'evt-1', join('a', 0))
    readPaths.length = 0
    committed.length = 0

    const result = await store.processLiveEvent('s1', 'evt-2', on('a', 1))

    expect(result.ops).toEqual({ reads: 1, writes: 1, attempts: 1 })
    expect(result.evaluated).toBe(false)
    expect(readPaths).toEqual([STATE])
    expect(committed.map((w) => w.path)).toEqual([STATE])
  })

  it('never stores raw speech_on / speech_off in liveEvents, but does store transcript, join and leave', async () => {
    const { firebase, committed } = fakeFirestore()
    const store = createSessionStore(firebase)
    const leave = { type: 'leave', participantKey: 'a', studentId: null, t: 9, tEnd: null, text: null, occurredAt: null }
    const off = { type: 'speech_off', participantKey: 'a', studentId: null, t: 8, tEnd: null, text: null, occurredAt: null }

    for (const [id, event] of [['e-join', join('a', 0)], ['e-on', on('a', 1)], ['e-say', say('a', 2, 3, 'hola')], ['e-off', off], ['e-leave', leave]]) {
      await store.processLiveEvent('s1', id, event)
    }

    const raw = committed.filter((w) => w.path.includes('/liveEvents/')).map((w) => w.data.type)
    expect(raw).toEqual(['join', 'transcript', 'leave'])
    expect(committed.filter((w) => w.path === STATE)).toHaveLength(5) // el estado si se actualiza con los 5
  })

  it('evaluates again once 5 s of session time have passed, and only then reads the session', async () => {
    const { firebase, readPaths } = fakeFirestore()
    const store = createSessionStore(firebase)
    await store.processLiveEvent('s1', 'evt-1', join('a', 0))
    await store.processLiveEvent('s1', 'evt-2', on('a', 4.9))
    readPaths.length = 0

    const result = await store.processLiveEvent('s1', 'evt-3', on('b', 5))

    expect(result.ops).toEqual({ reads: 2, writes: 2, attempts: 1 }) // el estado y la vista; el habla no se guarda cruda
    expect(readPaths).toEqual([STATE, SESSION])
  })

  it('writes the state only when the event changed it (a repeated transcript costs 1 write)', async () => {
    const { firebase } = fakeFirestore()
    const store = createSessionStore(firebase)
    await store.processLiveEvent('s1', 'evt-1', join('a', 0))
    await store.processLiveEvent('s1', 'evt-t', say('a', 1, 2, 'hola'))

    const repeated = await store.processLiveEvent('s1', 'evt-t', say('a', 1, 2, 'hola'))

    expect(repeated.ops).toEqual({ reads: 1, writes: 1, attempts: 1 })
  })

  it('counts the reads of every attempt but only the writes that were committed', async () => {
    const { firebase, committed } = fakeFirestore({ abortFirst: 2 })
    const result = await createSessionStore(firebase).processLiveEvent('s1', 'evt-1', join('a', 0))

    expect(result.ops).toEqual({ reads: 6, writes: 3, attempts: 3 })
    expect(committed).toHaveLength(3)
  })

  it('stays flat as the session grows: 200 speech events cost about 1 read and 1 write each', async () => {
    const { firebase } = fakeFirestore()
    const store = createSessionStore(firebase)
    let reads = 0
    let writes = 0
    for (let i = 0; i < 200; i += 1) {
      const result = await store.processLiveEvent('s1', `evt-${i}`, i % 2 ? on('b', i * 0.4) : on('a', i * 0.4))
      reads += result.ops.reads
      writes += result.ops.writes
    }
    // 200 eventos en ~80 s de sesion -> ~16 evaluaciones (una lectura extra de la sesion cada una)
    expect(reads).toBeLessThanOrEqual(200 + 20)
    // el estado en cada evento + la vista en cada evaluacion (~16): el habla no se guarda cruda
    expect(writes).toBeGreaterThanOrEqual(200)
    expect(writes).toBeLessThanOrEqual(200 + 20)
  })
})

describe('processLiveEvent: the view for the screen', () => {
  it('writes live/view only when it evaluates, with the speech share already computed', async () => {
    const { firebase, committed } = fakeFirestore()
    const store = createSessionStore(firebase)

    await store.processLiveEvent('s1', 'e1', join('a', 0)) // evalua: escribe la vista
    await store.processLiveEvent('s1', 'e2', join('b', 0)) // no evalua
    await store.processLiveEvent('s1', 'e3', on('a', 1)) // no evalua
    await store.processLiveEvent('s1', 'e4', say('a', 2, 4, 'hola a todos')) // no evalua
    expect(committed.filter((w) => w.path === VIEW)).toHaveLength(1)

    await store.processLiveEvent('s1', 'e5', on('b', 10)) // evalua: nueva vista
    const views = committed.filter((w) => w.path === VIEW)
    expect(views).toHaveLength(2)

    const view = views.at(-1).data
    expect(view.participants).toEqual([
      expect.objectContaining({ key: 'a', name: 'A', sharePct: 100 }),
      expect.objectContaining({ key: 'b', name: 'B', sharePct: 0, speaking: true }),
    ])
    expect(view.transcripts).toEqual([{ key: 'a', name: 'A', text: 'hola a todos', t: 4 }])
  })

  it('never puts the expected answer in the view even when a problem is active', async () => {
    const session = { currentProblem: { id: 'p-03', text: '6 x 8', expectedAnswer: 48, skillId: 'm' } }
    const { firebase, committed } = fakeFirestore({ docs: { [SESSION]: session } })
    const store = createSessionStore(firebase)
    await store.processLiveEvent('s1', 'e1', join('a', 0))
    await store.processLiveEvent('s1', 'e2', say('a', 6, 8, 'son cuarenta y ocho'))
    const stored = committed.filter((w) => w.path === VIEW || w.path === STATE).map((w) => JSON.stringify(w.data)).join(' ')
    expect(stored).not.toContain('expectedAnswer')
  })
})

describe('processLiveEvent: decisions', () => {
  it('reads the current problem from the session only when evaluating, and returns the context for the tutor', async () => {
    const session = { currentProblem: { id: 'p-03', text: '¿Cuánto es 6 x 8?', expectedAnswer: 48, skillId: 'multiplication' } }
    const state = {
      v: 1, lastT: 8, lastEvalT: 0, lastSpeechT: 8, speaker: null,
      presence: [{ k: 'a', s: 0 }, { k: 'b', s: 0 }], intervals: [], students: [], interventions: [],
      transcripts: [{ k: 'b', t: 3, e: 4, x: 'hola' }], problem: { id: 'p-03', startedT: 0 },
    }
    const { firebase } = fakeFirestore({ docs: { [SESSION]: session, [STATE]: state } })

    const result = await createSessionStore(firebase).processLiveEvent('s1', 'evt-9', say('a', 9, 10, 'son cuarenta y ocho'))

    expect(result.intervention).toMatchObject({
      type: 'CORRECT_ANSWER',
      participantKey: 'a',
      evidence: { expectedAnswer: 48, numbers: [48], skillId: 'multiplication', activityId: 'p-03' },
    })
    expect(result.context.problem).toMatchObject({ activityId: 'p-03', text: '¿Cuánto es 6 x 8?' })
    expect(result.context.present).toEqual(['a', 'b'])
    expect(result.context.transcriptTail.at(-1)).toEqual({ k: 'a', x: 'son cuarenta y ocho' })
  })

  it('records the intervention in the stored state so the cooldown holds on later events', async () => {
    const session = { currentProblem: { id: 'p-03', text: '6 x 8', expectedAnswer: 48, skillId: 'm' } }
    const { firebase, docs } = fakeFirestore({ docs: { [SESSION]: session } })
    const store = createSessionStore(firebase)
    await store.processLiveEvent('s1', 'e1', join('a', 0))
    await store.processLiveEvent('s1', 'e2', join('b', 0))
    await store.processLiveEvent('s1', 'e3', say('a', 6, 8, 'son 48'))

    expect(docs[STATE].interventions).toEqual([{ type: 'CORRECT_ANSWER', k: 'a', t: 8 }])

    const later = await store.processLiveEvent('s1', 'e4', say('a', 14, 16, 'son 48'))
    expect(later.intervention).toBeNull() // en cooldown
  })
})

describe('createIntervention', () => {
  it('creates the document with a server timestamp', async () => {
    const { firebase, created } = fakeFirestore()
    const result = await createSessionStore(firebase).createIntervention('s1', 'int-1', { signal: 'SILENT_PEER', message: 'Hola' })

    expect(result).toEqual({ created: true })
    expect(created).toEqual([
      { path: 'learningSessions/s1/agentInterventions/int-1', data: { signal: 'SILENT_PEER', message: 'Hola', createdAt: 'SERVER_TS' } },
    ])
  })

  it('treats ALREADY_EXISTS as "someone already delivered it", not as an error', async () => {
    const { firebase } = fakeFirestore({ createExists: true })
    await expect(createSessionStore(firebase).createIntervention('s1', 'int-1', {})).resolves.toEqual({ created: false })
  })

  it('propagates any other failure', async () => {
    const { firebase } = fakeFirestore()
    firebase.db.doc = () => ({ create: async () => Promise.reject(Object.assign(new Error('unavailable'), { code: 14 })) })
    await expect(createSessionStore(firebase).createIntervention('s1', 'int-1', {})).rejects.toThrow('unavailable')
  })
})

describe('processLiveEvent: the expected answer lives in private/answer', () => {
  const PRIVATE = 'learningSessions/s1/private/answer'
  const publicSession = { currentProblem: { activityId: 'p-01', skillId: 'multiplication', text: '6 cajas con 8 lápices' } }

  it('reads private/answer once, caches it in live/state and never rereads it on later evaluations', async () => {
    const { firebase, committed, readPaths } = fakeFirestore({ docs: { [SESSION]: publicSession, [PRIVATE]: { expectedAnswer: 48 } } })
    const store = createSessionStore(firebase)

    const first = await store.processLiveEvent('s1', 'e1', join('a', 0))
    expect(readPaths).toEqual([STATE, SESSION, PRIVATE])
    expect(first.ops.reads).toBe(3)
    expect(committed.find((w) => w.path === STATE).data.answer).toEqual({ id: 'p-01', v: 48 })

    readPaths.length = 0
    const second = await store.processLiveEvent('s1', 'e2', say('a', 10, 12, 'son cuarenta y ocho')) // evalua otra vez
    expect(second.evaluated).toBe(true)
    expect(readPaths).toEqual([STATE, SESSION]) // sin private/answer
    expect(second.intervention).toMatchObject({ type: 'CORRECT_ANSWER' }) // la respuesta cacheada se usa
  })

  it('rereads it when the activity changes', async () => {
    const { firebase, docs, readPaths } = fakeFirestore({ docs: { [SESSION]: publicSession, [PRIVATE]: { expectedAnswer: 48 } } })
    const store = createSessionStore(firebase)
    await store.processLiveEvent('s1', 'e1', join('a', 0))

    docs[SESSION] = { currentProblem: { ...publicSession.currentProblem, activityId: 'p-02' } }
    docs[PRIVATE] = { expectedAnswer: 7 }
    readPaths.length = 0
    await store.processLiveEvent('s1', 'e2', join('b', 10))
    expect(readPaths).toEqual([STATE, SESSION, PRIVATE])
    expect(docs[STATE].answer).toEqual({ id: 'p-02', v: 7 })
  })

  it('remembers when there is no answer so it does not read private/answer on every evaluation', async () => {
    const { firebase, readPaths } = fakeFirestore({ docs: { [SESSION]: publicSession } })
    const store = createSessionStore(firebase)
    await store.processLiveEvent('s1', 'e1', join('a', 0))
    readPaths.length = 0
    await store.processLiveEvent('s1', 'e2', join('b', 10))
    expect(readPaths).toEqual([STATE, SESSION])
  })

  it('still works for a session that was not migrated (answer inside currentProblem)', async () => {
    const legacy = { currentProblem: { ...publicSession.currentProblem, expectedAnswer: 48 } }
    const { firebase } = fakeFirestore({ docs: { [SESSION]: legacy } })
    const store = createSessionStore(firebase)
    await store.processLiveEvent('s1', 'e1', join('a', 0))
    const result = await store.processLiveEvent('s1', 'e2', say('a', 10, 12, 'son cuarenta y ocho'))
    expect(result.intervention).toMatchObject({ type: 'CORRECT_ANSWER' })
  })

  it('never puts the number in live/view or in a raw liveEvent', async () => {
    const { firebase, committed } = fakeFirestore({ docs: { [SESSION]: publicSession, [PRIVATE]: { expectedAnswer: 48 } } })
    const store = createSessionStore(firebase)
    await store.processLiveEvent('s1', 'e1', join('a', 0))
    await store.processLiveEvent('s1', 'e2', say('b', 10, 12, 'hay seis cajas'))
    const exposed = committed.filter((w) => w.path === VIEW || w.path.includes('/liveEvents/'))
    expect(exposed.length).toBeGreaterThan(0)
    expect(JSON.stringify(exposed.map((w) => w.data))).not.toMatch(/48|expectedAnswer|"answer"/)
  })
})

describe('processLiveEvent: the first event proves the bot is in the call', () => {
  const session = (status) => ({ [SESSION]: { createdBy: 'd', bot: { id: 'bot-1', status, region: 'us-west-2' } } })

  it('moves bot.status from requested to in_call once, in the same transaction that already reads the session (+1 write, +0 reads)', async () => {
    const { firebase, updates } = fakeFirestore({ docs: session('requested') })
    const store = createSessionStore(firebase)
    const first = await store.processLiveEvent('s1', 'evt-1', join('a', 0))

    expect(updates).toEqual([{ path: SESSION, update: { 'bot.status': 'in_call' } }])
    expect(first.ops).toEqual({ reads: 2, writes: 4, attempts: 1 })
  })

  it('does not touch the session again once it is in the call, nor for other states', async () => {
    for (const status of ['in_call', 'done', 'failed', undefined]) {
      const { firebase, updates } = fakeFirestore({ docs: session(status) })
      await createSessionStore(firebase).processLiveEvent('s1', 'evt-1', join('a', 0))
      expect(updates).toEqual([])
    }
  })

  it('a conflict retry does not apply the change twice', async () => {
    const { firebase, updates } = fakeFirestore({ docs: session('requested'), abortFirst: 1 })
    await createSessionStore(firebase).processLiveEvent('s1', 'evt-1', join('a', 0))
    expect(updates).toHaveLength(1)
  })
})

describe('ensureProblem: a room created by the matching algorithm gets its activity', () => {
  const room = (extra = {}) => ({
    createdBy: 'd',
    matchingResultId: 'confirmed-abc',
    groupId: 'confirmed-abc-g1',
    currentProblem: null,
    ...extra,
  })
  const GROUP = 'matchingResults/confirmed-abc/groups/confirmed-abc-g1'

  it('picks the problem from the focus skill of the group, saves the statement in the session and the answer apart', async () => {
    const { firebase, updates, committed } = fakeFirestore({ docs: { [SESSION]: room(), [GROUP]: { focusSkillIds: ['division'] } } })
    const result = await createSessionStore(firebase).ensureProblem('s1')

    expect(result).toEqual({ assigned: true, skillId: 'division' })
    const problem = updates.find((w) => w.path === SESSION).update.currentProblem
    expect(problem).toMatchObject({ skillId: 'division', activityId: 'auto-division', auto: true })
    expect(problem.text).toMatch(/reparten/)
    expect(problem).not.toHaveProperty('expectedAnswer')

    const answer = committed.find((w) => w.path === 'learningSessions/s1/private/answer')
    expect(answer.data).toMatchObject({ activityId: 'auto-division', expectedAnswer: expect.any(Number) })
    expect(JSON.stringify(problem)).not.toContain(String(answer.data.expectedAnswer * 1000))
  })

  it('does not touch a room that already has a problem, and ignores a room that does not exist', async () => {
    const withProblem = fakeFirestore({ docs: { [SESSION]: room({ currentProblem: { activityId: 'p-01', text: 'x' } }) } })
    expect(await createSessionStore(withProblem.firebase).ensureProblem('s1')).toEqual({ assigned: false })
    expect(withProblem.updates).toEqual([])
    expect(withProblem.committed).toEqual([])

    const none = fakeFirestore({ docs: {} })
    expect(await createSessionStore(none.firebase).ensureProblem('s1')).toEqual({ assigned: false })
  })

  it('falls back to multiplication when the group has no focus skill (or the room is not from the matching flow)', async () => {
    const lonely = fakeFirestore({ docs: { [SESSION]: { createdBy: 'd', currentProblem: null } } })
    expect(await createSessionStore(lonely.firebase).ensureProblem('s1')).toEqual({ assigned: true, skillId: 'multiplication' })
  })
})

describe('processLiveEvent: closeNow when the last person leaves a room where people talked', () => {
  const leave = (key, t) => ({ type: 'leave', participantKey: key, studentId: null, t, tEnd: null, text: null, occurredAt: null })

  async function run(events) {
    const { firebase } = fakeFirestore()
    const store = createSessionStore(firebase)
    let last
    for (const [i, event] of events.entries()) last = await store.processLiveEvent('s1', `e${i}`, event)
    return last
  }
  const talk = [join('a', 0), join('b', 0), say('a', 5, 7, 'hay seis cajas con ocho lápices'), say('b', 9, 11, 'entonces es seis por ocho'), say('a', 13, 15, 'sí, eso creo yo también')]

  it('is false while somebody is still in the room, and true when the last human leaves', async () => {
    expect((await run([...talk, leave('a', 30)])).closeNow).toBe(false)
    expect((await run([...talk, leave('a', 30), leave('b', 31)])).closeNow).toBe(true)
  })

  it('is false for a room where nobody talked, and for events that are not a leave', async () => {
    expect((await run([join('a', 0), leave('a', 4)])).closeNow).toBe(false)
    expect((await run(talk)).closeNow).toBe(false)
  })

  it('the tutor leaving does not count as a person leaving', async () => {
    const withBot = [...talk, join('tutor koeduko', 1), leave('a', 30), leave('b', 31)]
    expect((await run(withBot)).closeNow).toBe(true)
    expect((await run([...talk, join('tutor koeduko', 1), leave('tutor koeduko', 40)])).closeNow).toBe(false)
  })
})

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
        }
        const result = await fn(tx)
        if (attempt < abortFirst) continue // conflicto: se descartan las escrituras y se reintenta
        committed.push(...pending)
        for (const { path, data } of pending) docs[path] = structuredClone(data)
        return result
      }
    },
  }
  return { firebase: { db, FieldValue: { serverTimestamp: () => 'SERVER_TS' } }, committed, readPaths, created, docs }
}

const STATE = 'learningSessions/s1/live/state'
const SESSION = 'learningSessions/s1'

describe('processLiveEvent: Firestore cost per event', () => {
  it('costs 2 reads (state + session, because it is the first evaluation) and 2 writes on the first event', async () => {
    const { firebase, committed, readPaths } = fakeFirestore()
    const result = await createSessionStore(firebase).processLiveEvent('s1', 'evt-1', join('a', 0))

    expect(result.ops).toEqual({ reads: 2, writes: 2, attempts: 1 })
    expect(result.evaluated).toBe(true)
    expect(readPaths).toEqual([STATE, SESSION])
    expect(committed.map((w) => w.path)).toEqual([STATE, 'learningSessions/s1/liveEvents/evt-1'])
    expect(committed[1].data).toMatchObject({ type: 'join', receivedAt: 'SERVER_TS' })
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

    expect(result.ops).toEqual({ reads: 2, writes: 1, attempts: 1 })
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

    expect(result.ops).toEqual({ reads: 6, writes: 2, attempts: 3 })
    expect(committed).toHaveLength(2)
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
    expect(writes).toBe(200) // solo el estado: el habla no se guarda cruda
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

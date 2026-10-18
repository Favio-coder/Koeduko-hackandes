import { describe, expect, it, vi } from 'vitest'
import { createTickHandler } from '../http/tickHandler.js'
import { createSessionStore } from './adapters/sessionStore.js'
import { TICK_MAX_IDLE_MS, TICK_MIN_MS, anchorOf, tickPlan } from './core/heartbeat.js'

describe('tickPlan: the session clock keeps running in silence', () => {
  const state = (over = {}) => ({ lastT: 100, anchor: { t: 100, wallMs: 1_000_000 }, ...over })

  it('computes the session time from the anchor of the last real event', () => {
    expect(tickPlan(state(), 1_000_000 + 40_000)).toEqual({ run: true, t: 140 })
    expect(anchorOf({ lastT: 55 }, 7)).toEqual({ t: 55, wallMs: 7 })
  })

  it('never moves the clock backwards, even if another tick already advanced it', () => {
    expect(tickPlan(state({ lastT: 200 }), 1_000_000 + 40_000)).toEqual({ run: true, t: 200 })
  })

  it('does nothing without an anchor (no real event yet)', () => {
    for (const bad of [undefined, null, {}, { t: 'x', wallMs: 1 }]) expect(tickPlan(state({ anchor: bad }), 5)).toEqual({ run: false, reason: 'no-anchor' })
    expect(tickPlan(null, 5)).toEqual({ run: false, reason: 'no-anchor' })
  })

  it('is throttled to one evaluation per TICK_MIN_MS per room, however many screens ping', () => {
    const now = 1_000_000 + 60_000
    expect(tickPlan(state({ lastTickWallMs: now - TICK_MIN_MS + 1 }), now)).toEqual({ run: false, reason: 'throttled' })
    expect(tickPlan(state({ lastTickWallMs: now - TICK_MIN_MS }), now).run).toBe(true)
  })

  it('stops when the last real event is too old (the room is over) or the clock is odd', () => {
    expect(tickPlan(state(), 1_000_000 + TICK_MAX_IDLE_MS + 1)).toEqual({ run: false, reason: 'idle' })
    expect(tickPlan(state(), 1_000_000 - 1)).toEqual({ run: false, reason: 'idle' })
  })
})

/** Doble de Firestore con transacciones (get/set) para probar processTick. */
function fakeFirestore(docs) {
  const written = []
  const db = {
    doc: (path) => ({ path }),
    runTransaction: async (fn) => {
      const pending = []
      const tx = {
        get: async (ref) => ({ exists: ref.path in docs, data: () => structuredClone(docs[ref.path]) }),
        set: (ref, data) => pending.push({ path: ref.path, data }),
      }
      const result = await fn(tx)
      written.push(...pending)
      for (const { path, data } of pending) docs[path] = structuredClone(data)
      return result
    },
  }
  return { firebase: { db, FieldValue: { serverTimestamp: () => 'TS' } }, written, docs }
}

const SESSION = 'learningSessions/s1'
const STATE = 'learningSessions/s1/live/state'
const VIEW = 'learningSessions/s1/live/view'
const say = (k, t, x) => ({ k, t, e: t + 2, x })
const liveState = (over = {}) => ({
  v: 1, lastT: 100, lastEvalT: 100, lastJudgeT: null, lastSpeechT: 102, speaker: null,
  presence: [{ k: 'estudiante a', s: 0 }, { k: 'estudiante b', s: 0 }],
  intervals: [], transcripts: [say('estudiante a', 98, 'ya terminamos de contar las cajas'), say('estudiante b', 100, 'entonces falta sumar los lápices')],
  students: [], interventions: [], problem: null, answer: null, totals: [], anchor: { t: 100, wallMs: 1_000_000 },
  ...over,
})

describe('processTick', () => {
  const room = (status = 'scheduled') => ({ createdBy: 'd', status, currentProblem: null })

  it('evaluates with the clock running and detects the silence of the group (only the heartbeat can)', async () => {
    const { firebase, written } = fakeFirestore({ [SESSION]: room(), [STATE]: liveState() })
    const result = await createSessionStore(firebase).processTick('s1', { nowMs: 1_000_000 + 60_000 })

    expect(result.ticked).toBe(true)
    expect(result.intervention).toMatchObject({ type: 'GROUP_SILENCE' })
    expect(result.context.present).toEqual(['estudiante a', 'estudiante b'])
    expect(result.ops).toMatchObject({ reads: 2, writes: 2 })
    expect(written.map((w) => w.path)).toEqual([STATE, VIEW])
    expect(written[0].data).toMatchObject({ lastT: 160, lastTickWallMs: 1_060_000, anchor: { t: 100, wallMs: 1_000_000 } })
  })

  it('asks the observer to read the conversation when the rules say nothing and enough time passed', async () => {
    const { firebase } = fakeFirestore({ [SESSION]: room(), [STATE]: liveState({ lastSpeechT: 100, speaker: { k: 'estudiante a', s: 150 } }) })
    const result = await createSessionStore(firebase).processTick('s1', { nowMs: 1_000_000 + 30_000 })
    expect(result.ticked).toBe(true)
    expect(result.intervention).toBeNull()
    expect(result.judge).toMatchObject({ t: 130, present: ['estudiante a', 'estudiante b'] })
  })

  it('costs one read and no writes when it is throttled, closed, idle or there is no state', async () => {
    const throttled = fakeFirestore({ [SESSION]: room(), [STATE]: liveState({ lastTickWallMs: 1_000_000 + 55_000 }) })
    const r1 = await createSessionStore(throttled.firebase).processTick('s1', { nowMs: 1_000_000 + 60_000 })
    expect(r1).toMatchObject({ ticked: false, reason: 'throttled', ops: { reads: 1, writes: 0 } })
    expect(throttled.written).toEqual([])

    const closed = fakeFirestore({ [SESSION]: room('completed'), [STATE]: liveState() })
    expect(await createSessionStore(closed.firebase).processTick('s1', { nowMs: 1_000_000 + 60_000 })).toMatchObject({ ticked: false, reason: 'closed' })
    expect(closed.written).toEqual([])

    const idle = fakeFirestore({ [SESSION]: room(), [STATE]: liveState() })
    expect(await createSessionStore(idle.firebase).processTick('s1', { nowMs: 1_000_000 + TICK_MAX_IDLE_MS + 5 })).toMatchObject({ ticked: false, reason: 'idle' })

    const none = fakeFirestore({ [SESSION]: room() })
    expect(await createSessionStore(none.firebase).processTick('s1', { nowMs: 5 })).toMatchObject({ ticked: false, reason: 'no-state' })
  })

  it('never talks to an empty room', async () => {
    const { firebase } = fakeFirestore({ [SESSION]: room(), [STATE]: liveState({ presence: [] }) })
    const result = await createSessionStore(firebase).processTick('s1', { nowMs: 1_000_000 + 60_000 })
    expect(result.intervention).toBeNull()
    expect(result.judge).toBeNull()
  })

  it('the next tick inside the throttle window does nothing, so many screens do not multiply the cost', async () => {
    const { firebase, written } = fakeFirestore({ [SESSION]: room(), [STATE]: liveState() })
    const store = createSessionStore(firebase)
    await store.processTick('s1', { nowMs: 1_000_000 + 60_000 })
    written.length = 0
    const second = await store.processTick('s1', { nowMs: 1_000_000 + 65_000 })
    expect(second).toMatchObject({ ticked: false, reason: 'throttled' })
    expect(written).toEqual([])
  })
})

describe('tick endpoint', () => {
  function setup({ role = 'student', session = { createdBy: 't', studentIds: ['u1'] }, uid = 'u1', result = { ticked: true, intervention: { type: 'GROUP_SILENCE' }, context: {} }, secret = undefined } = {}) {
    const store = { getUserRole: vi.fn().mockResolvedValue(role), getSession: vi.fn().mockResolvedValue(session), processTick: vi.fn().mockResolvedValue(result) }
    const afterSave = vi.fn().mockResolvedValue(undefined)
    const jobs = []
    const handler = createTickHandler({
      getFirebase: () => ({ auth: { verifyIdToken: vi.fn().mockResolvedValue({ uid }) } }),
      createStore: () => store,
      afterSave,
      waitUntil: (promise) => jobs.push(promise),
      getTickSecret: () => secret,
      now: () => 5000,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    })
    return { handler, store, afterSave, jobs }
  }
  const res = () => {
    const r = { statusCode: null, body: null, headers: {} }
    r.status = (c) => { r.statusCode = c; return r }
    r.json = (d) => { r.body = d; return r }
    r.setHeader = (k, v) => { r.headers[k] = v }
    r.end = () => r
    return r
  }
  const post = (over = {}) => ({ method: 'POST', headers: { authorization: 'Bearer ok' }, body: { sessionId: 's1' }, ...over })

  it('lets a member of the room (or the teacher) tick, and runs the follow-up work for what the engine decided', async () => {
    const { handler, store, afterSave, jobs } = setup()
    const r = res()
    await handler(post(), r)
    await Promise.all(jobs)
    expect(r.statusCode).toBe(200)
    expect(r.body).toEqual({ ticked: true })
    expect(store.processTick).toHaveBeenCalledWith('s1', { nowMs: 5000 })
    expect(afterSave).toHaveBeenCalledWith({ sessionId: 's1', result: expect.objectContaining({ ticked: true }) })

    const teacher = setup({ role: 'teacher', uid: 't', session: { createdBy: 't', studentIds: [] } })
    const r2 = res()
    await teacher.handler(post(), r2)
    expect(r2.statusCode).toBe(200)
  })

  it('does no follow-up work when there is nothing to say, and reports why it did not tick', async () => {
    const { handler, afterSave, jobs } = setup({ result: { ticked: false, reason: 'throttled' } })
    const r = res()
    await handler(post(), r)
    await Promise.all(jobs)
    expect(r.body).toEqual({ ticked: false, reason: 'throttled' })
    expect(afterSave).not.toHaveBeenCalled()
  })

  it('a student who is not in that room gets 403 and nothing is evaluated', async () => {
    const { handler, store } = setup({ uid: 'stranger' })
    const r = res()
    await handler(post(), r)
    expect(r.statusCode).toBe(403)
    expect(store.processTick).not.toHaveBeenCalled()
  })

  it('needs a token or the cron secret, validates the session id, and only accepts POST', async () => {
    const anon = setup()
    const r1 = res()
    await anon.handler(post({ headers: {} }), r1)
    expect(r1.statusCode).toBe(401)

    const bad = setup()
    const r2 = res()
    await bad.handler(post({ body: { sessionId: '../x' } }), r2)
    expect(r2.statusCode).toBe(400)

    const get = setup()
    const r3 = res()
    await get.handler({ method: 'GET', headers: {} }, r3)
    expect(r3.statusCode).toBe(405)
  })

  it('the cron path works with the right secret and rejects a wrong one or a missing server secret', async () => {
    const ok = setup({ secret: 'cron-secret' })
    const r1 = res()
    await ok.handler(post({ headers: { 'x-tick-secret': 'cron-secret' } }), r1)
    expect(r1.statusCode).toBe(200)
    expect(ok.store.getUserRole).not.toHaveBeenCalled()

    for (const [secret, header] of [['cron-secret', 'wrong'], [undefined, 'anything'], ['cron-secret', '']]) {
      const bad = setup({ secret })
      const r = res()
      await bad.handler(post({ headers: { 'x-tick-secret': header } }), r)
      expect(r.statusCode).toBe(401)
      expect(bad.store.processTick).not.toHaveBeenCalled()
    }
  })
})

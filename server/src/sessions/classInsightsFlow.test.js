import { describe, expect, it, vi } from 'vitest'
import { createClassInsightsHandler } from '../http/classInsightsHandler.js'
import { createAfterLiveEventSaved } from './afterLiveEventSaved.js'
import { closeSession } from './closeSession.js'
import { addReport, emptyInsights } from './core/classInsights.js'

const NONE = 'sin evidencia suficiente'
const WITH = 'con evidencia'
const hardRoom = { problema: { skillId: 'multiplication' }, estudiantes: [{ key: 'x', capacidades: [{ id: 'traduce', estado: WITH }, { id: 'argumenta', estado: NONE }] }] }
const insights = [1, 2, 3].reduce((acc) => addReport(acc, hardRoom), emptyInsights())

describe('closeSession adds the room to the accumulated insights of its teacher', () => {
  const session = { createdBy: 'teacher-1', status: 'scheduled', currentProblem: { activityId: 'p-01', skillId: 'multiplication', text: 'Hay 6 cajas con 8 lápices cada una.' } }
  const store = (extra = {}) => ({
    getSession: vi.fn().mockResolvedValue(session),
    getLiveState: vi.fn().mockResolvedValue({ lastT: 60, presence: [{ k: 'estudiante a', s: 0 }], totals: [{ k: 'estudiante a', sec: 20, turns: 2 }], students: [], problem: { id: 'p-01', startedT: 0 }, answer: { id: 'p-01', v: 48 } }),
    getTranscripts: vi.fn().mockResolvedValue([{ k: 'estudiante a', t: 5, e: 7, x: 'Entonces seis por ocho' }]),
    getAnswer: vi.fn().mockResolvedValue({ expectedAnswer: 48 }),
    getSummary: vi.fn().mockResolvedValue(null),
    saveClosure: vi.fn().mockResolvedValue(undefined),
    updateInsights: vi.fn().mockResolvedValue(undefined),
    ...extra,
  })
  const run = (s) => closeSession({ sessionId: 's1', store: s, memory: null, leaveBot: null, generate: null, logger: { info: vi.fn() } })

  it('sums the report under the teacher who owns the room', async () => {
    const s = store()
    const result = await run(s)
    expect(s.updateInsights).toHaveBeenCalledWith('teacher-1', result.report)
    expect(result.steps.insights).toBe('ok')
  })

  it('a failure there never breaks the close and is recorded', async () => {
    const s = store({ updateInsights: vi.fn().mockRejectedValue(new Error('firestore')) })
    const result = await run(s)
    expect(result.status).toBe('completed')
    expect(s.saveClosure).toHaveBeenCalledTimes(1)
    expect(String(result.steps.insights)).toMatch(/^failed:/)
  })

  it('is skipped by stores without support', async () => {
    const result = await run(store({ updateInsights: undefined }))
    expect(result.steps.insights).toBe('skipped')
  })
})

describe('the tutor knows what was hardest in the other rooms of the teacher', () => {
  const signal = { type: 'STUCK', participantKey: 'estudiante a', t: 5, evidence: {} }
  const context = { problem: { skillId: 'multiplication', text: 'x', expectedAnswer: 48 }, transcriptTail: [], present: ['estudiante a'] }

  it('puts that line in the prompt, from the teacher of the room, without numbers', async () => {
    const st = {
      createIntervention: vi.fn().mockResolvedValue({ created: true }),
      getSession: vi.fn().mockResolvedValue({ createdBy: 'teacher-1' }),
      getInsights: vi.fn().mockResolvedValue(insights),
    }
    const generate = vi.fn().mockResolvedValue('Estudiante A, ¿qué parte de la multiplicación te cuesta explicar?')
    const hook = createAfterLiveEventSaved({ getStore: () => st, getGenerate: () => generate, logger: { info: vi.fn() }, now: () => 1 })
    await hook({ sessionId: 's1', result: { intervention: signal, context } })

    expect(st.getInsights).toHaveBeenCalledWith('teacher-1')
    const { userPrompt } = generate.mock.calls[0][0]
    expect(userPrompt).toContain('En otras salas de este curso, lo que más ha costado en multiplicación es')
    expect(userPrompt).not.toMatch(/\b3\b|100/)
  })

  it('still speaks when the accumulated insights cannot be read', async () => {
    const st = { createIntervention: vi.fn().mockResolvedValue({ created: true }), getSession: vi.fn().mockResolvedValue({ createdBy: 't' }), getInsights: vi.fn().mockRejectedValue(new Error('x')) }
    const hook = createAfterLiveEventSaved({ getStore: () => st, getGenerate: () => null, logger: { info: vi.fn() }, now: () => 1 })
    await hook({ sessionId: 's1', result: { intervention: signal, context } })
    expect(st.createIntervention).toHaveBeenCalledTimes(1)
  })
})

describe('class-insights endpoint (teacher)', () => {
  function setup(role = 'teacher') {
    const store = { getUserRole: vi.fn().mockResolvedValue(role), getInsights: vi.fn().mockResolvedValue(insights) }
    const handler = createClassInsightsHandler({ getFirebase: () => ({ auth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'teacher-1' }) } }), createStore: () => store, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } })
    return { handler, store }
  }
  const res = () => {
    const r = { statusCode: null, body: null, headers: {} }
    r.status = (c) => { r.statusCode = c; return r }
    r.json = (d) => { r.body = d; return r }
    r.setHeader = (k, v) => { r.headers[k] = v }
    r.end = () => r
    return r
  }

  it('gives the teacher the summary of their own rooms, only counts', async () => {
    const { handler, store } = setup()
    const r = res()
    await handler({ method: 'POST', headers: { authorization: 'Bearer ok' } }, r)
    expect(r.statusCode).toBe(200)
    expect(store.getInsights).toHaveBeenCalledWith('teacher-1')
    expect(r.body).toMatchObject({ sessions: 3, students: 3 })
    expect(r.body.capacities[0]).toMatchObject({ id: 'argumenta', sin: 3, sinPct: 100 })
    expect(JSON.stringify(r.body)).not.toMatch(/cita|transcript|teacher-1/i)
  })

  it('is for teachers only and needs a token', async () => {
    const student = setup('student')
    const r1 = res()
    await student.handler({ method: 'POST', headers: { authorization: 'Bearer ok' } }, r1)
    expect(r1.statusCode).toBe(403)
    expect(student.store.getInsights).not.toHaveBeenCalled()
    const r2 = res()
    await setup().handler({ method: 'POST', headers: {} }, r2)
    expect(r2.statusCode).toBe(401)
    const r3 = res()
    await setup().handler({ method: 'GET', headers: {} }, r3)
    expect(r3.statusCode).toBe(405)
  })
})

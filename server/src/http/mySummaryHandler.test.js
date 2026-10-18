import { describe, expect, it, vi } from 'vitest'
import { createMySummaryHandler } from './mySummaryHandler.js'

const report = {
  problema: { text: 'Hay 8 bolsas con 11 caramelos cada una. ¿Cuántos caramelos hay en total?' },
  estudiantes: [
    { key: 'ana torres', studentId: 'u1', resumen: { talkPct: 90 }, capacidades: [{ id: 'traduce', estado: 'con evidencia' }, { id: 'comunica', estado: 'sin evidencia suficiente' }] },
    { key: 'luis perez', studentId: 'u2', resumen: { talkPct: 10 }, capacidades: [{ id: 'traduce', estado: 'sin evidencia suficiente' }] },
  ],
}
const session = (extra = {}) => ({ createdBy: 't', status: 'completed', studentIds: ['u1', 'u2'], members: [{ studentId: 'u1', displayName: 'Ana Torres' }, { studentId: 'u2', displayName: 'Luis Pérez' }], ...extra })

function setup({ role = 'student', uid = 'u1', sess = session(), summary = { report } } = {}) {
  const store = { getUserRole: vi.fn().mockResolvedValue(role), getSession: vi.fn().mockResolvedValue(sess), getSummary: vi.fn().mockResolvedValue(summary) }
  const handler = createMySummaryHandler({
    getFirebase: () => ({ auth: { verifyIdToken: vi.fn().mockResolvedValue({ uid }) } }),
    createStore: () => store,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  })
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
const post = (over = {}) => ({ method: 'POST', headers: { authorization: 'Bearer ok' }, body: { sessionId: 's1' }, ...over })

describe('my-summary', () => {
  it('gives a student only their own kind feedback, nothing of the full report or of their partner', async () => {
    const { handler } = setup()
    const r = res()
    await handler(post(), r)
    expect(r.statusCode).toBe(200)
    expect(r.body.ready).toBe(true)
    expect(r.body.feedback.strengths).toEqual(['Planteaste la operación con los números del problema.'])
    expect(r.body.feedback.nextSteps).toEqual(['Para la próxima: anímate a decir en voz alta lo que piensas, aunque no estés seguro.'])
    const text = JSON.stringify(r.body)
    expect(text).not.toMatch(/luis|perez|talkPct|90|%|evidencia|cita/i)
  })

  it('finds the student by their name in the room when the report did not link the uid', async () => {
    const unlinked = { ...report, estudiantes: report.estudiantes.map((s) => ({ ...s, studentId: null })) }
    const { handler } = setup({ uid: 'u2', summary: { report: unlinked } })
    const r = res()
    await handler(post(), r)
    expect(r.body.feedback.nextSteps).toEqual(['Para la próxima: di qué datos tiene el problema y qué operación usarías.'])
  })

  it('is not ready while the room is open or has no report, and gives null when the student cannot be identified', async () => {
    const open = setup({ sess: session({ status: 'scheduled' }) })
    const r1 = res()
    await open.handler(post(), r1)
    expect(r1.body).toEqual({ ready: false })
    expect(open.store.getSummary).not.toHaveBeenCalled()

    const none = setup({ summary: null })
    const r2 = res()
    await none.handler(post(), r2)
    expect(r2.body).toEqual({ ready: false })

    const stranger = setup({ uid: 'u9', sess: session({ studentIds: ['u9'], members: [{ studentId: 'u9', displayName: 'Pedro Gómez' }] }) })
    const r3 = res()
    await stranger.handler(post(), r3)
    expect(r3.body).toEqual({ ready: true, feedback: null })
  })

  it('is for students of that room only: the teacher and outsiders get 403', async () => {
    for (const config of [{ role: 'teacher', uid: 't' }, { uid: 'u9' }]) {
      const { handler, store } = setup(config)
      const r = res()
      await handler(post(), r)
      expect(r.statusCode).toBe(403)
      expect(store.getSummary).not.toHaveBeenCalled()
    }
  })

  it('needs a token, a valid session id, and POST', async () => {
    const a = res()
    await setup().handler(post({ headers: {} }), a)
    expect(a.statusCode).toBe(401)
    const b = res()
    await setup().handler(post({ body: { sessionId: '../x' } }), b)
    expect(b.statusCode).toBe(400)
    const c = res()
    await setup().handler({ method: 'GET', headers: {} }, c)
    expect(c.statusCode).toBe(405)
  })
})

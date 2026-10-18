import { describe, expect, it, vi } from 'vitest'
import { createCloseSessionHandler } from './closeSessionHandler.js'

const FRONT = 'https://koeduko-hackandes.vercel.app'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (data) => {
    res.body = data
    return res
  }
  res.setHeader = (name, value) => {
    res.headers[name] = value
  }
  res.end = () => res
  return res
}

const session = { createdBy: 'docente-1', status: 'scheduled', bot: { id: 'bot-1', region: 'us-west-2' }, currentProblem: { activityId: 'p-01', skillId: 'multiplication', text: '6 cajas con 8 lápices' } }

function setup({ role = 'teacher', store = {}, leaveBot = vi.fn().mockResolvedValue({}), memory } = {}) {
  const fakeStore = {
    getUserRole: vi.fn().mockResolvedValue(role),
    getSession: vi.fn().mockResolvedValue(session),
    getLiveState: vi.fn().mockResolvedValue({ lastT: 60, presence: [{ k: 'estudiante a', s: 0 }], totals: [{ k: 'estudiante a', sec: 20, turns: 3 }], students: [], answer: { id: 'p-01', v: 48 } }),
    getTranscripts: vi.fn().mockResolvedValue([{ k: 'estudiante a', t: 5, e: 7, x: 'son cuarenta y ocho' }]),
    getAnswer: vi.fn().mockResolvedValue(null),
    getSummary: vi.fn().mockResolvedValue(null),
    saveClosure: vi.fn().mockResolvedValue(undefined),
    ...store,
  }
  const verifyIdToken = vi.fn().mockResolvedValue({ uid: 'teacher-1' })
  const deps = {
    getFirebase: () => ({ auth: { verifyIdToken } }),
    createStore: () => fakeStore,
    createMemory: () => (memory === undefined ? { remember: vi.fn().mockResolvedValue({ ok: true, via: 'firestore' }) } : memory),
    createGenerate: () => null,
    createLeaveBot: () => leaveBot,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    allowedOrigins: [FRONT],
  }
  return { deps, store: fakeStore, verifyIdToken, leaveBot, handler: createCloseSessionHandler(deps) }
}

const request = (overrides = {}) => ({
  method: 'POST',
  headers: { authorization: 'Bearer good-token', origin: FRONT },
  body: { sessionId: 's1' },
  ...overrides,
})

describe('close-session handler', () => {
  it('closes the session for a verified teacher and answers 200 with the report', async () => {
    const { handler, store, leaveBot, verifyIdToken } = setup()
    const res = fakeRes()
    await handler(request(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ status: 'completed', alreadyClosed: false })
    expect(res.body.report.estudiantes).toHaveLength(1)
    expect(verifyIdToken).toHaveBeenCalledWith('good-token')
    expect(store.getUserRole).toHaveBeenCalledWith('teacher-1')
    expect(leaveBot).toHaveBeenCalledWith(session.bot)
    expect(store.saveClosure).toHaveBeenCalledTimes(1)
    expect(res.headers['Access-Control-Allow-Origin']).toBe(FRONT)
  })

  it('answers 405 with an Allow header for anything but POST', async () => {
    const { handler, verifyIdToken } = setup()
    const res = fakeRes()
    await handler(request({ method: 'GET' }), res)
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('POST')
    expect(verifyIdToken).not.toHaveBeenCalled()
  })

  it('answers the CORS preflight without a token and rejects an unknown origin', async () => {
    const { handler, verifyIdToken, store } = setup()
    const ok = fakeRes()
    await handler({ method: 'OPTIONS', headers: { origin: FRONT, 'access-control-request-method': 'POST' } }, ok)
    expect(ok.statusCode).toBe(204)
    expect(ok.headers['Access-Control-Allow-Origin']).toBe(FRONT)

    const evil = fakeRes()
    await handler({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }, evil)
    expect(evil.statusCode).toBe(403)
    expect(verifyIdToken).not.toHaveBeenCalled()
    expect(store.getSession).not.toHaveBeenCalled()
  })

  it('answers 401 without a token and 401 when it does not verify, before touching the session', async () => {
    const noToken = setup()
    const res1 = fakeRes()
    await noToken.handler(request({ headers: { origin: FRONT } }), res1)
    expect(res1.statusCode).toBe(401)
    expect(res1.headers['Access-Control-Allow-Origin']).toBe(FRONT) // el navegador puede leer el error
    expect(noToken.store.getSession).not.toHaveBeenCalled()

    const bad = setup()
    bad.verifyIdToken.mockRejectedValue(new Error('expired'))
    const res2 = fakeRes()
    await bad.handler(request(), res2)
    expect(res2.statusCode).toBe(401)
    expect(bad.store.getSession).not.toHaveBeenCalled()
  })

  it('answers 403 for a student, and a student cannot close, make the bot leave or write memory', async () => {
    const { handler, store, leaveBot } = setup({ role: 'student' })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(403)
    expect(store.saveClosure).not.toHaveBeenCalled()
    expect(leaveBot).not.toHaveBeenCalled()
  })

  it('answers 400 when sessionId is missing or the JSON body is malformed', async () => {
    const { handler } = setup()
    const missing = fakeRes()
    await handler(request({ body: {} }), missing)
    expect(missing.statusCode).toBe(400)

    const malformed = { method: 'POST', headers: { authorization: 'Bearer good-token' } }
    Object.defineProperty(malformed, 'body', {
      get() {
        throw new SyntaxError('bad json')
      },
    })
    const res = fakeRes()
    await handler(malformed, res)
    expect(res.statusCode).toBe(400)
  })

  it('answers 404 when the session does not exist', async () => {
    const { handler } = setup({ store: { getSession: vi.fn().mockResolvedValue(null) } })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(404)
  })

  it('answers a generic 500 (not the Firestore message) when Firestore fails', async () => {
    const { handler, deps } = setup({ store: { saveClosure: vi.fn().mockRejectedValue(new Error('PERMISSION_DENIED projects/koeduko-app')) } })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'internal', message: 'Error interno.' })
    expect(JSON.stringify(deps.logger.error.mock.calls)).not.toContain('koeduko-app')
  })

  it('still answers 200 when the bot cannot leave and when memory is off', async () => {
    const { handler, store } = setup({ leaveBot: vi.fn().mockRejectedValue(new Error('x')), memory: null })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.steps).toMatchObject({ leaveCall: 'failed:Error', memory: { enabled: false } })
    expect(store.saveClosure).toHaveBeenCalledTimes(1)
  })

  it('works when Recall is not configured (no leaveBot)', async () => {
    const { handler } = setup({ leaveBot: null })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.steps.leaveCall).toBe('skipped')
  })
})

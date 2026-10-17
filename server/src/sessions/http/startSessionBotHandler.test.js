import { describe, expect, it, vi } from 'vitest'
import { RecallApiError } from '../adapters/recall.js'
import { ConfigError, SessionBotError } from '../errors.js'
import { createStartSessionBotHandler } from './startSessionBotHandler.js'

const config = {
  apiKey: 'fake-api-key',
  region: 'us-west-2',
  webhookUrl: 'https://koeduko-sessions.vercel.app/api/recall-webhook',
  webhookToken: 'fake-token',
  language: 'es',
}

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
  return res
}

function setup({ role = 'teacher', store = {}, createBot, readConfig, getFirebase } = {}) {
  const fakeStore = {
    getUserRole: vi.fn().mockResolvedValue(role),
    claimBot: vi.fn().mockResolvedValue({ meetingUrl: 'https://meet.google.com/abc-defg-hij' }),
    setBotId: vi.fn().mockResolvedValue(undefined),
    markBotFailed: vi.fn().mockResolvedValue(undefined),
    ...store,
  }
  const verifyIdToken = vi.fn().mockResolvedValue({ uid: 'teacher-1' })
  const deps = {
    getFirebase: getFirebase ?? (() => ({ auth: { verifyIdToken } })),
    createStore: () => fakeStore,
    readConfig: readConfig ?? (() => config),
    createBot: createBot ?? vi.fn().mockResolvedValue({ botId: 'bot-1' }),
    now: () => 1000,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
  return { deps, store: fakeStore, verifyIdToken, handler: createStartSessionBotHandler(deps) }
}

const request = (overrides = {}) => ({
  method: 'POST',
  headers: { authorization: 'Bearer good-token' },
  body: { sessionId: 'smoke-001' },
  ...overrides,
})

describe('start-session-bot handler', () => {
  it('creates the bot for a verified teacher and answers 200', async () => {
    const { handler, deps, store, verifyIdToken } = setup()
    const res = fakeRes()

    await handler(request(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ botId: 'bot-1', status: 'requested' })
    expect(verifyIdToken).toHaveBeenCalledWith('good-token')
    expect(store.getUserRole).toHaveBeenCalledWith('teacher-1')
    expect(deps.createBot).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'smoke-001', region: 'us-west-2', language: 'es' }),
    )
    expect(store.setBotId).toHaveBeenCalledWith('smoke-001', 'bot-1')
  })

  it('answers 405 with an Allow header for anything but POST', async () => {
    const { handler, verifyIdToken } = setup()
    const res = fakeRes()
    await handler(request({ method: 'GET' }), res)
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('POST')
    expect(verifyIdToken).not.toHaveBeenCalled()
  })

  it('answers 401 without a token, before touching sessions or Recall', async () => {
    const { handler, deps, store } = setup()
    const res = fakeRes()
    await handler(request({ headers: {} }), res)
    expect(res.statusCode).toBe(401)
    expect(store.claimBot).not.toHaveBeenCalled()
    expect(deps.createBot).not.toHaveBeenCalled()
  })

  it('answers 401 when the token does not verify', async () => {
    const { handler, deps } = setup({
      getFirebase: () => ({ auth: { verifyIdToken: vi.fn().mockRejectedValue(new Error('expired')) } }),
    })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(401)
    expect(deps.createBot).not.toHaveBeenCalled()
  })

  it('answers 403 for a student', async () => {
    const { handler, deps } = setup({ role: 'student' })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(403)
    expect(deps.createBot).not.toHaveBeenCalled()
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

  it('answers 409 when the bot was already invited', async () => {
    const claimBot = vi.fn().mockRejectedValue(new SessionBotError('failed-precondition', 'El tutor ya fue invitado a esta sesion.'))
    const { handler, deps } = setup({ store: { claimBot } })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(409)
    expect(res.body.message).toContain('ya fue invitado')
    expect(deps.createBot).not.toHaveBeenCalled()
  })

  it('answers 404 when the session does not exist', async () => {
    const claimBot = vi.fn().mockRejectedValue(new SessionBotError('not-found', 'La sesion no existe.'))
    const { handler } = setup({ store: { claimBot } })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(404)
  })

  it('answers 503 when Recall is rate limited', async () => {
    const createBot = vi.fn().mockRejectedValue(new RecallApiError('Recall respondio 429', { status: 429 }))
    const { handler } = setup({ createBot })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(503)
  })

  it('hides missing server configuration from the caller but logs the detail', async () => {
    const { handler, deps } = setup({ readConfig: () => { throw new ConfigError(['RECALL_API_KEY (falta)']) } })
    const res = fakeRes()

    await handler(request(), res)

    expect(res.statusCode).toBe(500)
    expect(res.body.message).toBe('Configuracion del servidor incompleta.')
    expect(JSON.stringify(res.body)).not.toContain('RECALL_API_KEY')
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ detail: expect.stringContaining('RECALL_API_KEY') }),
    )
  })

  it('does not leak the missing service account to an unauthenticated caller', async () => {
    const { handler } = setup({
      getFirebase: () => {
        throw new ConfigError(['FIREBASE_SERVICE_ACCOUNT_B64 (falta)'])
      },
    })
    const res = fakeRes()
    await handler(request({ headers: {} }), res)
    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('FIREBASE_SERVICE_ACCOUNT_B64')
  })

  it('answers a generic 500 for unexpected errors without leaking their message', async () => {
    const { handler, deps } = setup({ store: { claimBot: vi.fn().mockRejectedValue(new Error('internal db detail')) } })
    const res = fakeRes()

    await handler(request(), res)

    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('internal db detail')
    expect(JSON.stringify(deps.logger.error.mock.calls)).not.toContain('internal db detail')
  })

  it('returns the bot id when the bot was created but its id could not be saved', async () => {
    const { handler } = setup({ store: { setBotId: vi.fn().mockRejectedValue(new Error('firestore down')) } })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(500)
    expect(res.body.botId).toBe('bot-1')
  })

  it('never logs the token or the API key', async () => {
    const { handler, deps } = setup()
    await handler(request(), fakeRes())
    await handler(request({ headers: { authorization: 'Bearer leaked-token' } }), fakeRes())
    const logged = JSON.stringify(
      Object.values(deps.logger).flatMap((fn) => fn.mock.calls),
    )
    expect(logged).not.toContain('good-token')
    expect(logged).not.toContain('leaked-token')
    expect(logged).not.toContain('fake-api-key')
    expect(logged).not.toContain('fake-token')
  })
})

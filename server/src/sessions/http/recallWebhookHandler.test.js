import { describe, expect, it, vi } from 'vitest'
import { createRecallWebhookHandler } from './recallWebhookHandler.js'

const TOKEN = 'expected-token-not-real'
const body = {
  event: 'participant_events.speech_on',
  data: {
    data: { participant: { id: 1, name: 'Ana' }, timestamp: { relative: 4.2, absolute: '2026-10-17T20:00:00Z' } },
    bot: { id: 'b', metadata: { sessionId: 'smoke-001' } },
  },
}

function fakeRes() {
  const res = { statusCode: null, ended: false }
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.end = () => {
    res.ended = true
    return res
  }
  return res
}

function setup(overrides = {}) {
  const store = { processLiveEvent: vi.fn().mockResolvedValue(undefined) }
  const deps = {
    getExpectedToken: () => TOKEN,
    getStore: () => store,
    afterSave: vi.fn().mockResolvedValue(undefined),
    waitUntil: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  }
  return { deps, store, handler: createRecallWebhookHandler(deps) }
}

const post = (query, requestBody = body) => ({ method: 'POST', query, body: requestBody })

describe('recall-webhook handler', () => {
  it('saves the event and answers 200 with a valid token', async () => {
    const { handler, store } = setup()
    const res = fakeRes()

    await handler(post({ token: TOKEN }), res)

    expect(res.statusCode).toBe(200)
    expect(res.ended).toBe(true)
    expect(store.processLiveEvent).toHaveBeenCalledTimes(1)
    const [sessionId, eventId, event] = store.processLiveEvent.mock.calls[0]
    expect(sessionId).toBe('smoke-001')
    expect(eventId).toMatch(/^evt-speechon/)
    expect(event).toMatchObject({ type: 'speech_on', participantKey: 'ana', occurredAt: '2026-10-17T20:00:00Z' })
  })

  it.each([
    ['a wrong token', { token: 'nope' }],
    ['no token', {}],
    ['a repeated token parameter', { token: [TOKEN, TOKEN] }],
  ])('answers 401 and saves nothing with %s', async (_label, query) => {
    const { handler, store, deps } = setup()
    const res = fakeRes()

    await handler(post(query), res)

    expect(res.statusCode).toBe(401)
    expect(store.processLiveEvent).not.toHaveBeenCalled()
    expect(deps.waitUntil).not.toHaveBeenCalled()
  })

  it('answers 401 when the token is not configured on the server', async () => {
    const { handler } = setup({ getExpectedToken: () => undefined })
    const res = fakeRes()
    await handler(post({ token: 'anything' }), res)
    expect(res.statusCode).toBe(401)
  })

  it('hands the post-save hook to waitUntil without blocking the response', async () => {
    const { handler, deps } = setup()
    await handler(post({ token: TOKEN }), fakeRes())

    expect(deps.afterSave).toHaveBeenCalledTimes(1)
    expect(deps.afterSave.mock.calls[0][0]).toMatchObject({ sessionId: 'smoke-001' })
    expect(deps.waitUntil).toHaveBeenCalledTimes(1)
    expect(deps.waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise)
  })

  it('logs but swallows a failing post-save hook', async () => {
    const { handler, deps } = setup({ afterSave: vi.fn().mockRejectedValue(new Error('signals blew up')) })
    const res = fakeRes()

    await handler(post({ token: TOKEN }), res)
    await deps.waitUntil.mock.calls[0][0]

    expect(res.statusCode).toBe(200)
    expect(deps.logger.error).toHaveBeenCalledWith(expect.any(String), { name: 'Error' })
  })

  it('answers 200 when Firestore fails and does not run the hook', async () => {
    const store = { processLiveEvent: vi.fn().mockRejectedValue(new Error('firestore down')) }
    const { handler, deps } = setup({ getStore: () => store })
    const res = fakeRes()

    await handler(post({ token: TOKEN }), res)

    expect(res.statusCode).toBe(200)
    expect(deps.waitUntil).not.toHaveBeenCalled()
  })

  it('answers 200 when the store cannot even be created (missing service account)', async () => {
    const { handler, deps } = setup({
      getStore: () => {
        throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_B64 (falta)'), { expose: true })
      },
    })
    const res = fakeRes()

    await handler(post({ token: TOKEN }), res)

    expect(res.statusCode).toBe(200)
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ detail: 'FIREBASE_SERVICE_ACCOUNT_B64 (falta)' }),
    )
  })

  it('answers 200 when the JSON body is malformed (the body getter throws)', async () => {
    const { handler, store } = setup()
    const req = { method: 'POST', query: { token: TOKEN } }
    Object.defineProperty(req, 'body', {
      get() {
        throw new SyntaxError('Unexpected token')
      },
    })
    const res = fakeRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(store.processLiveEvent).not.toHaveBeenCalled()
  })

  it('answers 200 without saving for a non-POST request that has a valid token', async () => {
    const { handler, store } = setup()
    const res = fakeRes()
    await handler({ method: 'GET', query: { token: TOKEN } }, res)
    expect(res.statusCode).toBe(200)
    expect(store.processLiveEvent).not.toHaveBeenCalled()
  })
})

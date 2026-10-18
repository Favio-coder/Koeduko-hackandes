import { describe, expect, it, vi } from 'vitest'
import { STATE_TTL_MS, signState } from '../sessions/core/googleOAuth.js'
import { createGoogleCallbackHandler } from './googleCallbackHandler.js'
import { createGoogleConnectHandler } from './googleConnectHandler.js'

const secret = 'client-secret-for-tests'
const google = { enabled: true, clientId: 'cid.apps.googleusercontent.com', clientSecret: secret, redirectUri: 'https://koeduko.vercel.app/api/google-callback' }
const FRONT = 'https://www.edukolea.com'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {}, ended: false }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (data) => { res.body = data; return res }
  res.setHeader = (name, value) => { res.headers[name] = value }
  res.end = (text) => { res.ended = true; if (text !== undefined) res.body = text; return res }
  return res
}
const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

describe('google-connect', () => {
  function setup({ role = 'teacher', connection = null, config = google } = {}) {
    const store = { getUserRole: vi.fn().mockResolvedValue(role), getGoogleConnection: vi.fn().mockResolvedValue(connection) }
    const deps = {
      getFirebase: () => ({ auth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'teacher-1' }) } }),
      createStore: () => store,
      readConfig: () => config,
      now: () => 1000,
      logger: logger(),
      allowedOrigins: [FRONT],
    }
    return { handler: createGoogleConnectHandler(deps), store, deps }
  }
  const request = (body, headers = { authorization: 'Bearer ok' }) => ({ method: 'POST', headers, body })

  it('gives a Google authorization URL whose state is signed for that teacher and carries the allowed return origin', async () => {
    const { handler } = setup()
    const res = fakeRes()
    await handler(request({ returnTo: `${FRONT}/` }), res)

    expect(res.statusCode).toBe(200)
    const url = new URL(res.body.url)
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('client_id')).toBe(google.clientId)
    const state = url.searchParams.get('state')
    const expected = signState({ uid: 'teacher-1', ret: FRONT, nowMs: 1000, secret })
    expect(state).toBe(expected)
    expect(JSON.stringify(res.body)).not.toContain(secret)
  })

  it('ignores a return origin that is not allowed (no open redirect)', async () => {
    const { handler } = setup()
    const res = fakeRes()
    await handler(request({ returnTo: 'https://evil.example' }), res)
    expect(res.body.url).toContain('state=')
    const state = new URL(res.body.url).searchParams.get('state')
    expect(state).toBe(signState({ uid: 'teacher-1', ret: null, nowMs: 1000, secret }))
  })

  it('reports whether the teacher is already connected, without returning the token', async () => {
    const connected = setup({ connection: { refreshToken: 'rt-secret' } })
    const res = fakeRes()
    await connected.handler(request({ statusOnly: true }), res)
    expect(res.body).toEqual({ connected: true })

    const notYet = setup()
    const res2 = fakeRes()
    await notYet.handler(request({ statusOnly: true }), res2)
    expect(res2.body).toEqual({ connected: false })
  })

  it('is for teachers only, needs a token, and answers 503 when Google is not configured', async () => {
    const student = setup({ role: 'student' })
    const res = fakeRes()
    await student.handler(request({}), res)
    expect(res.statusCode).toBe(403)

    const anon = setup()
    const res2 = fakeRes()
    await anon.handler(request({}, {}), res2)
    expect(res2.statusCode).toBe(401)

    const off = setup({ config: { enabled: false } })
    const res3 = fakeRes()
    await off.handler(request({}), res3)
    expect(res3.statusCode).toBe(503)

    const res4 = fakeRes()
    await setup().handler({ method: 'GET', headers: {} }, res4)
    expect(res4.statusCode).toBe(405)
  })
})

describe('google-callback', () => {
  function setup({ exchange, config = google } = {}) {
    const store = { saveGoogleConnection: vi.fn().mockResolvedValue(undefined) }
    const log = logger()
    const handler = createGoogleCallbackHandler({
      getFirebase: () => ({}),
      createStore: () => store,
      readConfig: () => config,
      exchange: exchange ?? vi.fn().mockResolvedValue({ refreshToken: 'rt-secret-1', scope: 'scope-x' }),
      now: () => 2000,
      logger: log,
      allowedOrigins: [FRONT],
    })
    return { handler, store, log }
  }
  const goodState = () => signState({ uid: 'teacher-1', ret: FRONT, nowMs: 1000, secret })
  const get = (query) => ({ method: 'GET', query })

  it('stores the refresh token for the teacher in the state and sends them back to the app', async () => {
    const { handler, store } = setup()
    const res = fakeRes()
    await handler(get({ code: 'c1', state: goodState() }), res)

    expect(res.statusCode).toBe(302)
    expect(res.headers.Location).toBe(`${FRONT}/sessions?google=connected`)
    expect(store.saveGoogleConnection).toHaveBeenCalledWith('teacher-1', { refreshToken: 'rt-secret-1', scope: 'scope-x' })
    expect(JSON.stringify(res.headers)).not.toContain('rt-secret-1')
  })

  it('does nothing with a forged, expired or missing state', async () => {
    const { handler, store } = setup()
    const forged = Buffer.from(JSON.stringify({ uid: 'attacker', ret: null, exp: 9e15 })).toString('base64url') + '.AAAA'
    for (const state of [forged, undefined, '', 'x.y', signState({ uid: 'teacher-1', nowMs: -STATE_TTL_MS - 1, secret })]) {
      const res = fakeRes()
      await handler(get({ code: 'c1', state }), res)
      expect(res.statusCode).toBe(400)
    }
    expect(store.saveGoogleConnection).not.toHaveBeenCalled()
  })

  it('tells the app when the teacher denied the access, Google gave no refresh token, or the exchange failed', async () => {
    const denied = setup()
    const r1 = fakeRes()
    await denied.handler(get({ error: 'access_denied', state: goodState() }), r1)
    expect(r1.headers.Location).toBe(`${FRONT}/sessions?google=denied`)

    const noRefresh = setup({ exchange: vi.fn().mockResolvedValue({ refreshToken: null, scope: '' }) })
    const r2 = fakeRes()
    await noRefresh.handler(get({ code: 'c1', state: goodState() }), r2)
    expect(r2.headers.Location).toBe(`${FRONT}/sessions?google=no-refresh`)
    expect(noRefresh.store.saveGoogleConnection).not.toHaveBeenCalled()

    const failing = setup({ exchange: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'GoogleApiError', status: 400, code: 'invalid_grant' })) })
    const r3 = fakeRes()
    await failing.handler(get({ code: 'c1', state: goodState() }), r3)
    expect(r3.headers.Location).toBe(`${FRONT}/sessions?google=error`)
    expect(JSON.stringify(failing.log.error.mock.calls)).not.toMatch(/secret/)
  })

  it('only accepts GET and is off without configuration', async () => {
    const res = fakeRes()
    await setup().handler({ method: 'POST', query: {} }, res)
    expect(res.statusCode).toBe(405)

    const off = setup({ config: { enabled: false } })
    const res2 = fakeRes()
    await off.handler(get({ code: 'c1', state: goodState() }), res2)
    expect(res2.statusCode).toBe(400)
  })
})

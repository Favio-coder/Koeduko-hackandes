import { describe, expect, it, vi } from 'vitest'
import { GoogleApiError, MEET_SPACES_URL, TOKEN_URL, createSpace, exchangeCode, refreshAccessToken } from './adapters/googleMeet.js'
import { MEET_SCOPE, STATE_TTL_MS, buildAuthUrl, signState, verifyState } from './core/googleOAuth.js'
import { readGoogleConfig } from './config.js'
import { ensureMeeting } from './ensureMeeting.js'

const secret = 'client-secret-for-tests'
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

describe('state: signed, expiring, tied to the teacher', () => {
  it('round-trips the uid and the return origin', () => {
    const state = signState({ uid: 'teacher-1', ret: 'https://app.example', nowMs: 1000, secret })
    expect(verifyState(state, { nowMs: 2000, secret })).toEqual({ uid: 'teacher-1', ret: 'https://app.example' })
  })

  it('rejects it after the TTL, with another secret, tampered, or malformed — and never throws', () => {
    const state = signState({ uid: 'teacher-1', nowMs: 1000, secret })
    expect(verifyState(state, { nowMs: 1000 + STATE_TTL_MS + 1, secret })).toBeNull()
    expect(verifyState(state, { nowMs: 2000, secret: 'other' })).toBeNull()

    const [payload, signature] = state.split('.')
    const forged = Buffer.from(JSON.stringify({ uid: 'attacker', ret: null, exp: 9e15 })).toString('base64url')
    expect(verifyState(`${forged}.${signature}`, { nowMs: 2000, secret })).toBeNull()
    expect(verifyState(`${payload}.${signature}.extra`, { nowMs: 2000, secret })).toBeNull()
    for (const junk of [undefined, null, '', 'abc', '.', 42, {}]) expect(verifyState(junk, { nowMs: 1, secret })).toBeNull()
    expect(verifyState(state, { nowMs: 1, secret: '' })).toBeNull()
  })

  it('refuses to sign without uid or secret', () => {
    expect(() => signState({ uid: '', nowMs: 1, secret })).toThrow(TypeError)
    expect(() => signState({ uid: 'u', nowMs: 1, secret: '' })).toThrow(TypeError)
  })
})

describe('buildAuthUrl', () => {
  it('asks for the Meet scope, offline access and consent (so Google returns a refresh token)', () => {
    const url = new URL(buildAuthUrl({ clientId: 'cid.apps.googleusercontent.com', redirectUri: 'https://x.test/api/google-callback', state: 's' }))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'cid.apps.googleusercontent.com',
      redirect_uri: 'https://x.test/api/google-callback',
      response_type: 'code',
      scope: MEET_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state: 's',
    })
  })
})

describe('Google adapter', () => {
  it('exchangeCode posts the code with the client credentials and returns the refresh token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { refresh_token: 'rt-1', scope: MEET_SCOPE, access_token: 'at' }))
    const result = await exchangeCode({ clientId: 'c', clientSecret: 's', redirectUri: 'https://x/cb', code: 'code-1', fetchImpl })
    expect(result).toEqual({ refreshToken: 'rt-1', scope: MEET_SCOPE })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(TOKEN_URL)
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({ client_id: 'c', client_secret: 's', redirect_uri: 'https://x/cb', code: 'code-1', grant_type: 'authorization_code' })
  })

  it('exchangeCode tolerates a response without refresh token (the caller decides)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { access_token: 'at' }))
    expect(await exchangeCode({ clientId: 'c', clientSecret: 's', redirectUri: 'r', code: 'x', fetchImpl })).toEqual({ refreshToken: null, scope: '' })
  })

  it('refreshAccessToken returns the access token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { access_token: 'at-1' }))
    expect(await refreshAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'rt', fetchImpl })).toBe('at-1')
    expect(Object.fromEntries(new URLSearchParams(fetchImpl.mock.calls[0][1].body))).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'rt' })
  })

  it('createSpace asks for an OPEN space with the Bearer token and returns the Meet link', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { name: 'spaces/abc', meetingUri: 'https://meet.google.com/abc-defg-hij', meetingCode: 'abc-defg-hij' }))
    const result = await createSpace({ accessToken: 'at-1', fetchImpl })
    expect(result).toEqual({ meetingUrl: 'https://meet.google.com/abc-defg-hij', meetingCode: 'abc-defg-hij' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(MEET_SPACES_URL)
    expect(init.headers.authorization).toBe('Bearer at-1')
    expect(JSON.parse(init.body)).toEqual({ config: { accessType: 'OPEN' } })
  })

  it('rejects an invalid Meet link from Google', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { meetingUri: 'https://evil.example/x' }))
    await expect(createSpace({ accessToken: 'a', fetchImpl })).rejects.toBeInstanceOf(GoogleApiError)
  })

  it('errors carry only the HTTP status and a short code — never the token, the secret or the body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked refresh-secret-xyz' }))
    const error = await refreshAccessToken({ clientId: 'c', clientSecret: 'super-secret', refreshToken: 'refresh-secret-xyz', fetchImpl }).catch((e) => e)
    expect(error).toMatchObject({ name: 'GoogleApiError', status: 400, code: 'invalid_grant' })
    expect(JSON.stringify({ message: error.message, ...error })).not.toMatch(/super-secret|refresh-secret-xyz/)
  })

  it('maps network failures and timeouts to status 0', async () => {
    const down = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    await expect(createSpace({ accessToken: 'a', fetchImpl: down })).rejects.toMatchObject({ status: 0, code: 'network' })
  })
})

describe('readGoogleConfig', () => {
  it('is off without client id and secret, with safe defaults otherwise', () => {
    expect(readGoogleConfig({}).enabled).toBe(false)
    expect(readGoogleConfig({ GOOGLE_CLIENT_ID: 'id' }).enabled).toBe(false)
    expect(readGoogleConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' })).toMatchObject({
      enabled: true,
      redirectUri: 'https://koeduko.vercel.app/api/google-callback',
      accessType: 'OPEN',
    })
    expect(readGoogleConfig({ GOOGLE_MEET_ACCESS: 'trusted' }).accessType).toBe('TRUSTED')
    expect(readGoogleConfig({ GOOGLE_MEET_ACCESS: 'cualquiera' }).accessType).toBe('OPEN')
  })
})

describe('ensureMeeting', () => {
  const google = { enabled: true, clientId: 'c', clientSecret: 's', accessType: 'OPEN' }
  const make = (session, connection = { refreshToken: 'rt' }) => ({
    getSession: vi.fn().mockResolvedValue(session),
    getGoogleConnection: vi.fn().mockResolvedValue(connection),
    saveMeeting: vi.fn().mockResolvedValue({ saved: true, meetingUrl: 'https://meet.google.com/abc-defg-hij' }),
  })
  const refresh = vi.fn().mockResolvedValue('at')
  const create = vi.fn().mockResolvedValue({ meetingUrl: 'https://meet.google.com/abc-defg-hij' })

  it('creates the Meet with the teacher’s Google account and saves it in the room', async () => {
    const store = make({ createdBy: 'teacher-1', meetingUrl: null })
    const result = await ensureMeeting({ sessionId: 's1', store, google, refresh, create })
    expect(result).toEqual({ created: true, meetingUrl: 'https://meet.google.com/abc-defg-hij' })
    expect(store.getGoogleConnection).toHaveBeenCalledWith('teacher-1')
    expect(refresh).toHaveBeenCalledWith({ clientId: 'c', clientSecret: 's', refreshToken: 'rt' })
    expect(create).toHaveBeenCalledWith({ accessToken: 'at', accessType: 'OPEN' })
    expect(store.saveMeeting).toHaveBeenCalledWith('s1', 'https://meet.google.com/abc-defg-hij')
  })

  it('does nothing when the room already has a valid link', async () => {
    const store = make({ createdBy: 't', meetingUrl: 'https://meet.google.com/xyz-abcd-efg' })
    expect(await ensureMeeting({ sessionId: 's1', store, google, refresh, create })).toEqual({ created: false, reason: 'has-link' })
    expect(store.getGoogleConnection).not.toHaveBeenCalled()
  })

  it('says why it could not: Google not configured, teacher not connected, room missing', async () => {
    expect(await ensureMeeting({ sessionId: 's1', store: make({ createdBy: 't' }), google: { enabled: false }, refresh, create })).toEqual({ created: false, reason: 'google-not-configured' })
    expect(await ensureMeeting({ sessionId: 's1', store: make({ createdBy: 't' }, null), google, refresh, create })).toEqual({ created: false, reason: 'teacher-not-connected' })
    expect(await ensureMeeting({ sessionId: 's1', store: make(null), google, refresh, create })).toEqual({ created: false, reason: 'not-found' })
  })

  it('never throws: a Google failure becomes a short reason', async () => {
    const store = make({ createdBy: 't' })
    const failing = vi.fn().mockRejectedValue(new GoogleApiError('x', { status: 400, code: 'invalid_grant' }))
    expect(await ensureMeeting({ sessionId: 's1', store, google, refresh: failing, create })).toEqual({ created: false, reason: 'failed:invalid_grant' })
  })

  it('when another person created the link first, it is not "created" but returns the saved one', async () => {
    const store = make({ createdBy: 't' })
    store.saveMeeting.mockResolvedValue({ saved: false, meetingUrl: 'https://meet.google.com/zzz-zzzz-zzz' })
    expect(await ensureMeeting({ sessionId: 's1', store, google, refresh, create })).toEqual({ created: false, meetingUrl: 'https://meet.google.com/zzz-zzzz-zzz' })
  })
})

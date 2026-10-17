import { describe, expect, it, vi } from 'vitest'
import { handleRecallWebhook, tokensMatch } from './handleRecallWebhook.js'

const EXPECTED = 'expected-token-not-real'
const body = {
  event: 'participant_events.speech_on',
  data: {
    data: { participant: { id: 1, name: 'Ana' }, timestamp: { relative: 4.2 } },
    bot: { id: 'b', metadata: { sessionId: 'session-001' } },
  },
}

function setup(overrides = {}) {
  const saveEvent = vi.fn().mockResolvedValue(undefined)
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const deps = { expectedToken: EXPECTED, saveEvent, logger, ...overrides }
  return { deps, saveEvent, logger }
}

describe('tokensMatch', () => {
  it('accepts only the exact token', () => {
    expect(tokensMatch(EXPECTED, EXPECTED)).toBe(true)
    expect(tokensMatch('other', EXPECTED)).toBe(false)
    expect(tokensMatch(`${EXPECTED}x`, EXPECTED)).toBe(false)
  })

  it('rejects missing, empty or non-string values', () => {
    expect(tokensMatch(undefined, EXPECTED)).toBe(false)
    expect(tokensMatch(['a'], EXPECTED)).toBe(false)
    expect(tokensMatch('', '')).toBe(false)
    expect(tokensMatch(EXPECTED, undefined)).toBe(false)
  })
})

describe('handleRecallWebhook', () => {
  it('returns 401 and saves nothing when the token does not match', async () => {
    const { deps, saveEvent } = setup()
    const result = await handleRecallWebhook({ token: 'wrong', body }, deps)
    expect(result.status).toBe(401)
    expect(saveEvent).not.toHaveBeenCalled()
  })

  it('returns 401 when the configured secret is empty', async () => {
    const { deps, saveEvent } = setup({ expectedToken: '' })
    const result = await handleRecallWebhook({ token: '', body }, deps)
    expect(result.status).toBe(401)
    expect(saveEvent).not.toHaveBeenCalled()
  })

  it('saves a normalized event and returns 200', async () => {
    const { deps, saveEvent } = setup()
    const result = await handleRecallWebhook({ token: EXPECTED, body }, deps)

    expect(result.status).toBe(200)
    expect(saveEvent).toHaveBeenCalledTimes(1)
    const [sessionId, eventId, event] = saveEvent.mock.calls[0]
    expect(sessionId).toBe('session-001')
    expect(eventId).toMatch(/^evt-/)
    expect(event).toMatchObject({ type: 'speech_on', participantKey: 'ana', t: 4.2 })
  })

  it('returns 200 without saving when the event has no sessionId', async () => {
    const { deps, saveEvent } = setup()
    const noSession = { ...body, data: { ...body.data, bot: { id: 'b', metadata: {} } } }
    const result = await handleRecallWebhook({ token: EXPECTED, body: noSession }, deps)
    expect(result.status).toBe(200)
    expect(saveEvent).not.toHaveBeenCalled()
  })

  it('returns 200 and logs the failure when saving throws', async () => {
    const failure = Object.assign(new Error('boom with details'), { code: 'unavailable' })
    const { deps, logger } = setup({ saveEvent: vi.fn().mockRejectedValue(failure) })

    const result = await handleRecallWebhook({ token: EXPECTED, body }, deps)

    expect(result.status).toBe(200)
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), { name: 'Error', code: 'unavailable' })
  })

  it('returns 200 for malformed bodies', async () => {
    const { deps } = setup()
    expect((await handleRecallWebhook({ token: EXPECTED, body: null }, deps)).status).toBe(200)
    expect((await handleRecallWebhook({ token: EXPECTED, body: 'text' }, deps)).status).toBe(200)
  })

  it('never logs the token or the request body', async () => {
    const { deps, logger } = setup()
    await handleRecallWebhook({ token: EXPECTED, body }, deps)
    await handleRecallWebhook({ token: 'wrong-token-value', body }, deps)

    const logged = JSON.stringify(Object.values(logger).flatMap((fn) => fn.mock.calls))
    expect(logged).not.toContain(EXPECTED)
    expect(logged).not.toContain('wrong-token-value')
    expect(logged).not.toContain('Ana')
  })
})

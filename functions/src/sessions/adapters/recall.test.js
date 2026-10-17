import { describe, expect, it, vi } from 'vitest'
import {
  BOT_NAME,
  REALTIME_EVENTS,
  RecallApiError,
  buildCreateBotBody,
  createBot,
  leaveCall,
  withToken,
} from './recall.js'

const API_KEY = 'test-key-not-real'
const base = {
  apiKey: API_KEY,
  region: 'us-west-2',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  sessionId: 'session-001',
  webhookUrl: 'https://example.test/recallWebhook?token=t',
}

function fakeResponse({ ok = true, status = 200, json = {}, text = '', headers = {} } = {}) {
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  }
}

describe('buildCreateBotBody', () => {
  it('builds the Deepgram streaming body with the realtime webhook', () => {
    const body = buildCreateBotBody(base)
    expect(body).toEqual({
      meeting_url: base.meetingUrl,
      bot_name: BOT_NAME,
      metadata: { sessionId: 'session-001' },
      recording_config: {
        transcript: { provider: { deepgram_streaming: { model: 'nova-3', language: 'es' } } },
        realtime_endpoints: [{ type: 'webhook', url: base.webhookUrl, events: REALTIME_EVENTS }],
      },
    })
    expect(body).not.toHaveProperty('join_at')
  })

  it('allows overriding the transcription language', () => {
    const body = buildCreateBotBody({ ...base, language: 'multi' })
    expect(body.recording_config.transcript.provider.deepgram_streaming.language).toBe('multi')
  })

  it('subscribes only to the events the webhook needs', () => {
    expect(REALTIME_EVENTS).toEqual([
      'transcript.data',
      'participant_events.speech_on',
      'participant_events.speech_off',
      'participant_events.join',
      'participant_events.leave',
    ])
  })
})

describe('withToken', () => {
  it('adds the token as a query parameter and encodes it', () => {
    expect(withToken('https://x.test/recallWebhook', 'a b&c')).toBe(
      'https://x.test/recallWebhook?token=a+b%26c',
    )
  })

  it('requires both values', () => {
    expect(() => withToken('', 't')).toThrow(TypeError)
    expect(() => withToken('https://x.test', '')).toThrow(TypeError)
  })
})

describe('createBot', () => {
  it('posts to the regional endpoint with the raw key and returns the bot id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ status: 201, json: { id: 'bot-123' } }))

    const result = await createBot({ ...base, fetchImpl })

    expect(result).toEqual({ botId: 'bot-123' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://us-west-2.recall.ai/api/v1/bot/')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe(API_KEY)
    expect(init.headers['content-type']).toBe('application/json')
    expect(JSON.parse(init.body).metadata).toEqual({ sessionId: 'session-001' })
  })

  it('throws RecallApiError with status and retry-after on failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse({ ok: false, status: 429, text: 'slow down', headers: { 'retry-after': '7' } }))

    const error = await createBot({ ...base, fetchImpl }).catch((e) => e)

    expect(error).toBeInstanceOf(RecallApiError)
    expect(error.status).toBe(429)
    expect(error.retryAfter).toBe('7')
    expect(error.message).not.toContain(API_KEY)
  })

  it('does not retry automatically', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 507 }))
    await expect(createBot({ ...base, fetchImpl })).rejects.toBeInstanceOf(RecallApiError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('fails when Recall returns no bot id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ json: {} }))
    await expect(createBot({ ...base, fetchImpl })).rejects.toMatchObject({ status: 502 })
  })

  it('rejects invalid input before calling the network', async () => {
    const fetchImpl = vi.fn()
    await expect(createBot({ ...base, apiKey: '', fetchImpl })).rejects.toThrow(TypeError)
    await expect(createBot({ ...base, region: 'evil.test/x', fetchImpl })).rejects.toThrow(TypeError)
    await expect(createBot({ ...base, meetingUrl: '', fetchImpl })).rejects.toThrow(TypeError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('leaveCall', () => {
  it('posts to leave_call without a body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ json: { id: 'bot-123' } }))

    await leaveCall({ apiKey: API_KEY, region: 'us-west-2', botId: 'bot-123', fetchImpl })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://us-west-2.recall.ai/api/v1/bot/bot-123/leave_call/')
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(init.headers.Authorization).toBe(API_KEY)
  })

  it('throws RecallApiError when Recall rejects the request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 400 }))
    await expect(
      leaveCall({ apiKey: API_KEY, region: 'us-west-2', botId: 'bot-123', fetchImpl }),
    ).rejects.toMatchObject({ name: 'RecallApiError', status: 400 })
  })

  it('rejects a bot id that could alter the path', async () => {
    const fetchImpl = vi.fn()
    await expect(
      leaveCall({ apiKey: API_KEY, region: 'us-west-2', botId: '../x', fetchImpl }),
    ).rejects.toThrow(TypeError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

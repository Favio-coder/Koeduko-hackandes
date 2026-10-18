import { describe, expect, it, vi } from 'vitest'
import { buildCreateBotBody, createBot, sendAudio, silentMp3Base64 } from './recall.js'

const base = { meetingUrl: 'https://meet.google.com/abc-defg-hij', sessionId: 's1', webhookUrl: 'https://example.test/hook?token=t' }
const reply = (status, json = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => json, text: async () => '', headers: { get: () => null } })

describe('silentMp3Base64', () => {
  const bytes = Buffer.from(silentMp3Base64(), 'base64')

  it('is three whole MPEG-1 Layer III frames (128 kbps, 44.1 kHz) with a silent body', () => {
    expect(bytes.length).toBe(3 * 417)
    for (let frame = 0; frame < 3; frame += 1) {
      const at = frame * 417
      expect(bytes[at]).toBe(0xff) // sincronia
      expect(bytes[at + 1] & 0xfe).toBe(0xfa) // sincronia + MPEG-1 + Layer III
      expect(bytes[at + 2]).toBe(0x90) // 128 kbps, 44,1 kHz, sin relleno
      expect(bytes.subarray(at + 4, at + 417).every((b) => b === 0)).toBe(true) // cuerpo en silencio
    }
  })

  it('is plain standard base64 (what Recall asks for)', () => {
    expect(silentMp3Base64()).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })
})

describe('buildCreateBotBody with speak', () => {
  it('is byte-for-byte the same as before when speak is off (nothing changes for the working flow)', () => {
    const without = buildCreateBotBody(base)
    expect(buildCreateBotBody({ ...base, speak: false })).toEqual(without)
    expect(without).not.toHaveProperty('automatic_audio_output')
  })

  it('adds the silent clip as automatic_audio_output when speak is on, and changes nothing else', () => {
    const off = buildCreateBotBody(base)
    const on = buildCreateBotBody({ ...base, speak: true })
    expect(on.automatic_audio_output).toEqual({ in_call_recording: { data: { kind: 'mp3', b64_data: silentMp3Base64() } } })
    const rest = { ...on }
    delete rest.automatic_audio_output
    expect(rest).toEqual(off)
  })

  it('createBot sends it only when asked to', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(201, { id: 'bot-1' }))
    await createBot({ apiKey: 'k', region: 'us-west-2', ...base, speak: true, fetchImpl })
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toHaveProperty('automatic_audio_output')

    await createBot({ apiKey: 'k', region: 'us-west-2', ...base, fetchImpl })
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).not.toHaveProperty('automatic_audio_output')
  })
})

describe('sendAudio', () => {
  const input = { apiKey: 'k', region: 'us-west-2', botId: 'bot-123', mp3Base64: 'AAAA' }

  it('posts { kind: "mp3", b64_data } to the output_audio endpoint with the raw key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200))
    await expect(sendAudio({ ...input, fetchImpl })).resolves.toEqual({ ok: true, status: 200 })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://us-west-2.recall.ai/api/v1/bot/bot-123/output_audio/')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('k')
    expect(JSON.parse(init.body)).toEqual({ kind: 'mp3', b64_data: 'AAAA' })
  })

  it.each([400, 404, 429, 500])('reports a %i without throwing', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(status))
    await expect(sendAudio({ ...input, fetchImpl })).resolves.toEqual({ ok: false, status })
  })

  it('reports status 0 on a network failure and cuts the request on a timeout', async () => {
    await expect(sendAudio({ ...input, fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNRESET')) })).resolves.toEqual({ ok: false, status: 0 })
    const hangs = vi.fn((_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))))
    await expect(sendAudio({ ...input, timeoutMs: 20, fetchImpl: hangs })).resolves.toEqual({ ok: false, status: 0 })
  })

  it('rejects bad input before any request', async () => {
    const fetchImpl = vi.fn()
    await expect(sendAudio({ ...input, mp3Base64: ' ', fetchImpl })).rejects.toThrow(TypeError)
    await expect(sendAudio({ ...input, botId: '../x', fetchImpl })).rejects.toThrow(TypeError)
    await expect(sendAudio({ ...input, region: 'evil.com/', fetchImpl })).rejects.toThrow(TypeError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

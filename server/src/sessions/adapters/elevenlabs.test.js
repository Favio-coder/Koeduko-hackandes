import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL_ID, DEFAULT_VOICE_ID, MAX_SPOKEN_CHARS, OUTPUT_FORMAT, synthesize } from './elevenlabs.js'

const audio = (status, bytes = [0xff, 0xfb, 0x90, 0x00]) => ({ ok: status >= 200 && status < 300, status, arrayBuffer: async () => new Uint8Array(bytes).buffer })

describe('synthesize (ElevenLabs text to speech)', () => {
  const input = { apiKey: 'xi-secret-key', text: 'Estudiante B, ¿cómo explicarías el problema?' }

  it('posts the text to the voice endpoint with the xi-api-key header and the verified contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(audio(200))
    await synthesize({ ...input, fetchImpl })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}?output_format=${OUTPUT_FORMAT}`)
    expect(init.method).toBe('POST')
    expect(init.headers['xi-api-key']).toBe('xi-secret-key')
    expect(JSON.parse(init.body)).toEqual({ text: input.text, model_id: DEFAULT_MODEL_ID })
  })

  it('returns the mp3 as base64, ready for Recall', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(audio(200, [1, 2, 3, 4]))
    await expect(synthesize({ ...input, fetchImpl })).resolves.toEqual({ ok: true, status: 200, mp3Base64: Buffer.from([1, 2, 3, 4]).toString('base64') })
  })

  it('uses the voice and the model it is given, and uses a default model that speaks Spanish with low latency', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(audio(200))
    await synthesize({ ...input, voiceId: 'AbCdEfGhIjKlMn', modelId: 'eleven_multilingual_v2', fetchImpl })
    expect(fetchImpl.mock.calls[0][0]).toContain('/AbCdEfGhIjKlMn?')
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).model_id).toBe('eleven_multilingual_v2')
    expect(DEFAULT_MODEL_ID).toBe('eleven_flash_v2_5')
  })

  it('collapses whitespace and caps what is spoken', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(audio(200))
    await synthesize({ ...input, text: `hola\n\n  mundo ${'x'.repeat(500)}`, fetchImpl })
    const spoken = JSON.parse(fetchImpl.mock.calls[0][1].body).text
    expect(spoken.startsWith('hola mundo ')).toBe(true)
    expect(spoken.length).toBe(MAX_SPOKEN_CHARS)
  })

  it.each([401, 422, 429, 500])('reports HTTP %i as a failure, never throws, and never leaks the key', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(audio(status))
    const result = await synthesize({ ...input, fetchImpl })
    expect(result).toEqual({ ok: false, status })
    expect(JSON.stringify(result)).not.toContain('xi-secret-key')
  })

  it('adds the short error code of the service (detail.status) so a 400 can be told apart, and nothing else of the body', async () => {
    const body = { detail: { status: 'invalid_uid', message: 'texto largo que no se registra' } }
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => body })
    const result = await synthesize({ ...input, fetchImpl })
    expect(result).toEqual({ ok: false, status: 400, code: 'invalid_uid' })
    expect(JSON.stringify(result)).not.toContain('texto largo')

    const odd = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: { status: 'x y <script>' } }) })
    await expect(synthesize({ ...input, fetchImpl: odd })).resolves.toEqual({ ok: false, status: 400 })
  })

  it('treats an empty body as a failure', async () => {
    await expect(synthesize({ ...input, fetchImpl: vi.fn().mockResolvedValue(audio(200, [])) })).resolves.toEqual({ ok: false, status: 200 })
  })

  it('reports status 0 on a network failure and cuts the request on a timeout', async () => {
    await expect(synthesize({ ...input, fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNRESET')) })).resolves.toEqual({ ok: false, status: 0 })
    const hangs = vi.fn((_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))))
    await expect(synthesize({ ...input, timeoutMs: 20, fetchImpl: hangs })).resolves.toEqual({ ok: false, status: 0 })
  })

  it('rejects bad input before any request (and a voice id cannot change the path)', async () => {
    const fetchImpl = vi.fn()
    await expect(synthesize({ ...input, apiKey: ' ', fetchImpl })).rejects.toThrow(TypeError)
    await expect(synthesize({ ...input, text: '   ', fetchImpl })).rejects.toThrow(TypeError)
    await expect(synthesize({ ...input, voiceId: '../v1/user', fetchImpl })).rejects.toThrow(TypeError)
    await expect(synthesize({ ...input, modelId: 'x y', fetchImpl })).rejects.toThrow(TypeError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

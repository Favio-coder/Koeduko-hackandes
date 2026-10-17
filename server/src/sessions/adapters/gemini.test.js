import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_GENERATION_CONFIG, GeminiError, generate } from './gemini.js'

const KEY = 'test-gemini-key-not-real'
const base = { apiKey: KEY, model: 'gemini-test-flash', systemInstruction: 'reglas', userPrompt: 'hola' }

const okResponse = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) })

describe('generate', () => {
  it('posts to the model endpoint with the key in a header, never in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('Luis, ¿cómo lo ves?'))

    const text = await generate({ ...base, fetchImpl })

    expect(text).toBe('Luis, ¿cómo lo ves?')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test-flash:generateContent')
    expect(url).not.toContain(KEY)
    expect(init.method).toBe('POST')
    expect(init.headers['x-goog-api-key']).toBe(KEY)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('sends the system instruction, the user prompt and a short, low-temperature generation config', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('ok'))
    await generate({ ...base, fetchImpl })

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(body.systemInstruction.parts[0].text).toBe('reglas')
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hola' }] }])
    expect(body.generationConfig).toEqual(DEFAULT_GENERATION_CONFIG)
  })

  it('lets the caller override the generation config', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('ok'))
    await generate({ ...base, generationConfig: { maxOutputTokens: 50, thinkingConfig: { thinkingBudget: 0 } }, fetchImpl })

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).generationConfig).toEqual({
      temperature: 0.4,
      maxOutputTokens: 50,
      thinkingConfig: { thinkingBudget: 0 },
    })
  })

  it('joins several text parts', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Luis, ' }, { text: '¿cómo?' }] } }] }),
    })
    expect(await generate({ ...base, fetchImpl })).toBe('Luis, ¿cómo?')
  })

  it('aborts and reports a timeout when Gemini is slower than the limit', async () => {
    const fetchImpl = vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))))

    const started = Date.now()
    const error = await generate({ ...base, timeoutMs: 40, fetchImpl }).catch((e) => e)

    expect(error).toBeInstanceOf(GeminiError)
    expect(error.reason).toBe('timeout')
    expect(Date.now() - started).toBeLessThan(500)
  })

  it('reports HTTP failures with their status and without the body or the key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => `models/x not found key=${KEY}`, json: async () => ({ error: { message: KEY } }) })

    const error = await generate({ ...base, fetchImpl }).catch((e) => e)

    expect(error).toMatchObject({ name: 'GeminiError', reason: 'http', status: 404 })
    expect(error.message).not.toContain(KEY)
  })

  it('reports a network failure without leaking details', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error(`socket hang up ${KEY}`))
    const error = await generate({ ...base, fetchImpl }).catch((e) => e)
    expect(error).toMatchObject({ reason: 'network' })
    expect(error.message).not.toContain(KEY)
  })

  it.each([
    ['no candidates', { candidates: [] }, 'empty'],
    ['empty text', { candidates: [{ content: { parts: [{ text: '  ' }] } }] }, 'empty'],
    ['no body', null, 'empty'],
    ['safety finish', { candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'x' }] } }] }, 'blocked'],
    ['blocked prompt', { promptFeedback: { blockReason: 'OTHER' } }, 'blocked'],
  ])('fails with %s', async (_label, payload, reason) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => payload })
    await expect(generate({ ...base, fetchImpl })).rejects.toMatchObject({ name: 'GeminiError', reason })
  })

  it('rejects bad input before touching the network', async () => {
    const fetchImpl = vi.fn()
    await expect(generate({ ...base, apiKey: '', fetchImpl })).rejects.toThrow(TypeError)
    await expect(generate({ ...base, model: '../evil', fetchImpl })).rejects.toThrow(TypeError)
    await expect(generate({ ...base, model: 'a/b', fetchImpl })).rejects.toThrow(TypeError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

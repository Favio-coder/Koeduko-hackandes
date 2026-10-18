import { describe, expect, it, vi } from 'vitest'
import { createGeminiGenerator, generateWithRetry } from './geminiEdge.js'

const httpError = (status) => Object.assign(new Error(`http ${status}`), { reason: 'http', status })

describe('generateWithRetry', () => {
  const sleep = vi.fn().mockResolvedValue(undefined)

  it('returns the first answer without waiting when Gemini works', async () => {
    const generateImpl = vi.fn().mockResolvedValue('ok')
    await expect(generateWithRetry({ timeoutMs: 6000 }, { generateImpl, sleep })).resolves.toBe('ok')
    expect(generateImpl).toHaveBeenCalledTimes(1)
  })

  it.each([429, 500, 503])('retries once on a transient HTTP %i, with the time that is left', async (status) => {
    const generateImpl = vi.fn().mockRejectedValueOnce(httpError(status)).mockResolvedValueOnce('ok')
    let clock = 0
    const now = () => clock
    const result = await generateWithRetry({ timeoutMs: 6000, userPrompt: 'x' }, { generateImpl, sleep: async () => { clock += 400 }, now })
    expect(result).toBe('ok')
    expect(generateImpl).toHaveBeenCalledTimes(2)
    expect(generateImpl.mock.calls[1][0]).toMatchObject({ userPrompt: 'x', timeoutMs: 5600 })
  })

  it('does not retry what will not pass by itself (400, 401, 403) or non-HTTP failures', async () => {
    for (const error of [httpError(400), httpError(403), Object.assign(new Error('t'), { reason: 'timeout' }), Object.assign(new Error('b'), { reason: 'blocked' })]) {
      const generateImpl = vi.fn().mockRejectedValue(error)
      await expect(generateWithRetry({ timeoutMs: 6000 }, { generateImpl, sleep })).rejects.toBe(error)
      expect(generateImpl).toHaveBeenCalledTimes(1)
    }
  })

  it('does not retry when little of the time budget is left, and gives up after the second failure', async () => {
    let clock = 0
    const slow = vi.fn().mockImplementation(async () => {
      clock += 5000
      throw httpError(503)
    })
    await expect(generateWithRetry({ timeoutMs: 6000 }, { generateImpl: slow, sleep, now: () => clock })).rejects.toMatchObject({ status: 503 })
    expect(slow).toHaveBeenCalledTimes(1)

    const always = vi.fn().mockRejectedValue(httpError(503))
    await expect(generateWithRetry({ timeoutMs: 6000 }, { generateImpl: always, sleep })).rejects.toMatchObject({ status: 503 })
    expect(always).toHaveBeenCalledTimes(2)
  })
})

describe('createGeminiGenerator', () => {
  it('is null without key or model, and a function otherwise', () => {
    expect(createGeminiGenerator({})).toBeNull()
    expect(createGeminiGenerator({ GEMINI_API_KEY: 'k' })).toBeNull()
    expect(typeof createGeminiGenerator({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' })).toBe('function')
  })
})

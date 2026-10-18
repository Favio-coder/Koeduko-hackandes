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

describe('generateWithRetry with a fallback model', () => {
  const httpError = (status) => Object.assign(new Error(`http ${status}`), { reason: 'http', status })

  it('retries on the fallback model when the main one is saturated (another model has its own quota)', async () => {
    const generateImpl = vi.fn().mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce('ok')
    const result = await generateWithRetry({ model: 'main-model', timeoutMs: 6000 }, { generateImpl, sleep: async () => {}, fallbackModel: 'backup-model' })
    expect(result).toBe('ok')
    expect(generateImpl.mock.calls[0][0].model).toBe('main-model')
    expect(generateImpl.mock.calls[1][0].model).toBe('backup-model')
  })

  it('keeps the same model when there is no fallback, or it is the same one', async () => {
    for (const fallbackModel of [null, 'main-model']) {
      const generateImpl = vi.fn().mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce('ok')
      await generateWithRetry({ model: 'main-model', timeoutMs: 6000 }, { generateImpl, sleep: async () => {}, fallbackModel })
      expect(generateImpl.mock.calls[1][0].model).toBe('main-model')
    }
  })
})

describe('createGeminiGenerator roles', () => {
  const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'main-model', GEMINI_JUDGE_MODEL: 'light-model', GEMINI_FALLBACK_MODEL: 'backup-model' }
  const httpError = (status) => Object.assign(new Error(`http ${status}`), { reason: 'http', status })

  it('the tutor uses the main model and the observer its own', async () => {
    const generateImpl = vi.fn().mockResolvedValue('ok')
    await createGeminiGenerator(env, { generateImpl })({ userPrompt: 'x' })
    await createGeminiGenerator(env, { role: 'judge', generateImpl, state: { coolUntil: 0 } })({ userPrompt: 'x' })
    expect(generateImpl.mock.calls.map(([call]) => call.model)).toEqual(['main-model', 'light-model'])
  })

  it('the observer falls back to the main model when it has no model of its own', async () => {
    const generateImpl = vi.fn().mockResolvedValue('ok')
    await createGeminiGenerator({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'main-model' }, { role: 'judge', generateImpl, state: { coolUntil: 0 } })({})
    expect(generateImpl.mock.calls[0][0].model).toBe('main-model')
  })

  it('after a 429 the observer pauses for a while (so it never competes with the interventions), the tutor does not', async () => {
    let clock = 1000
    const state = { coolUntil: 0 }
    const generateImpl = vi.fn().mockRejectedValue(httpError(429))
    const judge = createGeminiGenerator(env, { role: 'judge', generateImpl, state, now: () => clock })
    await expect(judge({ timeoutMs: 100 })).rejects.toMatchObject({ status: 429 })
    expect(state.coolUntil).toBeGreaterThan(clock)

    generateImpl.mockClear()
    await expect(judge({})).rejects.toMatchObject({ reason: 'cooldown' })
    expect(generateImpl).not.toHaveBeenCalled()

    clock = state.coolUntil + 1
    generateImpl.mockResolvedValue('back')
    await expect(judge({})).resolves.toBe('back')

    const tutor = createGeminiGenerator(env, { generateImpl, state: { coolUntil: 9e15 } })
    await expect(tutor({})).resolves.toBe('back')
  })

  it('is null without key or model', () => {
    expect(createGeminiGenerator({ GEMINI_MODEL: 'm' }, { role: 'judge' })).toBeNull()
    expect(createGeminiGenerator({ GEMINI_API_KEY: 'k' }, { role: 'judge' })).toBeNull()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { GeminiError } from './adapters/gemini.js'
import { fallbackMessage } from './core/interventionPolicy.js'
import { composeIntervention } from './tutor.js'

const problem = { activityId: 'p-03', skillId: 'multiplication', text: '¿Cuánto es 6 x 8?', expectedAnswer: 48 }
const signal = { type: 'SILENT_PEER', participantKey: 'luis rojas', evidence: { shares: { 'luis rojas': 0, ana: 1 } } }
const input = (generate, extra = {}) => ({ signal, problem, transcriptTail: [{ k: 'ana', x: 'hola' }], generate, timeoutMs: 80, ...extra })

describe('composeIntervention', () => {
  it('uses Gemini when its message follows the policy, cleaning the formatting', async () => {
    const generate = vi.fn().mockResolvedValue('**Luis**, ¿cómo explicarías tú el problema con tus palabras?\n')

    const result = await composeIntervention(input(generate))

    expect(result).toEqual({ message: 'Luis, ¿cómo explicarías tú el problema con tus palabras?', source: 'gemini', reason: null })
    const [{ systemInstruction, userPrompt, timeoutMs }] = generate.mock.calls[0]
    expect(systemInstruction).toMatch(/NUNCA des la respuesta/)
    expect(userPrompt).toContain('Destinatario: Luis')
    expect(timeoutMs).toBe(80)
  })

  it('never passes the expected answer to Gemini', async () => {
    const generate = vi.fn().mockResolvedValue('Luis, ¿cómo ves el problema?')
    await composeIntervention(input(generate))
    const [{ systemInstruction, userPrompt }] = generate.mock.calls[0]
    expect(`${systemInstruction}${userPrompt}`).not.toMatch(/\b48\b/)
  })

  it.each([
    ['reveals the answer', 'Luis, en el problema ¿no serán cuarenta y ocho?', 'invalid:reveals-answer'],
    ['has three sentences', 'Luis, ¿qué piensas del problema? ¿Qué datos tienes? ¿Cómo lo harías?', 'invalid:too-many-sentences'],
    ['does not name the recipient', '¿Cómo explicarías el problema con tus palabras?', 'invalid:missing-addressee'],
    ['is not a question', 'Luis, explica el problema con tus palabras.', 'invalid:no-question'],
    ['is off topic', 'Luis, ¿qué tal tu fin de semana?', 'invalid:off-topic'],
    ['is too long', `Luis, ¿cómo explicarías el problema ${'con muchísimo detalle '.repeat(12)}?`, 'invalid:too-long'],
  ])('falls back when Gemini %s', async (_label, text, reason) => {
    const result = await composeIntervention(input(vi.fn().mockResolvedValue(text)))
    expect(result).toEqual({ message: fallbackMessage(signal, { problem }), source: 'fallback', reason })
  })

  it('falls back when Gemini fails, keeping the failure reason', async () => {
    const http = await composeIntervention(input(vi.fn().mockRejectedValue(new GeminiError('http', 'Gemini respondio 503.', { status: 503 }))))
    expect(http).toMatchObject({ source: 'fallback', reason: 'http' })

    const boom = await composeIntervention(input(vi.fn().mockRejectedValue(new Error('boom'))))
    expect(boom).toMatchObject({ source: 'fallback', reason: 'error' })
  })

  it('falls back when Gemini takes longer than the limit, even if the adapter ignores it', async () => {
    const slow = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('Luis, ¿cómo ves el problema?'), 500)))

    const started = Date.now()
    const result = await composeIntervention(input(slow, { timeoutMs: 50 }))

    expect(result).toMatchObject({ source: 'fallback', reason: 'timeout' })
    expect(Date.now() - started).toBeLessThan(300)
  })

  it('falls back without calling anything when there is no generator (no API key)', async () => {
    const result = await composeIntervention(input(null))
    expect(result).toEqual({ message: fallbackMessage(signal, { problem }), source: 'fallback', reason: 'no-generator' })
  })

  it('always returns a valid fallback with no problem defined', async () => {
    const result = await composeIntervention({ signal, generate: null })
    expect(result.message).toMatch(/^Luis, .*\?$/)
    expect(result.source).toBe('fallback')
  })
})

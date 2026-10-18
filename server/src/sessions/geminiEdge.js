import { generate } from './adapters/gemini.js'

/** Errores de Gemini que suelen pasar solos (saturacion, limite por minuto, fallo del servicio). */
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504])
const RETRY_DELAY_MS = 400
/** Si despues de esperar queda menos que esto del tiempo de la llamada, no vale la pena reintentar. */
const MIN_RETRY_BUDGET_MS = 1500
const DEFAULT_BUDGET_MS = 6000
/** Tras un 429 el observador deja de llamar a Gemini este tiempo: las intervenciones por reglas tienen prioridad sobre la cuota. */
export const JUDGE_COOLDOWN_MS = 30_000

/**
 * Llama a Gemini y, si falla por algo transitorio (503 «alta demanda», 429...), reintenta UNA vez dentro del mismo
 * presupuesto de tiempo de la llamada. Si hay un modelo de respaldo, el reintento usa ese: otro modelo suele tener su propia
 * cuota, asi que un 429 del principal no se repite contra el mismo limite.
 *
 * @param {object} input lo que recibe adapters/gemini.js#generate
 * @param {{ generateImpl?: typeof generate, sleep?: (ms: number) => Promise<void>, now?: () => number, fallbackModel?: string|null }} [deps]
 */
export async function generateWithRetry(
  input,
  { generateImpl = generate, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = () => Date.now(), fallbackModel = null } = {},
) {
  const budget = Number.isFinite(input.timeoutMs) ? input.timeoutMs : DEFAULT_BUDGET_MS
  const startedAt = now()
  try {
    return await generateImpl(input)
  } catch (error) {
    if (error?.reason !== 'http' || !TRANSIENT_STATUS.has(error.status)) throw error
    // Quien no tiene apuro (el clasificador del cierre) pide una espera mas larga: un 429 por minuto no se pasa en 400 ms.
    const delay = Number.isFinite(input.retryDelayMs) ? input.retryDelayMs : RETRY_DELAY_MS
    const left = budget - (now() - startedAt) - delay
    if (left < MIN_RETRY_BUDGET_MS) throw error
    await sleep(delay)
    return generateImpl({ ...input, timeoutMs: left, ...(fallbackModel && fallbackModel !== input.model ? { model: fallbackModel } : {}) })
  }
}

/**
 * Arma el generador de Gemini a partir de un objeto de entorno (los bordes de api/ le pasan
 * process.env). Sin key o sin modelo devuelve null y el tutor responde con su mensaje de respaldo.
 *
 * - GEMINI_FALLBACK_MODEL (opcional): modelo al que pasa el reintento si el principal esta saturado.
 * - role "judge" (observador de la conversacion): usa GEMINI_JUDGE_MODEL si existe (p. ej. uno mas liviano, para no gastar la
 *   cuota del que redacta las intervenciones) y, tras un 429, se calla JUDGE_COOLDOWN_MS: no compite con las intervenciones.
 *
 * @param {Record<string, string|undefined>} env
 * @param {{ role?: 'tutor'|'judge', now?: () => number, generateImpl?: typeof generate, state?: { coolUntil: number } }} [options]
 * @returns {((input: object) => Promise<string>) | null}
 */
const sharedJudgeState = { coolUntil: 0 }

export function createGeminiGenerator(env, { role = 'tutor', now = () => Date.now(), generateImpl = generate, state = sharedJudgeState } = {}) {
  const apiKey = env.GEMINI_API_KEY?.trim()
  const main = env.GEMINI_MODEL?.trim()
  const model = (role === 'judge' ? env.GEMINI_JUDGE_MODEL?.trim() : '') || main
  const fallbackModel = env.GEMINI_FALLBACK_MODEL?.trim() || null
  if (!apiKey || !model) return null

  return async (input) => {
    if (role === 'judge' && now() < state.coolUntil) {
      throw Object.assign(new Error('Observador en pausa por limite de Gemini.'), { reason: 'cooldown' })
    }
    try {
      return await generateWithRetry({ apiKey, model, ...input }, { fallbackModel, generateImpl, now })
    } catch (error) {
      if (role === 'judge' && error?.status === 429) state.coolUntil = now() + JUDGE_COOLDOWN_MS
      throw error
    }
  }
}

import { generate } from './adapters/gemini.js'

/** Errores de Gemini que suelen pasar solos (saturacion, limite por minuto, fallo del servicio). */
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504])
const RETRY_DELAY_MS = 400
/** Si despues de esperar queda menos que esto del tiempo de la llamada, no vale la pena reintentar. */
const MIN_RETRY_BUDGET_MS = 1500
const DEFAULT_BUDGET_MS = 6000

/**
 * Llama a Gemini y, si falla por algo transitorio (503 «alta demanda», 429...), reintenta UNA vez dentro del mismo
 * presupuesto de tiempo de la llamada. Un 503 de Gemini hacia que el clasificador del cierre y alguna intervencion
 * cayeran al respaldo aunque un segundo intento habria funcionado (visto en una sesion real).
 *
 * @param {object} input lo que recibe adapters/gemini.js#generate
 * @param {{ generateImpl?: typeof generate, sleep?: (ms: number) => Promise<void>, now?: () => number }} [deps]
 */
export async function generateWithRetry(input, { generateImpl = generate, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = () => Date.now() } = {}) {
  const budget = Number.isFinite(input.timeoutMs) ? input.timeoutMs : DEFAULT_BUDGET_MS
  const startedAt = now()
  try {
    return await generateImpl(input)
  } catch (error) {
    if (error?.reason !== 'http' || !TRANSIENT_STATUS.has(error.status)) throw error
    const left = budget - (now() - startedAt) - RETRY_DELAY_MS
    if (left < MIN_RETRY_BUDGET_MS) throw error
    await sleep(RETRY_DELAY_MS)
    return generateImpl({ ...input, timeoutMs: left })
  }
}

/**
 * Arma el generador de Gemini a partir de un objeto de entorno (los bordes de api/ le pasan
 * process.env). Sin key o sin modelo devuelve null y el tutor responde con su mensaje de respaldo.
 * Asi los dos endpoints que usan Gemini comparten esto en vez de repetirlo.
 *
 * @param {Record<string, string|undefined>} env
 * @returns {((input: object) => Promise<string>) | null}
 */
export function createGeminiGenerator(env) {
  const apiKey = env.GEMINI_API_KEY?.trim()
  const model = env.GEMINI_MODEL?.trim()
  return apiKey && model ? (input) => generateWithRetry({ apiKey, model, ...input }) : null
}

import { generate } from './adapters/gemini.js'

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
  return apiKey && model ? (input) => generate({ apiKey, model, ...input }) : null
}

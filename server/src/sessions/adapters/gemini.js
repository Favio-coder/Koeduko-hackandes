/**
 * Cliente minimo de la API de Gemini (generateContent). No lee process.env: la key y el modelo
 * llegan por parametro, y fetch es inyectable para probarlo sin red.
 *
 * - La key va en el header `x-goog-api-key`, nunca en la URL (las URL terminan en logs).
 * - Hay un tiempo limite real (AbortController): si Gemini tarda, se corta y el llamador usa el
 *   mensaje de respaldo.
 * - Los errores nunca incluyen la key, el prompt ni el cuerpo de la respuesta.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export const DEFAULT_TIMEOUT_MS = 6000

/** Configuracion de generacion por defecto: respuestas cortas y poco creativas. */
export const DEFAULT_GENERATION_CONFIG = Object.freeze({ temperature: 0.4, maxOutputTokens: 200 })

export class GeminiError extends Error {
  /** @param {'timeout'|'http'|'empty'|'blocked'|'network'} reason */
  constructor(reason, message, { status = null } = {}) {
    super(message)
    this.name = 'GeminiError'
    this.reason = reason
    this.status = status
  }
}

/**
 * @param {{
 *   apiKey: string, model: string, systemInstruction: string, userPrompt: string,
 *   timeoutMs?: number, generationConfig?: object, fetchImpl?: typeof fetch,
 * }} input
 * @returns {Promise<string>} el texto generado
 */
export async function generate({
  apiKey,
  model,
  systemInstruction,
  userPrompt,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  generationConfig = {},
  fetchImpl = globalThis.fetch,
}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new TypeError('apiKey es obligatorio.')
  if (typeof model !== 'string' || !MODEL_PATTERN.test(model)) throw new TypeError('model no es valido.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetchImpl(`${BASE_URL}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { ...DEFAULT_GENERATION_CONFIG, ...generationConfig },
      }),
    })
  } catch (error) {
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      throw new GeminiError('timeout', `Gemini no respondio en ${timeoutMs} ms.`)
    }
    throw new GeminiError('network', 'No se pudo conectar con Gemini.')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new GeminiError('http', `Gemini respondio ${response.status}.`, { status: response.status })
  }

  const payload = await response.json().catch(() => null)
  if (payload?.promptFeedback?.blockReason) throw new GeminiError('blocked', 'Gemini bloqueo el pedido.')

  const candidate = payload?.candidates?.[0]
  if (candidate?.finishReason === 'SAFETY') throw new GeminiError('blocked', 'Gemini bloqueo la respuesta.')

  const text = (candidate?.content?.parts ?? [])
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim()
  if (!text) throw new GeminiError('empty', 'Gemini no devolvio texto.')
  return text
}

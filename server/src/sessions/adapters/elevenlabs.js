/**
 * Voz del tutor con ElevenLabs (texto a voz). Sin process.env: la key, la voz y el modelo llegan por parametro, y
 * fetch es inyectable para probar sin red. Nunca lanza por un fallo del servicio: devuelve { ok, status } para que
 * el tutor siga funcionando por chat si la voz falla.
 *
 * Contrato verificado contra https://elevenlabs.io/docs/api-reference/text-to-speech/convert (18-oct-2026):
 *   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_64
 *   header `xi-api-key`; body { text, model_id } -> 200 con el audio (mp3) como cuerpo binario.
 * `eleven_flash_v2_5` es el modelo de baja latencia (~75 ms de inferencia) y soporta espanol. El plan gratuito es
 * solo para uso no comercial y los formatos de mayor calidad (192 kbps) exigen un plan de pago: por eso mp3_44100_64.
 * No registra el texto (nombra a un nino) ni el audio.
 */

export const DEFAULT_MODEL_ID = 'eleven_flash_v2_5'
/** Voz de ejemplo de la documentacion oficial (voz predefinida, disponible en todas las cuentas). */
export const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'
export const OUTPUT_FORMAT = 'mp3_44100_64'
export const SYNTHESIS_TIMEOUT_MS = 6000
export const MAX_SPOKEN_CHARS = 300

const VOICE_ID_PATTERN = /^[A-Za-z0-9]{10,40}$/
const MODEL_ID_PATTERN = /^[a-z0-9_]{3,64}$/

/**
 * @param {{ apiKey: string, voiceId?: string, modelId?: string, text: string, timeoutMs?: number, fetchImpl?: typeof fetch }} input
 * @returns {Promise<{ ok: true, status: number, mp3Base64: string } | { ok: false, status: number }>}
 */
export async function synthesize({ apiKey, voiceId = DEFAULT_VOICE_ID, modelId = DEFAULT_MODEL_ID, text, timeoutMs = SYNTHESIS_TIMEOUT_MS, fetchImpl = globalThis.fetch }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new TypeError('apiKey es obligatorio.')
  if (!VOICE_ID_PATTERN.test(voiceId)) throw new TypeError('voiceId no es valido.')
  if (!MODEL_ID_PATTERN.test(modelId)) throw new TypeError('modelId no es valido.')
  const spoken = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, MAX_SPOKEN_CHARS) : ''
  if (!spoken) throw new TypeError('text es obligatorio.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey.trim(), 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: spoken, model_id: modelId }),
      signal: controller.signal,
    })
    if (!response.ok) return { ok: false, status: response.status }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0) return { ok: false, status: response.status }
    return { ok: true, status: response.status, mp3Base64: bytes.toString('base64') }
  } catch {
    return { ok: false, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}

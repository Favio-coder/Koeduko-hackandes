/**
 * Cliente minimo de la API de Recall.ai.
 *
 * No lee process.env ni defineSecret: la clave y la region llegan por parametro,
 * y fetch es inyectable, para poder probarlo sin red.
 * Verificado contra https://docs.recall.ai/reference/bot_create y bot_leave_call_create:
 *   - base:   https://<region>.recall.ai/api/v1/
 *   - auth:   "Authorization: <key>" (sin "Bearer")
 *   - crear:  POST /bot/            -> { id, ... }
 *   - salir:  POST /bot/{id}/leave_call/ (sin body)
 *   - chat:   POST /bot/{id}/send_chat_message/ con { message (1-4096, obligatorio), to = "everyone", pin = false }
 *             (bot_send_chat_message_create, SendChatMessageInputRequest). 200 con el Bot; 400 y 404 sin cuerpo.
 */

export const BOT_NAME = 'Tutor KoEduko'

/** Eventos que el webhook en tiempo real necesita. Sin audio/video crudo. */
export const REALTIME_EVENTS = [
  'transcript.data',
  'participant_events.speech_on',
  'participant_events.speech_off',
  'participant_events.join',
  'participant_events.leave',
]

const REGION_PATTERN = /^[a-z]{2}-[a-z]+-\d$/
const BOT_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/
const MAX_ERROR_BODY = 300
const MAX_CHAT_MESSAGE = 4096

export class RecallApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status: number, retryAfter?: string|null }} details
   */
  constructor(message, { status, retryAfter = null }) {
    super(message)
    this.name = 'RecallApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} es obligatorio.`)
  }
  return value
}

function apiBase(region) {
  requireText(region, 'region')
  if (!REGION_PATTERN.test(region)) throw new TypeError('region no es valida.')
  return `https://${region}.recall.ai/api/v1`
}

/**
 * Agrega el token al webhook. Recall no documenta un token en query: esta es
 * nuestra autenticacion y se valida en recallWebhook.
 */
export function withToken(webhookUrl, token) {
  const url = new URL(requireText(webhookUrl, 'webhookUrl'))
  url.searchParams.set('token', requireText(token, 'token'))
  return url.toString()
}

/**
 * Un mp3 silencioso de ~78 ms: tres tramas MPEG-1 Layer III (128 kbps, 44,1 kHz, estereo) con el cuerpo en ceros,
 * que se decodifican como silencio. Recall exige que el bot nazca con `automatic_audio_output` para poder usar
 * despues `output_audio`; la documentacion sugiere justo esto: "a short silent mp3".
 */
export function silentMp3Base64() {
  const frame = Buffer.alloc(417) // 144 * 128000 / 44100 = 417 bytes por trama
  frame[0] = 0xff
  frame[1] = 0xfb // sincronia + MPEG-1 + Layer III + sin CRC
  frame[2] = 0x90 // 128 kbps, 44,1 kHz, sin relleno
  return Buffer.concat([frame, frame, frame]).toString('base64')
}

/**
 * Body de Create Bot. Sin join_at: el bot entra de inmediato. Con `speak` el bot nace con salida de audio
 * (un clip silencioso), requisito de Recall para que despues pueda hablar con sendAudio.
 */
export function buildCreateBotBody({
  meetingUrl,
  sessionId,
  webhookUrl,
  botName = BOT_NAME,
  language = 'es',
  speak = false,
}) {
  return {
    ...(speak ? { automatic_audio_output: { in_call_recording: { data: { kind: 'mp3', b64_data: silentMp3Base64() } } } } : {}),
    meeting_url: requireText(meetingUrl, 'meetingUrl'),
    bot_name: botName,
    metadata: { sessionId: requireText(sessionId, 'sessionId') },
    recording_config: {
      transcript: {
        provider: { deepgram_streaming: { model: 'nova-3', language } },
      },
      realtime_endpoints: [
        {
          type: 'webhook',
          url: requireText(webhookUrl, 'webhookUrl'),
          events: REALTIME_EVENTS,
        },
      ],
    },
  }
}

async function call(fetchImpl, url, { apiKey, body }) {
  const headers = { Authorization: requireText(apiKey, 'apiKey'), accept: 'application/json' }
  const init = { method: 'POST', headers }
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  const response = await fetchImpl(url, init)
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, MAX_ERROR_BODY)
    throw new RecallApiError(`Recall respondio ${response.status}: ${detail}`, {
      status: response.status,
      retryAfter: response.headers?.get?.('retry-after') ?? null,
    })
  }
  return response.json()
}

/**
 * Crea el bot. No reintenta: un reintento tras una perdida de conexion ambigua
 * podria duplicar el bot; el llamador decide con su intencion local persistida.
 *
 * @returns {Promise<{ botId: string }>}
 */
export async function createBot({
  apiKey,
  region,
  meetingUrl,
  sessionId,
  webhookUrl,
  botName,
  language,
  speak = false,
  fetchImpl = globalThis.fetch,
}) {
  const body = buildCreateBotBody({ meetingUrl, sessionId, webhookUrl, botName, language, speak })
  const bot = await call(fetchImpl, `${apiBase(region)}/bot/`, { apiKey, body })
  if (typeof bot?.id !== 'string' || !bot.id) {
    throw new RecallApiError('Recall no devolvio el id del bot.', { status: 502 })
  }
  return { botId: bot.id }
}

/** Saca al bot de la reunion. Es irreversible. */
export async function leaveCall({ apiKey, region, botId, fetchImpl = globalThis.fetch }) {
  requireText(botId, 'botId')
  if (!BOT_ID_PATTERN.test(botId)) throw new TypeError('botId no es valido.')
  await call(fetchImpl, `${apiBase(region)}/bot/${botId}/leave_call/`, { apiKey })
}

/**
 * Escribe un mensaje en el chat de la reunion, visible para todos. Nunca lanza: devuelve el estado
 * HTTP para que quien llama decida (status 0 = sin respuesta: timeout o red caida).
 * No lee ni registra el texto: el mensaje menciona a un nino por su nombre.
 *
 * @returns {Promise<{ ok: boolean, status: number }>}
 */
export async function sendChatMessage({
  apiKey,
  region,
  botId,
  text,
  timeoutMs = 4000,
  fetchImpl = globalThis.fetch,
}) {
  requireText(botId, 'botId')
  if (!BOT_ID_PATTERN.test(botId)) throw new TypeError('botId no es valido.')
  const message = requireText(text, 'text').slice(0, MAX_CHAT_MESSAGE)
  const url = `${apiBase(region)}/bot/${botId}/send_chat_message/`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: requireText(apiKey, 'apiKey'), accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ message, to: 'everyone' }),
      signal: controller.signal,
    })
    return { ok: response.ok, status: response.status }
  } catch {
    return { ok: false, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Hace que el bot reproduzca un mp3 en la reunion (`POST /bot/{id}/output_audio/`, `{ kind: "mp3", b64_data }`).
 * Nunca lanza: devuelve { ok, status } (status 0 = sin respuesta).
 *
 * OJO: la documentacion de Recall dice que este endpoint es para clips cortos y que NO es para habla dinamica
 * generada en tiempo real por un TTS ni para baja latencia (para eso recomienda Output Media). Aqui se usa para UNA
 * frase corta cada >= 90 s, como experimento detras de MEET_VOICE_ENABLED: se valida en una reunion real y, si falla
 * o tarda, se deja apagado. Requiere que el bot se haya creado con `speak: true`. No registra el audio.
 *
 * @returns {Promise<{ ok: boolean, status: number }>}
 */
export async function sendAudio({ apiKey, region, botId, mp3Base64, timeoutMs = 8000, fetchImpl = globalThis.fetch }) {
  requireText(botId, 'botId')
  if (!BOT_ID_PATTERN.test(botId)) throw new TypeError('botId no es valido.')
  const data = requireText(mp3Base64, 'mp3Base64')
  const url = `${apiBase(region)}/bot/${botId}/output_audio/`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: requireText(apiKey, 'apiKey'), accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'mp3', b64_data: data }),
      signal: controller.signal,
    })
    return { ok: response.ok, status: response.status }
  } catch {
    return { ok: false, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}

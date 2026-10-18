import { ConfigError } from './errors.js'

const REQUIRED = ['RECALL_API_KEY', 'RECALL_REGION', 'RECALL_WEBHOOK_URL', 'RECALL_WEBHOOK_TOKEN']
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$)/i

/**
 * Lee la configuracion de Recall desde un objeto de entorno (se le pasa process.env
 * desde el borde HTTP). Los errores nombran variables, nunca muestran valores.
 */
export function readRecallConfig(env) {
  const missing = REQUIRED.filter((name) => typeof env[name] !== 'string' || !env[name].trim())
  if (missing.length) throw new ConfigError(missing.map((name) => `${name} (falta)`))

  let url
  try {
    url = new URL(env.RECALL_WEBHOOK_URL.trim())
  } catch {
    throw new ConfigError(['RECALL_WEBHOOK_URL (no es una URL)'])
  }
  if (url.protocol !== 'https:' || PRIVATE_HOST.test(url.hostname)) {
    throw new ConfigError(['RECALL_WEBHOOK_URL (debe ser https y publica; Recall rechaza localhost)'])
  }

  return {
    apiKey: env.RECALL_API_KEY.trim(),
    region: env.RECALL_REGION.trim(),
    webhookUrl: url.toString(),
    webhookToken: env.RECALL_WEBHOOK_TOKEN.trim(),
    language: env.RECALL_TRANSCRIPT_LANGUAGE?.trim() || 'es',
    // El bot nace con salida de audio solo si la voz esta encendida (ver readMeetVoiceConfig).
    speak: readMeetVoiceConfig(env).enabled,
  }
}

/**
 * Chat de la reunion: MEET_CHAT_ENABLED es "true" por defecto; solo "false", "0", "off" o "no"
 * lo apagan. Sin clave de Recall tampoco hay chat (el tutor sigue funcionando en la app).
 * Una variable de Vercel solo se aplica en un despliegue nuevo: apagarlo = cambiar la variable y
 * redesplegar el mismo codigo.
 */
export function readMeetChatConfig(env) {
  const flag = (env.MEET_CHAT_ENABLED ?? 'true').trim().toLowerCase()
  const apiKey = env.RECALL_API_KEY?.trim() || undefined
  return {
    enabled: !['false', '0', 'off', 'no'].includes(flag) && Boolean(apiKey),
    apiKey,
    region: env.RECALL_REGION?.trim() || undefined,
  }
}

/**
 * Observador de la conversacion (ver core/conversationJudge.js): encendido por defecto. CONVERSATION_JUDGE_ENABLED=false
 * lo apaga y el tutor vuelve a hablar solo por las senales por reglas. Necesita GEMINI_API_KEY (sin ella no hay lectura).
 */
export function readJudgeConfig(env) {
  const flag = (env.CONVERSATION_JUDGE_ENABLED ?? 'true').trim().toLowerCase()
  return { enabled: !['false', '0', 'off', 'no'].includes(flag) }
}

/**
 * Voz del tutor en la reunion (EXPERIMENTAL): MEET_VOICE_ENABLED debe ser "true" (por defecto esta APAGADA) y
 * hacen falta ELEVENLABS_API_KEY y la clave de Recall. Voz y modelo son opcionales (ver adapters/elevenlabs.js).
 * Los bots ya creados no cambian: la voz solo funciona en bots creados con el interruptor encendido.
 */
export function readMeetVoiceConfig(env) {
  const flag = (env.MEET_VOICE_ENABLED ?? 'false').trim().toLowerCase()
  const elevenKey = env.ELEVENLABS_API_KEY?.trim() || undefined
  const apiKey = env.RECALL_API_KEY?.trim() || undefined
  return {
    enabled: ['true', '1', 'on', 'yes'].includes(flag) && Boolean(elevenKey) && Boolean(apiKey),
    elevenKey,
    voiceId: env.ELEVENLABS_VOICE_ID?.trim() || undefined,
    modelId: env.ELEVENLABS_MODEL_ID?.trim() || undefined,
    apiKey,
    region: env.RECALL_REGION?.trim() || undefined,
  }
}

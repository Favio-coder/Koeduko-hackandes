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

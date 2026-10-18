import { RecallApiError, withToken } from './adapters/recall.js'
import { SessionBotError } from './errors.js'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

function fromRecallFailure(error) {
  if (error instanceof RecallApiError && (error.status === 429 || error.status >= 500)) {
    return new SessionBotError('unavailable', 'Recall no esta disponible ahora. Intenta de nuevo en un momento.')
  }
  return new SessionBotError('internal', 'No se pudo invitar al tutor a la reunion.')
}

/**
 * Invita al bot "Tutor KoEduko" a la reunion de una sesion.
 * Solo recibe el sessionId: el enlace de Meet sale de la sesion guardada, no del cliente.
 *
 * Orden: reservar la intencion local -> crear el bot en Recall -> guardar su id.
 * No reintenta la creacion: tras una perdida de conexion ambigua podria duplicar el bot.
 *
 * @param {{
 *   sessionId: unknown,
 *   nowMs: number,
 *   config: { apiKey: string, region: string, webhookUrl: string, webhookToken: string, language: string },
 *   store: { claimBot: Function, setBotId: Function, markBotFailed: Function },
 *   createBot: Function,
 * }} input
 * @returns {Promise<{ botId: string, status: 'requested' }>}
 */
export async function startSessionBot({ sessionId, nowMs, config, store, createBot }) {
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new SessionBotError('invalid-argument', 'sessionId es obligatorio.')
  }

  const { meetingUrl } = await store.claimBot(sessionId, { region: config.region, nowMs })

  let botId
  try {
    ;({ botId } = await createBot({
      apiKey: config.apiKey,
      region: config.region,
      meetingUrl,
      sessionId,
      webhookUrl: withToken(config.webhookUrl, config.webhookToken),
      language: config.language,
      speak: config.speak === true,
    }))
  } catch (error) {
    await store.markBotFailed(sessionId).catch(() => {})
    throw fromRecallFailure(error)
  }

  try {
    await store.setBotId(sessionId, botId)
  } catch {
    // El bot ya existe en Recall: se avisa con su id para poder sacarlo a mano; no se marca como fallido.
    throw new SessionBotError('internal', 'El bot se creo pero no se pudo guardar su id.', { botId })
  }

  return { botId, status: 'requested' }
}

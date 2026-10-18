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
export async function startSessionBot({ sessionId, nowMs, config, store, createBot, ensureMeeting = null }) {
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new SessionBotError('invalid-argument', 'sessionId es obligatorio.')
  }

  // Una sala sin enlace de Meet lo recibe aqui, con la cuenta de Google que el docente conecto (si lo hizo).
  let meeting = { created: false }
  try {
    meeting = (await ensureMeeting?.(sessionId)) ?? meeting
  } catch {
    meeting = { created: false, reason: 'failed' }
  }
  if (meeting.reason === 'teacher-not-connected') {
    throw new SessionBotError('failed-precondition', 'La sala no tiene enlace de Meet y el docente aun no conecto su cuenta de Google. Conectala o registra el enlace a mano.')
  }

  const { meetingUrl } = await store.claimBot(sessionId, { region: config.region, nowMs })

  // La sala puede haber nacido sin problema (la crea el algoritmo): se le asigna uno segun la habilidad en foco del grupo.
  // Si falla, el bot entra igual y el observador de la conversacion sigue funcionando sin problema.
  let problem = { assigned: false }
  try {
    problem = (await store.ensureProblem?.(sessionId)) ?? problem
  } catch {
    problem = { assigned: false, failed: true }
  }

  // Quien guia y quien aprende segun el diagnostico (solo servidor). Tampoco bloquea al bot si falla.
  let rolesAssigned
  try {
    rolesAssigned = (await store.ensureContext?.(sessionId))?.created === true
  } catch {
    rolesAssigned = false
  }

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

  return { botId, status: 'requested', meetingUrl, meetingCreated: meeting.created === true, problemAssigned: problem.assigned === true, rolesAssigned }
}

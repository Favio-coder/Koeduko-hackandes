import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { projectID } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'
import { db, requireTeacher } from '../admin.js'
import {
  SESSIONS_REGION,
  recallApiKey,
  recallLanguage,
  recallRegion,
  recallWebhookToken,
  recallWebhookUrl,
} from './config.js'
import { createBot, RecallApiError, withToken } from './adapters/recall.js'
import { canRequestBot, resolveWebhookUrl } from './core/botRequest.js'
import { isValidMeetUrl } from './core/meetUrl.js'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

/** requireTeacher lanza Error con .code; onCall lo convertiria en INTERNAL. */
async function authorizeTeacher(request) {
  try {
    return await requireTeacher(request)
  } catch (error) {
    if (error instanceof HttpsError) throw error
    const code = error?.code === 'unauthenticated' ? 'unauthenticated' : 'permission-denied'
    throw new HttpsError(code, error?.message ?? 'No autorizado.')
  }
}

/**
 * Reserva el bot antes de llamar a Recall (intencion local persistida) para que un
 * doble clic no cree dos bots. Devuelve el meetingUrl guardado en la sesion.
 */
async function claimBot(sessionRef, { region, nowMs }) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef)
    if (!snap.exists) throw new HttpsError('not-found', 'La sesion no existe.')

    const session = snap.data()
    if (!isValidMeetUrl(session.meetingUrl)) {
      throw new HttpsError(
        'failed-precondition',
        'La sesion necesita un enlace valido de Google Meet (https://meet.google.com/abc-defg-hij).',
      )
    }
    if (!canRequestBot(session.bot, nowMs)) {
      throw new HttpsError('failed-precondition', 'El tutor ya fue invitado a esta sesion.')
    }

    tx.update(sessionRef, { bot: { id: null, status: 'requested', region, requestedAtMs: nowMs } })
    return session.meetingUrl.trim()
  })
}

function failureToHttpsError(error) {
  if (error instanceof RecallApiError && (error.status === 429 || error.status >= 500)) {
    return new HttpsError('unavailable', 'Recall no esta disponible ahora. Intenta de nuevo en un momento.')
  }
  return new HttpsError('internal', 'No se pudo invitar al tutor a la reunion.')
}

/**
 * Invita al bot "Tutor KoEduko" a la reunion de la sesion.
 * Solo recibe el sessionId: el enlace de Meet sale de la sesion, no del cliente.
 *
 * @param {{ sessionId: string }} data
 * @returns {Promise<{ botId: string, status: 'requested' }>}
 */
export const startSessionBot = onCall(
  { region: SESSIONS_REGION, secrets: [recallApiKey, recallWebhookToken], timeoutSeconds: 60 },
  async (request) => {
    await authorizeTeacher(request)

    const sessionId = request.data?.sessionId
    if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
      throw new HttpsError('invalid-argument', 'sessionId es obligatorio.')
    }

    const region = recallRegion.value()
    const sessionRef = db.doc(`learningSessions/${sessionId}`)
    const meetingUrl = await claimBot(sessionRef, { region, nowMs: Date.now() })

    try {
      const webhookUrl = withToken(
        resolveWebhookUrl({
          override: recallWebhookUrl.value(),
          functionsRegion: SESSIONS_REGION,
          projectId: projectID.value(),
        }),
        recallWebhookToken.value(),
      )

      const { botId } = await createBot({
        apiKey: recallApiKey.value(),
        region,
        meetingUrl,
        sessionId,
        webhookUrl,
        language: recallLanguage.value(),
      })

      await sessionRef.update({ 'bot.id': botId })
      logger.info('startSessionBot: bot solicitado', { sessionId, botId })
      return { botId, status: 'requested' }
    } catch (error) {
      logger.error('startSessionBot: fallo al crear el bot', {
        sessionId,
        name: error?.name ?? 'Error',
        status: error?.status ?? null,
      })
      await sessionRef
        .update({ 'bot.status': 'failed' })
        .catch(() => logger.error('startSessionBot: no se pudo marcar el bot como fallido', { sessionId }))
      throw failureToHttpsError(error)
    }
  },
)

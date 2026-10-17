import { canRequestBot } from '../core/botRequest.js'
import { isValidMeetUrl } from '../core/meetUrl.js'
import { SessionBotError } from '../errors.js'

/**
 * Acceso a Firestore para sesiones. Recibe db y FieldValue ya inicializados
 * (ver firebaseAdmin.js), asi se prueba con un doble sin Firebase.
 *
 * @param {{ db: any, FieldValue: { serverTimestamp: () => unknown } }} firebase
 */
export function createSessionStore({ db, FieldValue }) {
  const sessionRef = (sessionId) => db.doc(`learningSessions/${sessionId}`)

  return {
    /** Guarda un evento en vivo. El id determinista hace idempotente el reenvio de Recall. */
    async saveLiveEvent(sessionId, eventId, event) {
      await db
        .doc(`learningSessions/${sessionId}/liveEvents/${eventId}`)
        .set({ ...event, receivedAt: FieldValue.serverTimestamp() })
    },

    /** Rol guardado en users/{uid}. El rol nunca se acepta del cliente. */
    async getUserRole(uid) {
      const snap = await db.doc(`users/${uid}`).get()
      return snap.exists ? (snap.data().role ?? null) : null
    },

    /**
     * Reserva el bot antes de llamar a Recall (intencion local persistida): un doble clic
     * no crea dos bots. Devuelve el meetingUrl guardado en la sesion, no uno del cliente.
     */
    async claimBot(sessionId, { region, nowMs }) {
      const ref = sessionRef(sessionId)
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) throw new SessionBotError('not-found', 'La sesion no existe.')

        const session = snap.data()
        if (!isValidMeetUrl(session.meetingUrl)) {
          throw new SessionBotError(
            'failed-precondition',
            'La sesion necesita un enlace valido de Google Meet (https://meet.google.com/abc-defg-hij).',
          )
        }
        if (!canRequestBot(session.bot, nowMs)) {
          throw new SessionBotError('failed-precondition', 'El tutor ya fue invitado a esta sesion.')
        }

        tx.update(ref, { bot: { id: null, status: 'requested', region, requestedAtMs: nowMs } })
        return { meetingUrl: session.meetingUrl.trim() }
      })
    },

    async setBotId(sessionId, botId) {
      await sessionRef(sessionId).update({ 'bot.id': botId })
    },

    async markBotFailed(sessionId) {
      await sessionRef(sessionId).update({ 'bot.status': 'failed' })
    },
  }
}

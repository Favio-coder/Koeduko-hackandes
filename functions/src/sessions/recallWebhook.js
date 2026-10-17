import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { SESSIONS_REGION, recallWebhookToken } from './config.js'
import { handleRecallWebhook } from './core/handleRecallWebhook.js'

/** Guarda el evento de forma idempotente: el mismo evento reenviado sobrescribe el mismo documento. */
async function saveLiveEvent(sessionId, eventId, event) {
  await db
    .doc(`learningSessions/${sessionId}/liveEvents/${eventId}`)
    .set({ ...event, receivedAt: FieldValue.serverTimestamp() })
}

/**
 * Webhook en tiempo real de Recall. Solo valida, normaliza y guarda: nada de
 * Gemini ni de senales aqui (eso va en onLiveEvent).
 */
export const recallWebhook = onRequest(
  { region: SESSIONS_REGION, secrets: [recallWebhookToken], timeoutSeconds: 30 },
  async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : null
    const body = req.method === 'POST' ? req.body : null

    const { status } = await handleRecallWebhook(
      { token, body },
      { expectedToken: recallWebhookToken.value(), saveEvent: saveLiveEvent, logger },
    )
    res.sendStatus(status)
  },
)

import { handleRecallWebhook } from '../core/handleRecallWebhook.js'

/**
 * Handler HTTP del webhook de Recall con sus dependencias inyectadas (el archivo de api/
 * las conecta con process.env, Firestore y waitUntil de Vercel).
 *
 * @param {{
 *   getExpectedToken: () => string|undefined,
 *   getStore: () => { saveLiveEvent: Function },
 *   afterSave: (saved: object) => Promise<void>,
 *   waitUntil: (promise: Promise<unknown>) => void,
 *   logger: { info: Function, warn: Function, error: Function },
 * }} deps
 */
export function createRecallWebhookHandler({ getExpectedToken, getStore, afterSave, waitUntil, logger }) {
  return async function recallWebhook(req, res) {
    const token = typeof req.query?.token === 'string' ? req.query.token : null

    // request.body es un getter que lanza si el JSON llega malformado.
    let body = null
    if (req.method === 'POST') {
      try {
        body = req.body
      } catch {
        body = null
      }
    }

    const { status } = await handleRecallWebhook(
      { token, body },
      {
        expectedToken: getExpectedToken(),
        saveEvent: (sessionId, eventId, event) => getStore().saveLiveEvent(sessionId, eventId, event),
        onSaved: (saved) =>
          waitUntil(
            Promise.resolve(afterSave(saved)).catch((error) =>
              logger.error('recallWebhook: fallo el trabajo posterior', { name: error?.name ?? 'Error' }),
            ),
          ),
        logger,
      },
    )

    res.status(status).end()
  }
}

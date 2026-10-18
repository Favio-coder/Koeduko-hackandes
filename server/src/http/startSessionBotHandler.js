import { requireTeacherFromRequest } from '../sessions/auth.js'
import { handleCors } from './cors.js'
import { sendError } from './respond.js'
import { startSessionBot } from '../sessions/startSessionBot.js'

/**
 * POST /api/start-session-bot   Authorization: Bearer <Firebase ID token>   { "sessionId": "..." }
 *
 * @param {{
 *   getFirebase: () => { auth: { verifyIdToken: Function } },
 *   createStore: (firebase: any) => any,
 *   readConfig: () => any,
 *   createBot: Function,
 *   now: () => number,
 *   logger: { info: Function, warn: Function, error: Function },
 *   allowedOrigins?: string[],
 * }} deps
 */
export function createStartSessionBotHandler({ getFirebase, createStore, readConfig, createBot, now, logger, allowedOrigins = [] }) {
  return async function startSessionBotEndpoint(req, res) {
    // CORS primero: el preflight no lleva token y las respuestas de error tambien deben poder leerse.
    if (handleCors(req, res, { allowedOrigins }).preflight) return undefined

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'method-not-allowed', message: 'Usa POST.' })
    }

    try {
      const firebase = getFirebase()
      const store = createStore(firebase)

      await requireTeacherFromRequest(req.headers?.authorization, {
        verifyIdToken: (token) => firebase.auth.verifyIdToken(token),
        getUserRole: (uid) => store.getUserRole(uid),
      })

      // request.body es un getter que lanza si el JSON llega malformado.
      let sessionId
      try {
        sessionId = req.body?.sessionId
      } catch {
        sessionId = undefined
      }

      const result = await startSessionBot({ sessionId, nowMs: now(), config: readConfig(), store, createBot })
      logger.info('startSessionBot: bot solicitado', { sessionId, botId: result.botId })
      return res.status(200).json(result)
    } catch (error) {
      return sendError(res, error, logger, 'startSessionBot')
    }
  }
}

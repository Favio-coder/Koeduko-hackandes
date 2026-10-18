import { requireSessionMember } from '../sessions/auth.js'
import { SessionBotError } from '../sessions/errors.js'
import { handleCors } from './cors.js'
import { sendError } from './respond.js'
import { startSessionBot } from '../sessions/startSessionBot.js'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

/**
 * POST /api/start-session-bot   Authorization: Bearer <Firebase ID token>   { "sessionId": "..." }
 *
 * Lo puede pedir el docente o un integrante de ESA sala (su uid figura en studentIds): asi el tutor puede entrar solo
 * cuando el primer alumno abre la sala, sin que el docente tenga que estar. Un estudiante ajeno a la sala recibe 403
 * (el mismo que si la sala no existe). Invitar dos veces no duplica el bot: claimBot lo impide dentro de una transaccion.
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
      // request.body es un getter que lanza si el JSON llega malformado.
      let sessionId
      try {
        sessionId = req.body?.sessionId
      } catch {
        sessionId = undefined
      }
      if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
        throw new SessionBotError('invalid-argument', 'sessionId es obligatorio.')
      }

      const firebase = getFirebase()
      const store = createStore(firebase)

      const { role } = await requireSessionMember(req.headers?.authorization, sessionId, {
        verifyIdToken: (token) => firebase.auth.verifyIdToken(token),
        getUserRole: (userId) => store.getUserRole(userId),
        getSession: (id) => store.getSession(id),
      })

      const result = await startSessionBot({ sessionId, nowMs: now(), config: readConfig(), store, createBot })
      logger.info('startSessionBot: bot solicitado', { sessionId, botId: result.botId, by: role, problemAssigned: result.problemAssigned })
      return res.status(200).json(result)
    } catch (error) {
      return sendError(res, error, logger, 'startSessionBot')
    }
  }
}

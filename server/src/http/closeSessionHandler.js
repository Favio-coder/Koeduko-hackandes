import { requireTeacherFromRequest } from '../sessions/auth.js'
import { closeSession } from '../sessions/closeSession.js'
import { handleCors } from './cors.js'
import { sendError } from './respond.js'

/**
 * POST /api/close-session   Authorization: Bearer <Firebase ID token>   { "sessionId": "..." }
 * Solo docente. Saca al bot, arma el reporte de competencias, lo guarda, recuerda a cada estudiante y
 * marca la sesion como completada (ver closeSession.js). Es idempotente.
 *
 * @param {{
 *   getFirebase: () => { auth: { verifyIdToken: Function } },
 *   createStore: (firebase: any) => any,
 *   createMemory: (firebase: any) => any,
 *   createGenerate: () => (Function|null),
 *   createLeaveBot: () => (((bot: object) => Promise<unknown>)|null),
 *   logger: { info: Function, warn: Function, error: Function },
 *   allowedOrigins?: string[],
 * }} deps
 */
export function createCloseSessionHandler({ getFirebase, createStore, createMemory, createGenerate, createLeaveBot, logger, allowedOrigins = [] }) {
  return async function closeSessionEndpoint(req, res) {
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

      const result = await closeSession({
        sessionId,
        store,
        memory: createMemory(firebase),
        generate: createGenerate(),
        leaveBot: createLeaveBot(),
        logger,
      })
      return res.status(200).json(result)
    } catch (error) {
      return sendError(res, error, logger, 'closeSession')
    }
  }
}

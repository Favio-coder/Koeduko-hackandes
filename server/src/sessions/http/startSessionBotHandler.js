import { requireTeacherFromRequest } from '../auth.js'
import { httpStatusFor } from '../errors.js'
import { startSessionBot } from '../startSessionBot.js'

const SERVER_MISCONFIGURED = 'Configuracion del servidor incompleta.'

/**
 * Responde con un error. Solo se devuelve el mensaje de errores escritos por nosotros
 * (`expose`); la configuracion faltante y cualquier otro error salen genericos, y el
 * detalle util queda unicamente en el log.
 */
function sendError(res, error, logger) {
  const status = httpStatusFor(error)
  logger.error('startSessionBot: peticion fallida', {
    name: error?.name ?? 'Error',
    code: error?.code ?? null,
    status,
    ...(error?.expose === true ? { detail: error.message } : {}),
    ...(error?.botId ? { botId: error.botId } : {}),
  })

  if (error?.code === 'server-misconfigured') {
    return res.status(status).json({ error: error.code, message: SERVER_MISCONFIGURED })
  }
  if (error?.expose === true) {
    return res.status(status).json({
      error: error.code,
      message: error.message,
      ...(error.botId ? { botId: error.botId } : {}),
    })
  }
  return res.status(500).json({ error: 'internal', message: 'Error interno.' })
}

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
 * }} deps
 */
export function createStartSessionBotHandler({ getFirebase, createStore, readConfig, createBot, now, logger }) {
  return async function startSessionBotEndpoint(req, res) {
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
      return sendError(res, error, logger)
    }
  }
}

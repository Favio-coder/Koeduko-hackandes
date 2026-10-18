import { requireTeacherFromRequest } from '../sessions/auth.js'
import { buildAuthUrl, signState } from '../sessions/core/googleOAuth.js'
import { SessionBotError } from '../sessions/errors.js'
import { DEV_ORIGIN, handleCors } from './cors.js'
import { sendError } from './respond.js'

/**
 * POST /api/google-connect   Authorization: Bearer <Firebase ID token de un docente>
 *   { "statusOnly": true }                  -> { connected: boolean }
 *   { "returnTo": "https://<frontend>" }    -> { url }   a donde mandar al docente para que autorice a Google
 *
 * El navegador no puede mandar el Bearer en una redireccion, asi que este paso devuelve la URL y el frontend navega a ella.
 * `returnTo` debe ser uno de los origenes permitidos (nunca un destino arbitrario) y viaja firmado en `state`.
 *
 * @param {{
 *   getFirebase: () => { auth: { verifyIdToken: Function } },
 *   createStore: (firebase: any) => any,
 *   readConfig: () => { enabled: boolean, clientId?: string, clientSecret?: string, redirectUri: string },
 *   now: () => number,
 *   logger: { info: Function, warn: Function, error: Function },
 *   allowedOrigins?: string[],
 * }} deps
 */
export function createGoogleConnectHandler({ getFirebase, createStore, readConfig, now, logger, allowedOrigins = [] }) {
  return async function googleConnectEndpoint(req, res) {
    if (handleCors(req, res, { allowedOrigins }).preflight) return undefined

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'method-not-allowed', message: 'Usa POST.' })
    }

    try {
      const firebase = getFirebase()
      const store = createStore(firebase)
      const { uid } = await requireTeacherFromRequest(req.headers?.authorization, {
        verifyIdToken: (token) => firebase.auth.verifyIdToken(token),
        getUserRole: (userId) => store.getUserRole(userId),
      })

      const config = readConfig()
      if (!config.enabled) throw new SessionBotError('unavailable', 'La conexion con Google no esta configurada en el servidor.')

      let body
      try {
        body = req.body ?? {}
      } catch {
        body = {}
      }

      if (body.statusOnly === true) {
        const connection = await store.getGoogleConnection(uid)
        return res.status(200).json({ connected: Boolean(connection?.refreshToken) })
      }

      const allowed = new Set([DEV_ORIGIN, ...allowedOrigins])
      const returnTo = typeof body.returnTo === 'string' && allowed.has(body.returnTo.replace(/\/+$/, '')) ? body.returnTo.replace(/\/+$/, '') : null
      const state = signState({ uid, ret: returnTo, nowMs: now(), secret: config.clientSecret })
      logger.info('googleConnect: autorizacion iniciada', { hasReturn: returnTo !== null })
      return res.status(200).json({ url: buildAuthUrl({ clientId: config.clientId, redirectUri: config.redirectUri, state }) })
    } catch (error) {
      return sendError(res, error, logger, 'googleConnect')
    }
  }
}

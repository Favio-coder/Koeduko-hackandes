import { verifyState } from '../sessions/core/googleOAuth.js'
import { exchangeCode } from '../sessions/adapters/googleMeet.js'
import { DEV_ORIGIN } from './cors.js'

/**
 * GET /api/google-callback?code=...&state=...   (Google redirige aqui al docente despues de autorizar)
 *
 * Es una navegacion del navegador, no una llamada con Bearer: la identidad sale del `state` firmado por el servidor en
 * /api/google-connect (uid + vencimiento + destino). Sin un `state` valido no se hace nada. El refresh token se guarda solo en
 * el servidor y jamas se devuelve ni se registra. Al terminar se redirige al frontend con ?google=connected|denied|error.
 *
 * @param {{
 *   getFirebase: () => any,
 *   createStore: (firebase: any) => any,
 *   readConfig: () => { enabled: boolean, clientId?: string, clientSecret?: string, redirectUri: string },
 *   exchange?: typeof exchangeCode,
 *   now: () => number,
 *   logger: { info: Function, warn: Function, error: Function },
 *   allowedOrigins?: string[],
 * }} deps
 */
export function createGoogleCallbackHandler({ getFirebase, createStore, readConfig, exchange = exchangeCode, now, logger, allowedOrigins = [] }) {
  return async function googleCallbackEndpoint(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).end()
    }

    const config = readConfig()
    const query = req.query ?? {}
    const verified = config.enabled ? verifyState(query.state, { nowMs: now(), secret: config.clientSecret }) : null
    if (!verified) {
      logger.warn('googleCallback: state invalido o vencido', {})
      return res.status(400).end('El enlace de autorizacion no es valido o vencio. Vuelve a intentarlo desde KoEduko.')
    }

    // Destino: el origen firmado en el state si sigue permitido; si no, el primero de la lista.
    const allowed = [DEV_ORIGIN, ...allowedOrigins]
    const origin = verified.ret && allowed.includes(verified.ret) ? verified.ret : (allowedOrigins[0] ?? DEV_ORIGIN)
    const finish = (result) => {
      res.setHeader('Location', `${origin}/sessions?google=${result}`)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(302).end()
    }

    if (typeof query.error === 'string') return finish('denied')
    if (typeof query.code !== 'string' || !query.code) return finish('error')

    try {
      const tokens = await exchange({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri, code: query.code })
      if (!tokens.refreshToken) {
        logger.warn('googleCallback: Google no devolvio refresh token', {})
        return finish('no-refresh')
      }
      await createStore(getFirebase()).saveGoogleConnection(verified.uid, { refreshToken: tokens.refreshToken, scope: tokens.scope })
      logger.info('googleCallback: cuenta de Google conectada', {})
      return finish('connected')
    } catch (error) {
      logger.error('googleCallback: fallo el intercambio', { name: error?.name ?? 'Error', status: error?.status ?? null, code: error?.code ?? null })
      return finish('error')
    }
  }
}

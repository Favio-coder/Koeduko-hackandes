import { timingSafeEqual } from 'node:crypto'
import { requireSessionMember } from '../sessions/auth.js'
import { SessionBotError } from '../sessions/errors.js'
import { handleCors } from './cors.js'
import { sendError } from './respond.js'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

function secretMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string' || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * POST /api/tick   { "sessionId": "..." }   — el latido de una sala en vivo.
 *
 * El motor solo despierta con eventos de Recall y el silencio no genera ninguno; este endpoint hace correr el reloj de la
 * sala (core/heartbeat.js) y reevalua, con lo que GROUP_SILENCE y el observador de la conversacion pueden actuar aunque nadie
 * hable. Lo llama la pantalla de la sala mientras esta abierta (docente o integrante, con su Bearer) o un cron externo con
 * la cabecera `x-tick-secret` (TICK_SECRET). Una evaluacion por sala cada 15 s como maximo, venga de cuantas pantallas venga.
 *
 * @param {{
 *   getFirebase: () => { auth: { verifyIdToken: Function } },
 *   createStore: (firebase: any) => any,
 *   afterSave: (saved: { sessionId: string, result: object }) => Promise<void>,
 *   waitUntil: (promise: Promise<unknown>) => void,
 *   getTickSecret?: () => string|undefined,
 *   now: () => number,
 *   logger: { info: Function, warn: Function, error: Function },
 *   allowedOrigins?: string[],
 * }} deps
 */
export function createTickHandler({ getFirebase, createStore, afterSave, waitUntil, getTickSecret = () => undefined, now, logger, allowedOrigins = [] }) {
  return async function tickEndpoint(req, res) {
    if (handleCors(req, res, { allowedOrigins }).preflight) return undefined

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'method-not-allowed', message: 'Usa POST.' })
    }

    try {
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

      const secret = req.headers?.['x-tick-secret']
      if (secret === undefined) {
        await requireSessionMember(req.headers?.authorization, sessionId, {
          verifyIdToken: (token) => firebase.auth.verifyIdToken(token),
          getUserRole: (uid) => store.getUserRole(uid),
          getSession: (id) => store.getSession(id),
        })
      } else if (!secretMatches(secret, getTickSecret())) {
        return res.status(401).json({ error: 'unauthenticated', message: 'Secreto invalido.' })
      }

      const result = await store.processTick(sessionId, { nowMs: now() })
      if (result.ticked && (result.intervention || result.judge)) {
        waitUntil(
          Promise.resolve(afterSave({ sessionId, result })).catch((error) =>
            logger.error('tick: fallo el trabajo posterior', { name: error?.name ?? 'Error' }),
          ),
        )
      }
      return res.status(200).json({ ticked: result.ticked, ...(result.reason ? { reason: result.reason } : {}) })
    } catch (error) {
      return sendError(res, error, logger, 'tick')
    }
  }
}

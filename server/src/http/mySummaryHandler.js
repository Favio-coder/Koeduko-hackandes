import { requireSessionMember } from '../sessions/auth.js'
import { findStudentIn, studentFeedbackOf } from '../sessions/core/studentFeedback.js'
import { SessionBotError } from '../sessions/errors.js'
import { handleCors } from './cors.js'
import { sendError } from './respond.js'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

/**
 * POST /api/my-summary   Authorization: Bearer <Firebase ID token de un alumno de la sala>   { "sessionId": "..." }
 *   -> { ready: false }                         la sala aun no se cerro
 *   -> { ready: true, feedback: null | {...} }  su devolucion (null si no se pudo identificar con certeza)
 *
 * La devolucion para el alumno sale del reporte de cierre, pero SOLO su parte y ya convertida en frases amables y fijas
 * (core/studentFeedback.js): el reporte completo, las citas, los porcentajes y lo de sus companeros nunca salen de aqui. Se
 * hace en el servidor porque summary/final solo lo lee el docente (reglas de Firestore).
 *
 * @param {{
 *   getFirebase: () => { auth: { verifyIdToken: Function } },
 *   createStore: (firebase: any) => any,
 *   logger: { info: Function, warn: Function, error: Function },
 *   allowedOrigins?: string[],
 * }} deps
 */
export function createMySummaryHandler({ getFirebase, createStore, logger, allowedOrigins = [] }) {
  return async function mySummaryEndpoint(req, res) {
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
      const { uid, role, session } = await requireSessionMember(req.headers?.authorization, sessionId, {
        verifyIdToken: (token) => firebase.auth.verifyIdToken(token),
        getUserRole: (userId) => store.getUserRole(userId),
        getSession: (id) => store.getSession(id),
      })
      if (role !== 'student') throw new SessionBotError('permission-denied', 'La devolucion es para los alumnos de la sala. El docente ve el reporte completo.')

      const summary = session?.status === 'completed' ? await store.getSummary(sessionId) : null
      if (!summary?.report) return res.status(200).json({ ready: false })

      const displayName = (session.members ?? []).find((member) => member?.studentId === uid)?.displayName ?? null
      const mine = findStudentIn(summary.report, { studentId: uid, displayName })
      return res.status(200).json({ ready: true, feedback: studentFeedbackOf(mine, summary.report) })
    } catch (error) {
      return sendError(res, error, logger, 'mySummary')
    }
  }
}

import { requireTeacherFromRequest } from '../sessions/auth.js'
import { summaryForTeacher } from '../sessions/core/classInsights.js'
import { handleCors } from './cors.js'
import { sendError } from './respond.js'

/**
 * POST /api/class-insights   Authorization: Bearer <Firebase ID token de un docente>
 *   -> { sessions, students, capacities: [{ id, nombre, con, parcial, sin, total, sinPct }], skills }
 *
 * Lo que mas cuesta en TODAS las salas del docente, acumulado al cerrar cada una (core/classInsights.js). Solo conteos: sin
 * nombres, citas ni transcripciones. Es evidencia formativa para decidir que reforzar, nunca una nota.
 *
 * @param {{
 *   getFirebase: () => { auth: { verifyIdToken: Function } },
 *   createStore: (firebase: any) => any,
 *   logger: { info: Function, warn: Function, error: Function },
 *   allowedOrigins?: string[],
 * }} deps
 */
export function createClassInsightsHandler({ getFirebase, createStore, logger, allowedOrigins = [] }) {
  return async function classInsightsEndpoint(req, res) {
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
      return res.status(200).json(summaryForTeacher(await store.getInsights(uid)))
    } catch (error) {
      return sendError(res, error, logger, 'classInsights')
    }
  }
}

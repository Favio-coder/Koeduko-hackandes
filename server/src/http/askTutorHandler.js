import { requireSessionMember } from '../sessions/auth.js'
import { problemFromSession } from '../sessions/core/liveEngine.js'
import { SessionBotError } from '../sessions/errors.js'
import { composeHint } from '../sessions/tutor.js'
import { handleCors } from './cors.js'
import { sendError } from './respond.js'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const MAX_QUESTION_CHARS = 500

/**
 * POST /api/ask-tutor   Authorization: Bearer <Firebase ID token>   { "sessionId": "...", "prompt": "..." }
 *
 * Una pista bajo demanda para un estudiante. Solo pueden usarlo el docente o un estudiante que
 * pertenezca a esa sesion. Usa el mismo adaptador de Gemini, la misma politica y el mismo respaldo
 * que el tutor en vivo, asi que NUNCA devuelve la respuesta esperada.
 *
 * Costo en Firestore: 2 lecturas (el rol y la sesion) y 1 escritura (la interaccion).
 * Nunca se registra el texto de la pregunta ni el de la pista.
 *
 * @param {{
 *   getFirebase: () => { auth: { verifyIdToken: Function } },
 *   createStore: (firebase: any) => any,
 *   getGenerate: () => (((input: object) => Promise<string>) | null),
 *   logger: { info: Function, warn: Function, error: Function },
 *   allowedOrigins?: string[],
 * }} deps
 */
export function createAskTutorHandler({ getFirebase, createStore, getGenerate, logger, allowedOrigins = [] }) {
  return async function askTutorEndpoint(req, res) {
    if (handleCors(req, res, { allowedOrigins }).preflight) return undefined

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'method-not-allowed', message: 'Usa POST.' })
    }

    try {
      // request.body es un getter que lanza si el JSON llega malformado.
      let body
      try {
        body = req.body
      } catch {
        body = undefined
      }

      const sessionId = body?.sessionId
      if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
        throw new SessionBotError('invalid-argument', 'sessionId es obligatorio.')
      }
      const question = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
      if (!question) throw new SessionBotError('invalid-argument', 'prompt es obligatorio.')
      if (question.length > MAX_QUESTION_CHARS) {
        throw new SessionBotError('invalid-argument', `La pregunta no puede pasar de ${MAX_QUESTION_CHARS} caracteres.`)
      }

      const firebase = getFirebase()
      const store = createStore(firebase)
      const { uid, session } = await requireSessionMember(req.headers?.authorization, sessionId, {
        verifyIdToken: (token) => firebase.auth.verifyIdToken(token),
        getUserRole: (userId) => store.getUserRole(userId),
        getSession: (id) => store.getSession(id),
      })

      const hint = await composeHint({ question, problem: problemFromSession(session), generate: getGenerate() })

      // Guardar la interaccion no debe quitarle la pista a quien la pidio.
      await store
        .addTutorInteraction(sessionId, { studentId: uid, sessionId, prompt: question, response: hint.message, hintLevel: 1, source: hint.source })
        .catch((error) => logger.error('askTutor: no se pudo guardar la interaccion', { name: error?.name ?? 'Error', code: error?.code ?? null }))

      logger.info('askTutor: pista', { sessionId, source: hint.source, ...(hint.reason ? { reason: hint.reason } : {}) })
      return res.status(200).json({ reply: hint.message, source: hint.source })
    } catch (error) {
      return sendError(res, error, logger, 'askTutor')
    }
  }
}

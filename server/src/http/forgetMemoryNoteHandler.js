import { requireTeacherFromRequest } from '../sessions/auth.js'
import { forgetMemoryNote } from '../sessions/forgetMemoryNote.js'
import { handleCors } from './cors.js'
import { sendError } from './respond.js'

/**
 * POST /api/forget-memory-note   Authorization: Bearer <Firebase ID token>   { "sessionId": "...", "key": "<participante>" }
 *   -> 200 { status: 'forgotten', key, alreadyForgotten }
 *   -> 503 si la memoria no respondio: la nota sigue guardada (el mensaje lo dice).
 * Solo el docente que creo la sala. La clave del estudiante y el id de la nota nunca llegan desde el navegador (ver
 * forgetMemoryNote.js).
 *
 * @param {{
 *   getFirebase: () => { auth: { verifyIdToken: Function } },
 *   createStore: (firebase: any) => any,
 *   createMemory: (firebase: any) => any,
 *   logger: { info: Function, warn: Function, error: Function },
 *   allowedOrigins?: string[],
 * }} deps
 */
export function createForgetMemoryNoteHandler({ getFirebase, createStore, createMemory, logger, allowedOrigins = [] }) {
  return async function forgetMemoryNoteEndpoint(req, res) {
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

      // request.body es un getter que lanza si el JSON llega malformado.
      let body
      try {
        body = req.body ?? {}
      } catch {
        body = {}
      }

      const result = await forgetMemoryNote({ sessionId: body.sessionId, participantKey: body.key, uid, store, memory: createMemory(firebase), logger })
      return res.status(200).json(result)
    } catch (error) {
      return sendError(res, error, logger, 'forgetMemoryNote')
    }
  }
}

import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { parseAllowedOrigins } from '../src/http/cors.js'
import { createMySummaryHandler } from '../src/http/mySummaryHandler.js'

/**
 * POST /api/my-summary   { "sessionId": "..." }
 * Authorization: Bearer <Firebase ID token de un alumno de la sala>
 * Borde: aqui se lee ALLOWED_ORIGINS. Devuelve solo la devolucion de ese alumno (frases amables, sin notas ni citas).
 */
export default createMySummaryHandler({
  getFirebase: () => getFirebase(),
  createStore: createSessionStore,
  logger: consoleLogger,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
})

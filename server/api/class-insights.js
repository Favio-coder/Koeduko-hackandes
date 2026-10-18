import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { parseAllowedOrigins } from '../src/http/cors.js'
import { createClassInsightsHandler } from '../src/http/classInsightsHandler.js'

/**
 * POST /api/class-insights
 * Authorization: Bearer <Firebase ID token de un docente>
 * Borde: aqui se lee ALLOWED_ORIGINS. Devuelve lo que mas cuesta en todas las salas del docente (solo conteos).
 */
export default createClassInsightsHandler({
  getFirebase: () => getFirebase(),
  createStore: createSessionStore,
  logger: consoleLogger,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
})

import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { readGoogleConfig } from '../src/sessions/config.js'
import { parseAllowedOrigins } from '../src/http/cors.js'
import { createGoogleCallbackHandler } from '../src/http/googleCallbackHandler.js'

/**
 * GET /api/google-callback?code=...&state=...
 * Google redirige aqui al docente despues de autorizar. Borde: aqui se leen de process.env GOOGLE_CLIENT_ID,
 * GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI y ALLOWED_ORIGINS. Guarda el refresh token solo en el servidor.
 */
export default createGoogleCallbackHandler({
  getFirebase: () => getFirebase(),
  createStore: createSessionStore,
  readConfig: () => readGoogleConfig(process.env),
  now: () => Date.now(),
  logger: consoleLogger,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
})

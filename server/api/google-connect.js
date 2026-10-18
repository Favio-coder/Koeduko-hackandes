import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { readGoogleConfig } from '../src/sessions/config.js'
import { parseAllowedOrigins } from '../src/http/cors.js'
import { createGoogleConnectHandler } from '../src/http/googleConnectHandler.js'

/**
 * POST /api/google-connect
 * Authorization: Bearer <Firebase ID token de un docente>   body: { "statusOnly": true } | { "returnTo": "https://..." }
 * Borde: aqui se leen de process.env GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_MEET_ACCESS y
 * ALLOWED_ORIGINS. Devuelve la URL de autorizacion de Google (o si el docente ya esta conectado).
 */
export default createGoogleConnectHandler({
  getFirebase: () => getFirebase(),
  createStore: createSessionStore,
  readConfig: () => readGoogleConfig(process.env),
  now: () => Date.now(),
  logger: consoleLogger,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
})

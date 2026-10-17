import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { createGeminiGenerator } from '../src/sessions/geminiEdge.js'
import { createAskTutorHandler } from '../src/sessions/http/askTutorHandler.js'
import { parseAllowedOrigins } from '../src/sessions/http/cors.js'

/**
 * POST /api/ask-tutor
 * Authorization: Bearer <Firebase ID token>   body: { "sessionId": "...", "prompt": "..." }
 * Borde: aqui se leen GEMINI_API_KEY, GEMINI_MODEL y ALLOWED_ORIGINS de process.env.
 * Solo docentes o estudiantes de esa sesion. Reemplaza a la Cloud Function askTutor.
 */
export default createAskTutorHandler({
  getFirebase: () => getFirebase(),
  createStore: createSessionStore,
  getGenerate: () => createGeminiGenerator(process.env),
  logger: consoleLogger,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
})

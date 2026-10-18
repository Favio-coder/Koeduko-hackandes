import { waitUntil } from '@vercel/functions'
import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { createLiveAfterSave } from '../src/sessions/liveAfterSave.js'
import { parseAllowedOrigins } from '../src/http/cors.js'
import { createTickHandler } from '../src/http/tickHandler.js'

/**
 * POST /api/tick   { "sessionId": "..." }
 * Authorization: Bearer <Firebase ID token de un integrante de la sala o del docente>   |   x-tick-secret: <TICK_SECRET> (cron)
 * Borde: aqui se leen TICK_SECRET y ALLOWED_ORIGINS; el trabajo posterior es el mismo del webhook (createLiveAfterSave).
 */
export default createTickHandler({
  getFirebase: () => getFirebase(),
  createStore: createSessionStore,
  afterSave: createLiveAfterSave({ getFirebase, env: process.env, logger: consoleLogger }),
  waitUntil,
  getTickSecret: () => process.env.TICK_SECRET,
  now: () => Date.now(),
  logger: consoleLogger,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
})

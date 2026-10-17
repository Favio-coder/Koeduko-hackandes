import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createBot } from '../src/sessions/adapters/recall.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { readRecallConfig } from '../src/sessions/config.js'
import { createStartSessionBotHandler } from '../src/sessions/http/startSessionBotHandler.js'

/**
 * POST /api/start-session-bot
 * Authorization: Bearer <Firebase ID token>   body: { "sessionId": "..." }
 * Borde: aqui se leen RECALL_API_KEY, RECALL_REGION, RECALL_WEBHOOK_URL y RECALL_WEBHOOK_TOKEN
 * de process.env (via readRecallConfig). Exige role == "teacher" en users/{uid}.
 */
export default createStartSessionBotHandler({
  getFirebase: () => getFirebase(),
  createStore: createSessionStore,
  readConfig: () => readRecallConfig(process.env),
  createBot,
  now: () => Date.now(),
  logger: consoleLogger,
})

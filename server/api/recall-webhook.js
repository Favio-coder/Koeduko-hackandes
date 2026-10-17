import { waitUntil } from '@vercel/functions'
import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { createAfterLiveEventSaved } from '../src/sessions/afterLiveEventSaved.js'
import { createGeminiGenerator } from '../src/sessions/geminiEdge.js'
import { createRecallWebhookHandler } from '../src/sessions/http/recallWebhookHandler.js'

const getStore = () => createSessionStore(getFirebase())

/**
 * POST /api/recall-webhook?token=...
 * Borde del webhook: aqui (y solo aqui) se leen RECALL_WEBHOOK_TOKEN, GEMINI_API_KEY, GEMINI_MODEL
 * y LOG_INTERVENTION_TEXT de process.env. Sin key o modelo de Gemini el tutor usa su mensaje de respaldo.
 */
export default createRecallWebhookHandler({
  getExpectedToken: () => process.env.RECALL_WEBHOOK_TOKEN,
  getStore,
  afterSave: createAfterLiveEventSaved({
    getStore,
    getGenerate: () => createGeminiGenerator(process.env),
    logger: consoleLogger,
    logText: process.env.LOG_INTERVENTION_TEXT === '1',
  }),
  waitUntil,
  logger: consoleLogger,
})

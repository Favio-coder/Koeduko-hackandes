import { waitUntil } from '@vercel/functions'
import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { createAfterLiveEventSaved } from '../src/sessions/afterLiveEventSaved.js'
import { readMeetChatConfig } from '../src/sessions/config.js'
import { createGeminiGenerator } from '../src/sessions/geminiEdge.js'
import { createRecallWebhookHandler } from '../src/sessions/http/recallWebhookHandler.js'

const getStore = () => createSessionStore(getFirebase())

/**
 * POST /api/recall-webhook?token=...
 * Borde del webhook: aqui (y solo aqui) se leen RECALL_WEBHOOK_TOKEN, GEMINI_API_KEY, GEMINI_MODEL
 * LOG_INTERVENTION_TEXT, MEET_CHAT_ENABLED, RECALL_API_KEY y RECALL_REGION de process.env. Sin key o modelo de Gemini el tutor usa su mensaje de respaldo.
 */
export default createRecallWebhookHandler({
  getExpectedToken: () => process.env.RECALL_WEBHOOK_TOKEN,
  getStore,
  afterSave: createAfterLiveEventSaved({
    getStore,
    getGenerate: () => createGeminiGenerator(process.env),
    logger: consoleLogger,
    getChat: () => readMeetChatConfig(process.env),
    logText: process.env.LOG_INTERVENTION_TEXT === '1',
  }),
  waitUntil,
  logger: consoleLogger,
})

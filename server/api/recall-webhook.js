import { waitUntil } from '@vercel/functions'
import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { createAfterLiveEventSaved } from '../src/sessions/afterLiveEventSaved.js'
import { readMeetChatConfig } from '../src/sessions/config.js'
import { createGeminiGenerator } from '../src/sessions/geminiEdge.js'
import { createMemoryFromEnv } from '../src/sessions/memoryEdge.js'
import { createRecallWebhookHandler } from '../src/sessions/http/recallWebhookHandler.js'

const getStore = () => createSessionStore(getFirebase())

/**
 * POST /api/recall-webhook?token=...
 * Borde del webhook: aqui (y solo aqui) se leen de process.env RECALL_WEBHOOK_TOKEN, GEMINI_API_KEY, GEMINI_MODEL,
 * LOG_INTERVENTION_TEXT, MEET_CHAT_ENABLED, RECALL_API_KEY, RECALL_REGION, ATOMICMEMORY_API_URL, ATOMICMEMORY_API_KEY
 * y MEMORY_ENABLED. Sin key o modelo de Gemini el tutor usa su mensaje de respaldo; sin memoria, habla sin notas.
 */
export default createRecallWebhookHandler({
  getExpectedToken: () => process.env.RECALL_WEBHOOK_TOKEN,
  getStore,
  afterSave: createAfterLiveEventSaved({
    getStore,
    getGenerate: () => createGeminiGenerator(process.env),
    logger: consoleLogger,
    getMemory: () => createMemoryFromEnv(process.env, { getFirebase, logger: consoleLogger }),
    getChat: () => readMeetChatConfig(process.env),
    logText: process.env.LOG_INTERVENTION_TEXT === '1',
  }),
  waitUntil,
  logger: consoleLogger,
})

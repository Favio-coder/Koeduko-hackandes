import { waitUntil } from '@vercel/functions'
import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { generate } from '../src/sessions/adapters/gemini.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { createAfterLiveEventSaved } from '../src/sessions/afterLiveEventSaved.js'
import { createRecallWebhookHandler } from '../src/sessions/http/recallWebhookHandler.js'

/** Gemini solo si hay key y modelo configurados; si no, el tutor responde con su mensaje de respaldo. */
function geminiGenerator() {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL
  return apiKey && model ? (input) => generate({ apiKey, model, ...input }) : null
}

const getStore = () => createSessionStore(getFirebase())

/**
 * POST /api/recall-webhook?token=...
 * Borde del webhook: aqui (y solo aqui) se leen RECALL_WEBHOOK_TOKEN, GEMINI_API_KEY, GEMINI_MODEL
 * y LOG_INTERVENTION_TEXT de process.env.
 */
export default createRecallWebhookHandler({
  getExpectedToken: () => process.env.RECALL_WEBHOOK_TOKEN,
  getStore,
  afterSave: createAfterLiveEventSaved({
    getStore,
    getGenerate: geminiGenerator,
    logger: consoleLogger,
    logText: process.env.LOG_INTERVENTION_TEXT === '1',
  }),
  waitUntil,
  logger: consoleLogger,
})

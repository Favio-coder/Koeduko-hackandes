import { waitUntil } from '@vercel/functions'
import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { afterLiveEventSaved } from '../src/sessions/afterLiveEventSaved.js'
import { createRecallWebhookHandler } from '../src/sessions/http/recallWebhookHandler.js'

/**
 * POST /api/recall-webhook?token=...
 * Borde del webhook: aqui (y solo aqui) se lee RECALL_WEBHOOK_TOKEN de process.env.
 */
export default createRecallWebhookHandler({
  getExpectedToken: () => process.env.RECALL_WEBHOOK_TOKEN,
  getStore: () => createSessionStore(getFirebase()),
  afterSave: afterLiveEventSaved,
  waitUntil,
  logger: consoleLogger,
})

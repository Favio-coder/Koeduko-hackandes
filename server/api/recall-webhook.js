import { waitUntil } from '@vercel/functions'
import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { createLiveAfterSave } from '../src/sessions/liveAfterSave.js'
import { createRecallWebhookHandler } from '../src/http/recallWebhookHandler.js'

const getStore = () => createSessionStore(getFirebase())

/**
 * POST /api/recall-webhook?token=...
 * Borde del webhook: aqui (y solo aqui) se lee RECALL_WEBHOOK_TOKEN; el resto del entorno (GEMINI_*, MEET_*, ELEVENLABS_*,
 * RECALL_*, ATOMICMEMORY_*, CONVERSATION_JUDGE_ENABLED, LOG_INTERVENTION_TEXT...) lo lee createLiveAfterSave con process.env.
 * Sin key o modelo de Gemini el tutor usa su mensaje de respaldo; sin memoria, habla sin notas; sin voz o sin key de
 * ElevenLabs, no hay voz. Cuando se va la ultima persona de la sala, la sesion se cierra sola.
 */
export default createRecallWebhookHandler({
  getExpectedToken: () => process.env.RECALL_WEBHOOK_TOKEN,
  getStore,
  afterSave: createLiveAfterSave({ getFirebase, env: process.env, logger: consoleLogger }),
  waitUntil,
  logger: consoleLogger,
})

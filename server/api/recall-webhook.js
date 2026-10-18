import { waitUntil } from '@vercel/functions'
import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { createAfterLiveEventSaved } from '../src/sessions/afterLiveEventSaved.js'
import { closeSession } from '../src/sessions/closeSession.js'
import { readJudgeConfig, readMeetChatConfig, readMeetVoiceConfig } from '../src/sessions/config.js'
import { createGeminiGenerator } from '../src/sessions/geminiEdge.js'
import { createMemoryFromEnv } from '../src/sessions/memoryEdge.js'
import { createRecallWebhookHandler } from '../src/http/recallWebhookHandler.js'

const getStore = () => createSessionStore(getFirebase())

/**
 * POST /api/recall-webhook?token=...
 * Borde del webhook: aqui (y solo aqui) se leen de process.env RECALL_WEBHOOK_TOKEN, GEMINI_API_KEY, GEMINI_MODEL,
 * LOG_INTERVENTION_TEXT, MEET_CHAT_ENABLED, CONVERSATION_JUDGE_ENABLED, MEET_VOICE_ENABLED, ELEVENLABS_API_KEY,
 * RECALL_API_KEY, RECALL_REGION, ATOMICMEMORY_API_URL, ATOMICMEMORY_API_KEY y MEMORY_ENABLED. Sin key o modelo de
 * Gemini el tutor usa su mensaje de respaldo; sin memoria, habla sin notas. Sin MEET_VOICE_ENABLED o sin key de
 * ElevenLabs, no hay voz. Cuando se va la ultima persona de la sala, la sesion se cierra sola (misma logica que
 * /api/close-session, pero sin docente: la dispara el propio evento de Recall).
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
    getVoice: () => readMeetVoiceConfig(process.env),
    getJudge: () => readJudgeConfig(process.env),
    // El observador usa su propio modelo (GEMINI_JUDGE_MODEL) y se calla un rato tras un 429: no le quita cuota a las intervenciones.
    getJudgeGenerate: () => createGeminiGenerator(process.env, { role: 'judge' }),
    closeSessionFor: (sessionId) =>
      closeSession({
        sessionId,
        store: getStore(),
        memory: createMemoryFromEnv(process.env, { getFirebase, logger: consoleLogger }),
        generate: createGeminiGenerator(process.env),
        // El bot sale solo 2 s despues de que se va el ultimo humano (automatic_leave): intentar sacarlo daria un 400 inutil.
        leaveBot: null,
        logger: consoleLogger,
      }),
    logText: process.env.LOG_INTERVENTION_TEXT === '1',
  }),
  waitUntil,
  logger: consoleLogger,
})

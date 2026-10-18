import { createSessionStore } from './adapters/sessionStore.js'
import { createAfterLiveEventSaved } from './afterLiveEventSaved.js'
import { closeSession } from './closeSession.js'
import { readJudgeConfig, readMeetChatConfig, readMeetVoiceConfig } from './config.js'
import { createGeminiGenerator } from './geminiEdge.js'
import { createMemoryFromEnv } from './memoryEdge.js'

/**
 * El trabajo posterior a evaluar una sala en vivo (redactar, entregar por chat y voz, observador, cierre automatico). Lo usan
 * el webhook de Recall (cuando llega un evento) y el latido /api/tick (cuando pasa el tiempo en silencio): asi los dos hacen
 * exactamente lo mismo. El entorno entra por parametro; solo los bordes de api/ leen process.env.
 *
 * @param {{ getFirebase: () => any, env: Record<string, string|undefined>, logger: any }} deps
 */
export function createLiveAfterSave({ getFirebase, env, logger }) {
  const getStore = () => createSessionStore(getFirebase())
  const memory = () => createMemoryFromEnv(env, { getFirebase, logger })
  return createAfterLiveEventSaved({
    getStore,
    getGenerate: () => createGeminiGenerator(env),
    logger,
    getMemory: memory,
    getChat: () => readMeetChatConfig(env),
    getVoice: () => readMeetVoiceConfig(env),
    getJudge: () => readJudgeConfig(env),
    // El observador usa su propio modelo (GEMINI_JUDGE_MODEL) y se calla un rato tras un 429: no le quita cuota a las intervenciones.
    getJudgeGenerate: () => createGeminiGenerator(env, { role: 'judge' }),
    closeSessionFor: (sessionId) =>
      closeSession({
        sessionId,
        store: getStore(),
        memory: memory(),
        generate: createGeminiGenerator(env),
        // El bot sale solo 2 s despues de que se va el ultimo humano (automatic_leave): intentar sacarlo daria un 400 inutil.
        leaveBot: null,
        logger,
      }),
    logText: env.LOG_INTERVENTION_TEXT === '1',
  })
}

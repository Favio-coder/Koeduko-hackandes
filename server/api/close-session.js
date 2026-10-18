import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { leaveCall } from '../src/sessions/adapters/recall.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { readRecallConfig } from '../src/sessions/config.js'
import { createGeminiGenerator } from '../src/sessions/geminiEdge.js'
import { parseAllowedOrigins } from '../src/sessions/http/cors.js'
import { createCloseSessionHandler } from '../src/sessions/http/closeSessionHandler.js'
import { createMemoryFromEnv } from '../src/sessions/memoryEdge.js'

/**
 * POST /api/close-session
 * Authorization: Bearer <Firebase ID token>   body: { "sessionId": "..." }
 * Borde: aqui se leen de process.env RECALL_API_KEY y RECALL_REGION (para sacar al bot), GEMINI_API_KEY y GEMINI_MODEL
 * (clasificar frases dudosas), ATOMICMEMORY_API_URL, ATOMICMEMORY_API_KEY y MEMORY_ENABLED (memoria) y ALLOWED_ORIGINS.
 * Exige role == "teacher" en users/{uid}. Sin Recall configurado el cierre sigue sin sacar al bot (queda registrado).
 */
export default createCloseSessionHandler({
  getFirebase: () => getFirebase(),
  createStore: createSessionStore,
  createMemory: (firebase) => createMemoryFromEnv(process.env, { getFirebase: () => firebase, logger: consoleLogger }),
  createGenerate: () => createGeminiGenerator(process.env),
  createLeaveBot: () => {
    const apiKey = process.env.RECALL_API_KEY?.trim()
    const region = process.env.RECALL_REGION?.trim()
    if (!apiKey || !region) return null
    return (bot) => leaveCall({ apiKey, region: bot.region ?? region, botId: bot.id })
  },
  logger: consoleLogger,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
})

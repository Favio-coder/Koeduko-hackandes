import { getFirebase } from '../src/firebaseAdmin.js'
import { consoleLogger } from '../src/logger.js'
import { createSessionStore } from '../src/sessions/adapters/sessionStore.js'
import { parseAllowedOrigins } from '../src/http/cors.js'
import { createForgetMemoryNoteHandler } from '../src/http/forgetMemoryNoteHandler.js'
import { createMemoryFromEnv } from '../src/sessions/memoryEdge.js'

/**
 * POST /api/forget-memory-note
 * Authorization: Bearer <Firebase ID token>   body: { "sessionId": "...", "key": "<participante del reporte>" }
 * Borde: aqui se leen ATOMICMEMORY_API_URL, ATOMICMEMORY_API_KEY y ALLOWED_ORIGINS. MEMORY_ENABLED=false NO impide olvidar
 * lo que ya se guardo. Solo el docente que creo la sala.
 */
export default createForgetMemoryNoteHandler({
  getFirebase: () => getFirebase(),
  createStore: createSessionStore,
  createMemory: (firebase) => createMemoryFromEnv(process.env, { getFirebase: () => firebase, logger: consoleLogger }, { forNotesAlreadySaved: true }),
  logger: consoleLogger,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
})

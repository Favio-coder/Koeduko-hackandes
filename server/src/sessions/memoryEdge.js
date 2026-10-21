import { createAtomicMemory } from './adapters/atomicMemory.js'
import { createFirestoreMemory } from './adapters/firestoreMemory.js'
import { createMemory } from './adapters/memory.js'

/**
 * Arma la memoria por estudiante a partir de un objeto de entorno (los bordes de api/ le pasan
 * process.env), igual que geminiEdge.js para Gemini.
 *
 *  - ATOMICMEMORY_API_URL + ATOMICMEMORY_API_KEY -> AtomicMemory como principal, Firestore de respaldo.
 *  - sin ellas                                   -> solo el respaldo en Firestore.
 *  - MEMORY_ENABLED=false (o 0, off, no)         -> sin memoria (null): el tutor habla sin notas.
 *    `forNotesAlreadySaved: true` lo ignora: apagar la memoria deja de guardar y de recordar, pero lo ya
 *    guardado se tiene que poder olvidar igual (lo usa forget-memory-note).
 *
 * @param {Record<string, string|undefined>} env
 * @param {{ getFirebase: () => { db: any, FieldValue: any }, logger: { info: Function } }} deps
 * @param {{ forNotesAlreadySaved?: boolean }} [options]
 * @returns {{ name: string, remember: Function, recall: Function, forget: Function } | null}
 */
export function createMemoryFromEnv(env, { getFirebase, logger }, { forNotesAlreadySaved = false } = {}) {
  const flag = (env.MEMORY_ENABLED ?? 'true').trim().toLowerCase()
  if (!forNotesAlreadySaved && ['false', '0', 'off', 'no'].includes(flag)) return null

  const { db, FieldValue } = getFirebase()
  const fallback = createFirestoreMemory({ db, FieldValue, logger })

  const apiUrl = env.ATOMICMEMORY_API_URL?.trim()
  const apiKey = env.ATOMICMEMORY_API_KEY?.trim()
  if (!apiUrl || !apiKey) return createMemory({ primary: fallback })

  return createMemory({ primary: createAtomicMemory({ apiUrl, apiKey, logger }), fallback })
}

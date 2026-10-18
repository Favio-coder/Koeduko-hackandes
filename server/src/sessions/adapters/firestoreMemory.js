import { withTimeout } from '../timeout.js'
import { MAX_NOTES, MAX_NOTE_CHARS, MAX_REMEMBER_CHARS, RECALL_TIMEOUT_MS, REMEMBER_TIMEOUT_MS } from './atomicMemory.js'

/**
 * Respaldo de la memoria en Firestore (students/{key}/memory), con la MISMA interfaz que AtomicMemory.
 * Solo lo toca el Admin SDK: students/{id} tiene reglas para el cliente, pero esta subcoleccion cae
 * en la regla final que lo niega todo.
 *
 * recall no busca por significado: devuelve lo mas reciente (el respaldo es deliberadamente simple).
 * Costo: remember = 1 escritura; recall = hasta MAX_NOTES lecturas.
 *
 * @param {{ db: any, FieldValue: { serverTimestamp: () => unknown }, logger?: { info: Function } }} firebase
 */
export function createFirestoreMemory({ db, FieldValue, logger = { info() {} } }) {
  // La clave puede ser un uid o "<scope>:<hash>"; un "/" romperia la ruta del documento.
  const collectionOf = (studentKey) => db.collection(`students/${String(studentKey).replace(/[^A-Za-z0-9:_.-]/g, '_')}/memory`)
  const reasonOf = (error) => (error?.name === 'TimeoutError' ? 'timeout' : `error:${error?.code ?? error?.name ?? 'unknown'}`)

  return {
    name: 'firestore',

    async remember(studentKey, text, { timeoutMs = REMEMBER_TIMEOUT_MS } = {}) {
      const content = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
      if (!studentKey || !content || content.length > MAX_REMEMBER_CHARS) return { ok: false, reason: 'invalid' }
      try {
        await withTimeout(collectionOf(studentKey).add({ text: content, createdAt: FieldValue.serverTimestamp() }), timeoutMs)
        return { ok: true }
      } catch (error) {
        logger.info('firestoreMemory: remember fallo', { reason: reasonOf(error) })
        return { ok: false, reason: reasonOf(error) }
      }
    },

    async recall(studentKey, _query, { timeoutMs = RECALL_TIMEOUT_MS } = {}) {
      if (!studentKey) return []
      try {
        const snap = await withTimeout(collectionOf(studentKey).orderBy('createdAt', 'desc').limit(MAX_NOTES).get(), timeoutMs)
        return snap.docs
          .map((doc) => doc.data()?.text)
          .filter((text) => typeof text === 'string' && text.trim())
          .map((text) => text.slice(0, MAX_NOTE_CHARS))
      } catch (error) {
        logger.info('firestoreMemory: recall fallo', { reason: reasonOf(error) })
        return []
      }
    },
  }
}

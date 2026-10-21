/**
 * Memoria por estudiante: un proveedor principal (AtomicMemory) y, si esta, uno de respaldo (Firestore).
 * Misma interfaz que los dos:
 *   remember(studentKey, text) -> { ok, via?: string, id?: string, reason?: string }   (nunca lanza)
 *   recall(studentKey, query)  -> string[]                                 (nunca lanza)
 *   forget(studentKey, { via, id }) -> { ok, reason?: string }             (nunca lanza)
 *
 *  - remember: prueba el principal; si falla o tarda, guarda en el respaldo para no perder el dato.
 *  - recall:   consulta el principal; si falla o no devuelve nada, consulta el respaldo (donde pudo
 *              haber quedado algo cuando el principal estaba caido).
 *  - forget:   borra la nota en el proveedor donde quedo (`via` de remember), nunca en el otro.
 */
export function createMemory({ primary, fallback = null }) {
  return {
    name: fallback ? `${primary.name}+${fallback.name}` : primary.name,

    async remember(studentKey, text, options) {
      const first = await primary.remember(studentKey, text, options)
      if (first.ok) return { ok: true, via: primary.name, ...(first.id ? { id: first.id } : {}) }
      if (!fallback || first.reason === 'invalid') return { ...first, via: primary.name }

      const second = await fallback.remember(studentKey, text, options)
      return second.ok
        ? { ok: true, via: fallback.name, ...(second.id ? { id: second.id } : {}), primaryReason: first.reason }
        : { ok: false, via: fallback.name, reason: second.reason, primaryReason: first.reason }
    },

    async recall(studentKey, query, options) {
      const notes = await primary.recall(studentKey, query, options)
      if (notes.length > 0 || !fallback) return notes
      return fallback.recall(studentKey, query, options)
    },

    async forget(studentKey, { via, id } = {}, options) {
      const provider = [primary, fallback].find((candidate) => candidate && candidate.name === via)
      if (!provider || typeof provider.forget !== 'function') return { ok: false, reason: 'unsupported' }
      return provider.forget(studentKey, id, options)
    },
  }
}

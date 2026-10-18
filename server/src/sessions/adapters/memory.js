/**
 * Memoria por estudiante: un proveedor principal (AtomicMemory) y, si esta, uno de respaldo (Firestore).
 * Misma interfaz que los dos:
 *   remember(studentKey, text) -> { ok, via?: string, reason?: string }   (nunca lanza)
 *   recall(studentKey, query)  -> string[]                                 (nunca lanza)
 *
 *  - remember: prueba el principal; si falla o tarda, guarda en el respaldo para no perder el dato.
 *  - recall:   consulta el principal; si falla o no devuelve nada, consulta el respaldo (donde pudo
 *              haber quedado algo cuando el principal estaba caido).
 */
export function createMemory({ primary, fallback = null }) {
  return {
    name: fallback ? `${primary.name}+${fallback.name}` : primary.name,

    async remember(studentKey, text, options) {
      const first = await primary.remember(studentKey, text, options)
      if (first.ok) return { ok: true, via: primary.name }
      if (!fallback || first.reason === 'invalid') return { ...first, via: primary.name }

      const second = await fallback.remember(studentKey, text, options)
      return second.ok
        ? { ok: true, via: fallback.name, primaryReason: first.reason }
        : { ok: false, via: fallback.name, reason: second.reason, primaryReason: first.reason }
    },

    async recall(studentKey, query, options) {
      const notes = await primary.recall(studentKey, query, options)
      if (notes.length > 0 || !fallback) return notes
      return fallback.recall(studentKey, query, options)
    },
  }
}

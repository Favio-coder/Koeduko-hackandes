/**
 * Copia de deterministicId de src/shared/lib/utils.js.
 * Las Cloud Functions solo despliegan functions/, asi que no se importa desde src/.
 */

/** Genera un id estable a partir de las partes indicadas. */
export function deterministicId(prefix, parts) {
  const suffix = parts.map((p) => String(p).replace(/[^a-zA-Z0-9]/g, '')).join('')
  return `${prefix}-${suffix}`.toLowerCase()
}

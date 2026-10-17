/**
 * Utilidades puras compartidas. Sin dependencias de Firebase ni React.
 */

export function clamp(value, min = 0, max = 1) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function round(value, decimals = 4) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Media de una lista de numeros. Devuelve 0 si esta vacia. */
export function average(values) {
  if (!values.length) return 0
  return values.reduce((acc, v) => acc + v, 0) / values.length
}

/** Hash determinista de cadena -> entero de 32 bits. Usado para desempates reproducibles. */
export function hashString(input) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Genera un id estable a partir de las partes indicadas. */
export function deterministicId(prefix, parts) {
  const suffix = parts.map((p) => String(p).replace(/[^a-zA-Z0-9]/g, '')).join('')
  return `${prefix}-${suffix}`.toLowerCase()
}

export function formatDate(timestamp) {
  if (!timestamp) return '--'
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp)
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
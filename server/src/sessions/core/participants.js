/**
 * Utilidades puras para identificar participantes de Meet.
 */

/** Minusculas, sin tildes y con espacios colapsados. null/undefined -> ''. */
export function normalizeName(name) {
  if (typeof name !== 'string') return ''
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

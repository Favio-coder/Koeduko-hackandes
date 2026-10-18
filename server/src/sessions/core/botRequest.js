/**
 * Reglas puras para invitar al bot. El tiempo entra como parametro.
 */

/** Una peticion "requested" sin id mas vieja que esto se considera abandonada (la funcion murio). */
export const STALE_REQUEST_MS = 60_000

/**
 * Evita duplicar bots: solo se puede invitar si no hay bot, si el anterior termino
 * o fallo, o si una peticion quedo colgada sin id.
 *
 * @param {{ id?: string|null, status?: string, requestedAtMs?: number }|null|undefined} bot
 * @param {number} nowMs
 */
export function canRequestBot(bot, nowMs) {
  if (!bot || !bot.status) return true
  if (bot.status === 'failed' || bot.status === 'done') return true
  if (bot.status === 'requested' && !bot.id) {
    const requestedAtMs = Number.isFinite(bot.requestedAtMs) ? bot.requestedAtMs : 0
    return nowMs - requestedAtMs > STALE_REQUEST_MS
  }
  return false
}

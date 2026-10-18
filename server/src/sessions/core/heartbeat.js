/**
 * Latido: hace correr el reloj de la sesion cuando NO llegan eventos. PURO (el reloj entra por parametro).
 *
 * El motor solo despierta con un evento de Recall, pero el silencio no genera ninguno: si todos callan, nada lo
 * evalua (ni GROUP_SILENCE ni el observador de la conversacion). Cada evento real deja un ANCLA { t, wallMs } (el tiempo de
 * sesion del evento y el reloj real en que llego). Un tick calcula cuanto tiempo de sesion paso desde esa ancla:
 *     t = ancla.t + (ahora - ancla.wallMs) / 1000
 * y el motor evalua con ese tiempo.
 */

/** Como maximo una evaluacion por latido cada TICK_MIN_MS por sala, aunque haya varias pantallas abiertas. */
export const TICK_MIN_MS = 15_000
/** Si el ultimo evento real es mas viejo que esto, la sala ya termino (o se perdio la conexion): no se hace hablar al tutor. */
export const TICK_MAX_IDLE_MS = 10 * 60 * 1000

/** @returns {{ t: number, wallMs: number }} la ancla que deja un evento real */
export const anchorOf = (state, nowMs) => ({ t: state.lastT, wallMs: nowMs })

/**
 * Decide si toca evaluar y con que tiempo de sesion.
 *
 * @param {{ lastT: number, anchor?: { t: number, wallMs: number }|null, lastTickWallMs?: number|null }} state
 * @param {number} nowMs reloj real
 * @returns {{ run: false, reason: 'no-anchor'|'throttled'|'idle' } | { run: true, t: number }}
 */
export function tickPlan(state, nowMs) {
  const anchor = state?.anchor
  if (!anchor || !Number.isFinite(anchor.t) || !Number.isFinite(anchor.wallMs)) return { run: false, reason: 'no-anchor' }
  if (Number.isFinite(state.lastTickWallMs) && nowMs - state.lastTickWallMs < TICK_MIN_MS) return { run: false, reason: 'throttled' }
  const idleMs = nowMs - anchor.wallMs
  if (idleMs < 0 || idleMs > TICK_MAX_IDLE_MS) return { run: false, reason: 'idle' }
  // El tiempo de sesion nunca retrocede: si ya habia avanzado (otro tick), se conserva.
  return { run: true, t: Math.max(state.lastT, anchor.t + idleMs / 1000) }
}

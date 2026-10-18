/**
 * Presentacion de las intervenciones del tutor en lenguaje simple. Pura: sin Firebase ni React.
 *
 * La evidencia que guarda el servidor son numeros ("shares: 0"); aqui se convierten en una frase
 * que un docente entienda de un vistazo. Nunca se muestra ni se espera `expectedAnswer`: el
 * servidor ya no la guarda (la leen los estudiantes de la sesion).
 */

/** Etiqueta corta y tono visual (tonos del kit de UI) por tipo de senal. */
export const SIGNAL_META = Object.freeze({
  SILENT_PEER: { label: 'Invitó a participar', tone: 'info' },
  DOMINANCE: { label: 'Equilibró la palabra', tone: 'warning' },
  STUCK: { label: 'Ayudó a avanzar', tone: 'warning' },
  WRONG_ANSWER: { label: 'Pidió verificar', tone: 'danger' },
  CORRECT_ANSWER: { label: 'Pidió explicar', tone: 'success' },
  GROUP_SILENCE: { label: 'Silencio del grupo', tone: 'neutral' },
  CONVERSATION: { label: 'Leyó la conversación', tone: 'info' },
})

/** Por qué intervino el observador de la conversación, según el tipo que reportó. */
const CONVERSATION_REASONS = Object.freeze({
  confusion: 'Se notó confusión en la conversación',
  atasco: 'La conversación se quedó atascada',
  'error-conceptual': 'Se oyó una idea que conviene revisar',
  'fuera-de-tema': 'La conversación se alejó del tema',
  excluido: 'Alguien quedó fuera de la conversación',
})

const FALLBACK_META = { label: 'Intervención', tone: 'neutral' }

export const metaOf = (signal) => SIGNAL_META[signal] ?? FALLBACK_META

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

/** 55 -> "55 s"; 180 -> "3 min". */
export function formatSpan(seconds) {
  if (!isNumber(seconds) || seconds <= 0) return ''
  return seconds < 90 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`
}

/** El periodo que de verdad se miro: la ventana, o menos si la persona llevaba menos tiempo en la sala. */
function observedSpan(evidence) {
  const span = [evidence.windowSec, evidence.presentSec].filter(isNumber)
  return span.length > 0 ? formatSpan(Math.min(...span)) : ''
}

const inLast = (span) => (span ? ` en los últimos ${span}` : '')

/**
 * Explica POR QUE intervino el tutor.
 *
 * @param {{ signal?: string, targetName?: string|null, participantKey?: string|null, evidence?: object }} intervention
 * @returns {string} '' si no hay nada que explicar
 */
export function describeEvidence(intervention) {
  const { signal, participantKey } = intervention ?? {}
  const evidence = intervention?.evidence ?? {}
  const name = intervention?.targetName || 'Un estudiante'
  const share = participantKey && evidence.shares ? evidence.shares[participantKey] : undefined
  const percent = isNumber(share) ? Math.round(share * 100) : null

  switch (signal) {
    case 'SILENT_PEER':
      return percent === null ? `${name} casi no habló` : `${name} habló ${percent}%${inLast(observedSpan(evidence))}`
    case 'DOMINANCE':
      return percent === null ? `${name} habló la mayor parte del tiempo` : `${name} habló ${percent}% de la conversación${inLast(observedSpan(evidence))}`
    case 'WRONG_ANSWER':
      return Array.isArray(evidence.numbers) && evidence.numbers.length > 0 ? `${name} dijo ${evidence.numbers.join(' o ')}` : `${name} dio una respuesta`
    case 'CORRECT_ANSWER':
      return `${name} dio una respuesta que coincide con lo esperado`
    case 'STUCK':
      return isNumber(evidence.markers) ? `Se oyeron ${evidence.markers} frases de confusión${inLast(formatSpan(evidence.windowSec))}` : 'Se oyeron frases de confusión'
    case 'GROUP_SILENCE':
      return isNumber(evidence.silenceSec) ? `Llevan ${Math.round(evidence.silenceSec)} s sin hablar` : 'Dejaron de hablar'
    case 'CONVERSATION':
      return CONVERSATION_REASONS[evidence.kind] ?? 'El tutor leyó la conversación y vio que convenía hablar'
    default:
      return ''
  }
}

/**
 * Hora relativa corta a partir de milisegundos. `nowMs` entra por parametro (sin Date.now()).
 * @returns {string} "ahora", "hace 12 s", "hace 3 min"...
 */
export function timeAgo(createdMs, nowMs) {
  if (!isNumber(createdMs) || !isNumber(nowMs)) return ''
  const seconds = Math.max(0, Math.round((nowMs - createdMs) / 1000))
  if (seconds < 5) return 'ahora'
  if (seconds < 90) return `hace ${seconds} s`
  return seconds < 5400 ? `hace ${Math.round(seconds / 60)} min` : `hace ${Math.round(seconds / 3600)} h`
}

/** Estado del tutor en la reunion, a partir de `bot.status` de la sesion. */
export const BOT_STATUS_META = Object.freeze({
  none: { label: 'Tutor no invitado', tone: 'neutral' },
  requested: { label: 'Tutor invitado: admítelo en Meet', tone: 'warning' },
  in_call: { label: 'Tutor en la reunión', tone: 'success', dot: true },
  done: { label: 'Tutor terminó', tone: 'neutral' },
  failed: { label: 'El tutor no pudo entrar', tone: 'danger' },
})

export const botStatusMeta = (status) => BOT_STATUS_META[status] ?? BOT_STATUS_META.none

/** El docente puede invitar de nuevo salvo mientras el tutor esta pedido o en la llamada. */
export const canInvite = (status) => status !== 'requested' && status !== 'in_call'

import { EVIDENCE_STATE } from '@/shared/constants/contracts'

/** Como se ve cada estado de una capacidad. Es evidencia, nunca una nota. */
export const STATE_META = Object.freeze({
  [EVIDENCE_STATE.WITH]: { label: 'Con evidencia', tone: 'success' },
  [EVIDENCE_STATE.PARTIAL]: { label: 'Evidencia parcial', tone: 'warning' },
  [EVIDENCE_STATE.NONE]: { label: 'Sin evidencia suficiente', tone: 'neutral' },
})

export const stateMeta = (state) => STATE_META[state] ?? STATE_META[EVIDENCE_STATE.NONE]

/** Segundo de la sesion como m:ss ("0:24", "12:05"). */
export function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * Avisos para el docente sobre lo que NO salio bien al cerrar (el cierre nunca se rompe, pero hay cosas
 * que conviene saber, por ejemplo que el tutor sigue en la reunion). Lista vacia si todo salio bien.
 *
 * @param {{ leaveCall?: string, classifier?: string, memory?: { enabled?: boolean, failed?: number, skipped?: number } }|null|undefined} steps
 * @returns {string[]}
 */
export function closeNotes(steps) {
  if (!steps) return []
  const notes = []
  if (typeof steps.leaveCall === 'string' && steps.leaveCall.startsWith('failed')) {
    notes.push('No se pudo sacar al tutor de la reunión. Sácalo desde Meet.')
  }
  if (typeof steps.classifier === 'string' && steps.classifier.startsWith('failed')) {
    notes.push('La IA no pudo clasificar algunas frases: este reporte usa solo reglas.')
  }
  const failed = (steps.memory?.failed ?? 0) + (steps.memory?.skipped ?? 0)
  if (steps.memory?.enabled && failed > 0) {
    notes.push(`No se pudo guardar la memoria de ${failed} ${failed === 1 ? 'estudiante' : 'estudiantes'}: el tutor no lo recordará en la próxima sesión.`)
  }
  return notes
}

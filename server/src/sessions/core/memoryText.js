/**
 * Texto corto y factual que se guarda en la memoria de un estudiante al cerrar la sesion, sacado del
 * reporte de competencias. Pura.
 *
 * Reglas: una sola oracion; sin transcripciones, sin citas, sin el nombre del nino y sin la respuesta
 * esperada; describe lo observado, no lo califica. Ejemplo:
 *   "Sesión accept-001, multiplicación: comunicó 28% del tiempo; usó estrategia correcta; sin evidencia de argumentación."
 */

import { CAPABILITY_IDS, EVIDENCE_STATE } from './competencies.js'

const SKILL_LABELS = Object.freeze({
  addition: 'suma',
  subtraction: 'resta',
  multiplication: 'multiplicación',
  division: 'división',
  fraction: 'fracciones',
  estimation: 'estimación',
})

const stateOf = (student, id) => student.capacidades.find((c) => c.id === id)?.estado ?? EVIDENCE_STATE.NONE

/**
 * @param {{ sessionId: string, problem?: { skillId?: string|null }|null, student: { resumen: { talkPct: number }, capacidades: object[] } }} input
 * @returns {string}
 */
export function memoryTextOf({ sessionId, problem = null, student }) {
  const skill = SKILL_LABELS[problem?.skillId] ?? 'matemática'

  const strategy = stateOf(student, CAPABILITY_IDS.ESTRATEGIAS)
  const translate = stateOf(student, CAPABILITY_IDS.TRADUCE)
  const argue = stateOf(student, CAPABILITY_IDS.ARGUMENTA)

  const parts = [
    `comunicó ${student.resumen.talkPct}% del tiempo`,
    strategy === EVIDENCE_STATE.WITH
      ? 'usó estrategia correcta'
      : strategy === EVIDENCE_STATE.PARTIAL
        ? 'intentó una estrategia sin llegar al resultado'
        : 'sin evidencia de estrategia de cálculo',
  ]
  if (translate === EVIDENCE_STATE.WITH) parts.push('planteó la operación con números')
  else if (translate === EVIDENCE_STATE.PARTIAL) parts.push('planteó la operación solo en parte')
  parts.push(
    argue === EVIDENCE_STATE.WITH ? 'argumentó con razones' : argue === EVIDENCE_STATE.PARTIAL ? 'argumentó en parte' : 'sin evidencia de argumentación',
  )

  return `Sesión ${sessionId}, ${skill}: ${parts.join('; ')}.`
}

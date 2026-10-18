/**
 * Devolucion para el ALUMNO al terminar la sesion. PURA y determinista.
 *
 * El reporte de cierre es para el docente (evidencia por capacidad, con citas). Un nino no debe ver eso: aqui se convierte,
 * para SU parte solamente, en frases amables y fijas: lo que hizo bien y que probar la proxima vez.
 *
 * Reglas: nunca una nota (AD/A/B/C), nunca una comparacion con un companero, nunca porcentajes de habla, nunca la respuesta del
 * problema, y las citas textuales no se muestran. El texto sale de una tabla fija, no de lo que dijo (no puede filtrar nada).
 */

import { CAPABILITY_IDS, EVIDENCE_STATE } from './competencies.js'
import { normalizeName } from './participants.js'

export const STUDENT_NOTE = 'Esto es una ayuda para que sigas aprendiendo, no es una nota.'

const PHRASES = Object.freeze({
  [CAPABILITY_IDS.TRADUCE]: {
    [EVIDENCE_STATE.WITH]: 'Planteaste la operación con los números del problema.',
    [EVIDENCE_STATE.PARTIAL]: 'Empezaste a plantear la operación. La próxima vez cuenta qué números vas a usar.',
    [EVIDENCE_STATE.NONE]: 'Para la próxima: di qué datos tiene el problema y qué operación usarías.',
  },
  [CAPABILITY_IDS.COMUNICA]: {
    [EVIDENCE_STATE.WITH]: 'Explicaste en voz alta lo que pensabas.',
    [EVIDENCE_STATE.PARTIAL]: 'Compartiste tus ideas. Puedes explicarlas con un poco más de detalle.',
    [EVIDENCE_STATE.NONE]: 'Para la próxima: anímate a decir en voz alta lo que piensas, aunque no estés seguro.',
  },
  [CAPABILITY_IDS.ESTRATEGIAS]: {
    [EVIDENCE_STATE.WITH]: 'Usaste una estrategia de cálculo que funcionó.',
    [EVIDENCE_STATE.PARTIAL]: 'Probaste una estrategia. Revisa cada paso para llegar hasta el resultado.',
    [EVIDENCE_STATE.NONE]: 'Para la próxima: prueba un camino (contar, sumar, multiplicar) y revisa paso a paso.',
  },
  [CAPABILITY_IDS.ARGUMENTA]: {
    [EVIDENCE_STATE.WITH]: 'Diste razones de por qué tu resultado tiene sentido.',
    [EVIDENCE_STATE.PARTIAL]: 'Diste una razón. La próxima vez cuéntanos por qué tu resultado tiene sentido.',
    [EVIDENCE_STATE.NONE]: 'Para la próxima: intenta explicar por qué crees que tu resultado es correcto.',
  },
})

/**
 * Busca a la persona en el reporte: por su uid si la sesion la enlazo, o por su nombre en Meet (el mismo que usa el motor).
 * Un primer nombre solo vale si es unico en el reporte. Devuelve null si no hay certeza: es mejor no mostrar nada que mostrar lo de otro.
 *
 * @param {{ estudiantes?: { key: string, studentId?: string|null }[] }} report
 * @param {{ studentId?: string|null, displayName?: string|null }} who
 */
export function findStudentIn(report, { studentId = null, displayName = null }) {
  const students = Array.isArray(report?.estudiantes) ? report.estudiantes : []
  if (studentId) {
    const byId = students.find((s) => s.studentId === studentId)
    if (byId) return byId
  }
  const name = normalizeName(displayName ?? '')
  if (!name) return null
  const exact = students.find((s) => s.key === name)
  if (exact) return exact
  const first = name.split(' ')[0]
  const sameFirst = students.filter((s) => String(s.key).split(' ')[0] === first)
  return sameFirst.length === 1 ? sameFirst[0] : null
}

/**
 * @param {{ key: string, capacidades?: { id: string, estado: string }[] }|null} student su parte del reporte
 * @param {{ problema?: { text?: string }|null }} [report]
 * @returns {{ title: string, problem: string|null, strengths: string[], nextSteps: string[], note: string }|null}
 */
export function studentFeedbackOf(student, report = {}) {
  if (!student) return null
  const strengths = []
  const nextSteps = []
  for (const capability of student.capacidades ?? []) {
    const phrase = PHRASES[capability.id]?.[capability.estado]
    if (!phrase) continue
    if (capability.estado === EVIDENCE_STATE.NONE) nextSteps.push(phrase)
    else if (capability.estado === EVIDENCE_STATE.PARTIAL) {
      strengths.push(phrase.split('. ')[0].replace(/\.?$/, '.'))
      nextSteps.push(phrase.includes('. ') ? phrase.split('. ').slice(1).join('. ') : phrase)
    } else strengths.push(phrase)
  }
  return {
    title: 'Tu sesión',
    problem: typeof report?.problema?.text === 'string' && report.problema.text ? report.problema.text : null,
    strengths,
    nextSteps,
    note: STUDENT_NOTE,
  }
}

import { describe, expect, it } from 'vitest'
import { CAPABILITY_IDS, EVIDENCE_STATE } from './competencies.js'
import { STUDENT_NOTE, findStudentIn, studentFeedbackOf } from './studentFeedback.js'

const cap = (id, estado) => ({ id, estado })
const student = (key, capacidades, extra = {}) => ({ key, name: key, studentId: null, resumen: { talkPct: 80, talkSec: 40, turns: 3, estimated: false }, capacidades, ...extra })
const report = {
  problema: { text: 'Hay 8 bolsas con 11 caramelos cada una. ¿Cuántos caramelos hay en total?' },
  estudiantes: [
    student('ana torres', [cap(CAPABILITY_IDS.TRADUCE, EVIDENCE_STATE.WITH), cap(CAPABILITY_IDS.COMUNICA, EVIDENCE_STATE.PARTIAL), cap(CAPABILITY_IDS.ESTRATEGIAS, EVIDENCE_STATE.NONE), cap(CAPABILITY_IDS.ARGUMENTA, EVIDENCE_STATE.NONE)], { studentId: 'u1' }),
    student('luis perez', [cap(CAPABILITY_IDS.TRADUCE, EVIDENCE_STATE.NONE)], { studentId: 'u2' }),
  ],
}

describe('findStudentIn: only the person who asks, and only with certainty', () => {
  it('finds by uid first, then by Meet name, then by a unique first name', () => {
    expect(findStudentIn(report, { studentId: 'u2' }).key).toBe('luis perez')
    expect(findStudentIn(report, { displayName: 'Ana Torres' }).key).toBe('ana torres')
    expect(findStudentIn(report, { displayName: 'Luis' }).key).toBe('luis perez')
  })

  it('returns null instead of guessing when it is ambiguous or unknown', () => {
    const twins = { estudiantes: [student('ana a', []), student('ana b', [])] }
    expect(findStudentIn(twins, { displayName: 'Ana' })).toBeNull()
    expect(findStudentIn(report, { displayName: 'Pedro' })).toBeNull()
    expect(findStudentIn(report, {})).toBeNull()
    expect(findStudentIn(null, { studentId: 'u1' })).toBeNull()
  })
})

describe('studentFeedbackOf', () => {
  it('turns the states into kind sentences: what went well and what to try next', () => {
    const feedback = studentFeedbackOf(report.estudiantes[0], report)
    expect(feedback.title).toBe('Tu sesión')
    expect(feedback.problem).toContain('8 bolsas')
    expect(feedback.strengths).toEqual(['Planteaste la operación con los números del problema.', 'Compartiste tus ideas.'])
    expect(feedback.nextSteps).toEqual([
      'Puedes explicarlas con un poco más de detalle.',
      'Para la próxima: prueba un camino (contar, sumar, multiplicar) y revisa paso a paso.',
      'Para la próxima: intenta explicar por qué crees que tu resultado es correcto.',
    ])
    expect(feedback.note).toBe(STUDENT_NOTE)
  })

  it('never shows grades, percentages, quotes, comparisons or the answer', () => {
    const quoted = student('ana torres', [{ id: CAPABILITY_IDS.TRADUCE, estado: EVIDENCE_STATE.WITH, evidencia: [{ cita: 'son ochenta y ocho' }] }])
    const text = JSON.stringify(studentFeedbackOf(quoted, report))
    expect(text).not.toMatch(/AD\b|\bA\b nivel|\bB\b|\bC\b|%|80|ochenta|88|mejor que|peor que|compañero|Luis/i)
  })

  it('has something kind to say even when there was no evidence at all', () => {
    const empty = studentFeedbackOf(student('ana', [cap(CAPABILITY_IDS.TRADUCE, EVIDENCE_STATE.NONE), cap(CAPABILITY_IDS.COMUNICA, EVIDENCE_STATE.NONE)]), report)
    expect(empty.strengths).toEqual([])
    expect(empty.nextSteps).toHaveLength(2)
    expect(empty.note).toBe(STUDENT_NOTE)
  })

  it('returns null without a student, ignores unknown capabilities and tolerates a report without problem', () => {
    expect(studentFeedbackOf(null)).toBeNull()
    expect(studentFeedbackOf(student('x', [cap('inventada', EVIDENCE_STATE.WITH)]), {})).toMatchObject({ problem: null, strengths: [], nextSteps: [] })
  })
})

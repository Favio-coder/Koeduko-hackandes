import { describe, expect, it } from 'vitest'
import { assertAvailable, buildMatchingContract, grade, publicAssessment, validateAssessment, validateResult } from '../../../../server/assessments/domain.js'

const course = { studentIds: ['student-1', 'student-2'] }
const question = (id, skillId, maxScore, correctAnswer = 0) => ({ questionId: id, skillId, maxScore, correctAnswer, prompt: 'Pregunta válida', type: 'multiple_choice', options: ['Sí', 'No'], explanation: '' })
const definition = () => ({ id: 'exam-1', title: 'Diagnóstico', courseId: 'course-1', competencyId: 'resuelve-problemas-cantidad', type: 'diagnostic', scale: 20, maxScore: 20, attemptLimit: 1, durationMinutes: 0, weightPercent: 0, feedbackMode: 'after_close', startsAt: new Date(Date.now() - 10000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), studentIds: course.studentIds, questions: [question('q1', 'addition', 5), question('q2', 'addition', 5), question('q3', 'subtraction', 5, 1), question('q4', 'fraction', 5)] })

describe('validación y publicación', () => {
  it('normaliza preguntas, asignaciones y orden sin confiar en campos de calificación', () => {
    const a = validateAssessment({ ...definition(), overallScore: 999 }, course, true)
    expect(a.questions.map(q => q.order)).toEqual([0, 1, 2, 3])
    expect(a.overallScore).toBeUndefined()
  })
  it.each([
    ['sin preguntas', { questions: [] }], ['sin estudiantes', { studentIds: [] }],
    ['asignación ajena', { studentIds: ['outsider'] }], ['suma incorrecta', { maxScore: 19 }],
    ['retroalimentación inmediata en examen', { feedbackMode: 'immediate' }],
    ['peso arbitrario', { weightPercent: 101 }], ['intentos inválidos', { attemptLimit: 0 }],
  ])('rechaza publicación: %s', (_, changes) => expect(() => validateAssessment({ ...definition(), ...changes }, course, true)).toThrow())
  it.each([
    { skillId: 'invented' }, { correctAnswer: 9 }, { maxScore: 0 }, { maxScore: 0.1 },
    { type: 'open' }, { prompt: '' }, { options: ['Igual', ' Igual '] },
    { type: 'true_false', options: ['Sí', 'No'] },
  ])('rechaza pregunta inválida %j', changes => {
    const a = definition(); a.questions[0] = { ...a.questions[0], ...changes }
    expect(() => validateAssessment(a, course, true)).toThrow()
  })
  it('guarda borrador vacío sin permitir su publicación', () => expect(validateAssessment({ ...definition(), questions: [] }, course).questions).toEqual([]))
  it('acepta catálogo configurable y verdadero/falso', () => {
    const a = { ...definition(), maxScore: 1, questions: [{ ...question('tf', 'custom', 1), type: 'true_false', options: ['Verdadero', 'Falso'] }] }
    expect(validateAssessment(a, { ...course, skills: [{ id: 'custom', label: 'Propio' }] }, true).questions).toHaveLength(1)
  })
  it('no expone claves, explicaciones ni matrícula a estudiantes', () => {
    const publicData = publicAssessment(definition())
    expect(publicData.studentIds).toBeUndefined()
    expect(publicData.questions.every(q => !('correctAnswer' in q) && !('explanation' in q))).toBe(true)
  })
})

describe('calificación determinista y contrato v1.0', () => {
  it('calcula nota bruta, mastery y evidencia real sin habilidades ausentes', () => {
    const result = grade(definition(), 'student-1', { q1: 0, q2: 1, q3: 1, q4: 0 })
    expect(result.overallScore).toBe(15)
    expect(result.skills).toEqual([
      { skillId: 'addition', score: 5, maxScore: 10, mastery: 0.5, evidenceCount: 2 },
      { skillId: 'subtraction', score: 5, maxScore: 5, mastery: 1, evidenceCount: 1 },
      { skillId: 'fraction', score: 5, maxScore: 5, mastery: 1, evidenceCount: 1 },
    ])
  })
  it('rechaza respuestas incompletas o desconocidas', () => {
    expect(() => grade(definition(), 'student-1', { q1: 0 })).toThrow()
    expect(() => grade(definition(), 'student-1', { q1: 0, q2: 0, q3: 1, q4: 0, injected: 1 })).toThrow()
  })
  it('genera exactamente el contrato con dos resultados y sumas consistentes', () => {
    const a = { ...definition(), status: 'finalized' }
    const rows = course.studentIds.map(studentId => ({ studentId, resultStatus: 'graded', result: grade(a, studentId, { q1: 0, q2: 1, q3: 0, q4: 0 }) }))
    const output = buildMatchingContract(a, rows, '2026-10-17T22:00:00Z')
    expect(Object.keys(output)).toEqual(['schemaVersion', 'courseId', 'assessmentId', 'competencyId', 'generatedAt', 'status', 'students'])
    expect(output.schemaVersion).toBe('1.0')
    expect(output.students).toHaveLength(2)
    for (const r of output.students) expect(() => validateResult(r)).not.toThrow()
    expect(() => buildMatchingContract({ ...a, status: 'closed' }, rows)).toThrow()
    expect(() => buildMatchingContract(a, rows.slice(0, 1))).toThrow()
    expect(() => buildMatchingContract(a, [{ ...rows[0], activeAttemptId: 'active' }, rows[1]])).toThrow()
    expect(() => buildMatchingContract(a, [{ studentId: 'student-1' }, rows[1]])).toThrow()
    expect(() => validateResult({ ...rows[0].result, overallScore: 20 })).toThrow()
    expect(() => validateResult({ ...rows[0].result, skills: [{ skillId: 'addition', score: 0, maxScore: 0, mastery: 0, evidenceCount: 0 }] })).toThrow()
  })
  it('rechaza fuera de plazo y estados no publicados', () => {
    expect(() => assertAvailable({ ...definition(), status: 'published' })).not.toThrow()
    for (const status of ['draft', 'closed', 'finalized']) expect(() => assertAvailable({ ...definition(), status })).toThrow()
    expect(() => assertAvailable({ ...definition(), status: 'published' }, Date.now() + 172800000)).toThrow()
  })
})

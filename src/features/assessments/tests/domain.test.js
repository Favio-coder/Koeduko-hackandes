import { describe, expect, it } from 'vitest'
import { assertAvailable, buildMatchingContract, courseAreas, grade, publicAssessment, validateAssessment, validateResult } from '../../../../server/assessments/domain.js'
import { calculateAreaAverage, normalizeGrade20 } from '../../../../server/assessments/gradebook.js'

const course = { studentIds: ['student-1', 'student-2'], areas: [{ id: 'area-1', label: 'Matemática' }] }
const question = (id, skillId, maxScore, correctAnswer = 0) => ({ questionId: id, skillId, maxScore, correctAnswer, prompt: `Pregunta ${id}`, type: 'multiple_choice', options: ['Sí', 'No'], explanation: '' })
const definition = () => ({ id: 'exam-1', title: 'Diagnóstico', description: '', courseId: 'course-1', areaId: 'area-1', competencyId: 'resuelve-problemas-cantidad', type: 'diagnostic', scale: 20, maxScore: 20, attemptLimit: 1, durationMinutes: 30, weightPercent: 0, feedbackMode: 'after_close', startsAt: new Date(Date.now() - 10000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), studentIds: course.studentIds, questions: [question('q1', 'addition', 5), question('q2', 'addition', 5), question('q3', 'subtraction', 5, 1), question('q4', 'fraction', 5)] })

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
  it('limita la competencia al catálogo autorizado del curso', () => {
    const a = definition()
    expect(() => validateAssessment({ ...a, competencyId: 'otra-competencia' }, course)).toThrow(/autorizada/)
    expect(validateAssessment(
      { ...a, competencyId: 'otra-competencia' },
      { ...course, competencies: [{ id: 'resuelve-problemas-cantidad', label: 'Cantidad' }, { id: 'otra-competencia', label: 'Otra' }] },
    ).competencyId).toBe('otra-competencia')
  })
  it('limita el área al catálogo ACL del curso y valida ese catálogo', () => {
    expect(validateAssessment(definition(), course).areaId).toBe('area-1')
    expect(() => validateAssessment({ ...definition(), areaId: 'another-area' }, course)).toThrow(/área autorizada/)
    expect(() => courseAreas({ areas: [{ id: 'area-1', label: 'A' }, { id: 'area-1', label: 'Duplicada' }] })).toThrow(/áreas duplicadas/)
  })
  it('valida el peso académico explícito sin reutilizar weightPercent', () => {
    expect(validateAssessment(
      { ...definition(), academicWeightPercent: 35 },
      course,
    ).academicWeightPercent).toBe(35)
    expect(validateAssessment(
      { ...definition(), academicWeightPercent: null },
      course,
    ).academicWeightPercent).toBeNull()
    expect(() => validateAssessment(
      { ...definition(), academicWeightPercent: 0 },
      course,
    )).toThrow(/peso académico/)
    expect(() => validateAssessment(
      { ...definition(), academicWeightPercent: 101 },
      course,
    )).toThrow(/peso académico/)
  })
  it('acepta campos opcionales válidos y rechaza textos excesivos', () => {
    expect(validateAssessment({ ...definition(), description: 'Contexto' }, course).description).toBe('Contexto')
    expect(() => validateAssessment({ ...definition(), description: 'x'.repeat(3001) }, course)).toThrow(/descripción/)
    expect(() => validateAssessment({ ...definition(), title: 'x'.repeat(201) }, course)).toThrow(/Nombre/)
  })
  it('rechaza alternativas duplicadas sin distinguir mayúsculas ni espacios', () => {
    const assessment = definition()
    assessment.questions[0] = { ...assessment.questions[0], options: ['Respuesta', '  respuesta  '] }
    expect(() => validateAssessment(assessment, course)).toThrow(/alternativas/i)
  })
  it('rechaza respuestas múltiples para una pregunta de selección única', () => {
    const assessment = definition()
    assessment.questions[0] = { ...assessment.questions[0], correctAnswer: [0, 1] }
    expect(() => validateAssessment(assessment, course, true)).toThrow(/respuesta correcta/i)
  })
  it('rechaza alternativas en blanco al publicar, pero permite el borrador incompleto', () => {
    const assessment = definition()
    assessment.questions[0] = { ...assessment.questions[0], options: ['Sí', '  '] }
    expect(() => validateAssessment(assessment, course, true)).toThrow(/alternativas/i)
    expect(validateAssessment(assessment, course).questions[0].options).toEqual(['Sí', ''])
  })
  it('permite guardar preguntas incompletas en borrador, pero no publicarlas', () => {
    const assessment = definition()
    assessment.questions[0] = { ...assessment.questions[0], prompt: '', options: ['Sí', ''], correctAnswer: 0 }
    expect(validateAssessment(assessment, course).questions[0].prompt).toBe('')
    expect(() => validateAssessment(assessment, course, true)).toThrow(/enunciado|alternativas/i)
  })
  it('bloquea enunciados exactamente duplicados tras normalizar texto', () => {
    const assessment = definition()
    assessment.questions[1] = { ...assessment.questions[1], prompt: '  PREGUNTA   Q1 ' }
    expect(() => validateAssessment(assessment, course)).toThrow(/preguntas duplicadas/i)
  })
  it.each([
    ['duración cero', { durationMinutes: 0, id: undefined }],
    ['duración decimal', { durationMinutes: 2.5 }],
    ['intentos no numéricos', { attemptLimit: 'uno' }],
    ['fecha inválida', { endsAt: 'no-es-fecha' }],
  ])('rechaza %s', (_, changes) => {
    expect(() => validateAssessment({ ...definition(), ...changes }, course)).toThrow()
  })
  it('no expone claves, explicaciones ni matrícula a estudiantes', () => {
    const publicData = publicAssessment(definition())
    expect(publicData.studentIds).toBeUndefined()
    expect(publicData.questions.every(q => !('correctAnswer' in q) && !('explanation' in q))).toBe(true)
  })
})

describe('calificación determinista y contrato v1.0', () => {
  it('normaliza máximos distintos antes de promediar 10/20 y 16/20', () => {
    const first = {
      resultStatus: 'graded',
      result: { studentId: 'student-1', overallScore: 10, maxScore: 20, skills: [{ skillId: 'a', score: 10, maxScore: 20, mastery: 0.5, evidenceCount: 1 }] },
    }
    const second = {
      resultStatus: 'graded',
      result: { studentId: 'student-1', overallScore: 32, maxScore: 40, skills: [{ skillId: 'a', score: 32, maxScore: 40, mastery: 0.8, evidenceCount: 1 }] },
    }
    expect(normalizeGrade20(first.result)).toBe(10)
    expect(normalizeGrade20(second.result)).toBe(16)
    expect(calculateAreaAverage([first, second]).average20).toBe(13)
  })
  it('promedia ponderaciones relativas y omite notas pendientes sin convertirlas en cero', () => {
    const gradeRecord = (score, weight, resultStatus = 'graded') => ({
      resultStatus,
      academicWeightPercent: weight,
      result: resultStatus === 'graded'
        ? { studentId: 'student-1', overallScore: score, maxScore: 20, skills: [{ skillId: 'a', score, maxScore: 20, mastery: score / 20, evidenceCount: 1 }] }
        : null,
    })
    const average = calculateAreaAverage([
      gradeRecord(10, 25),
      gradeRecord(16, 75),
      gradeRecord(0, null, 'pending'),
    ])
    expect(average.average20).toBe(14.5)
    expect(average.method).toBe('weighted')
    expect(average.pendingCount).toBe(1)
  })
  it('rechaza promedios ponderados con configuración parcial en vez de omitir notas', () => {
    const valid = { studentId: 'student-1', overallScore: 10, maxScore: 20, skills: [{ skillId: 'a', score: 10, maxScore: 20, mastery: 0.5, evidenceCount: 1 }] }
    const average = calculateAreaAverage([
      { resultStatus: 'graded', result: valid, academicWeightPercent: 50 },
      { resultStatus: 'graded', result: valid, academicWeightPercent: null },
    ])
    expect(average.average20).toBeNull()
    expect(average.configurationError).toMatch(/Todas las evaluaciones calificadas/)
  })
  it('no cuenta intentos incompletos ni duplicados en el promedio', () => {
    const valid = { studentId: 'student-1', overallScore: 10, maxScore: 20, skills: [{ skillId: 'a', score: 10, maxScore: 20, mastery: 0.5, evidenceCount: 1 }] }
    const average = calculateAreaAverage([
      { resultStatus: 'graded', result: valid, lastAttemptId: 'attempt-latest' },
      { resultStatus: 'incomplete', result: null, attemptId: 'attempt-old' },
    ])
    expect(average.average20).toBe(10)
    expect(average.gradedCount).toBe(1)
    expect(average.pendingCount).toBe(1)
  })
  it('cuenta solo una calificación por evaluación y elige el registro más reciente', () => {
    const result = (score) => ({
      studentId: 'student-1',
      overallScore: score,
      maxScore: 20,
      skills: [{ skillId: 'a', score, maxScore: 20, mastery: score / 20, evidenceCount: 1 }],
    })
    const average = calculateAreaAverage([
      { assessmentId: 'exam-1', resultStatus: 'graded', result: result(10), gradedAt: '2026-01-01' },
      { assessmentId: 'exam-1', resultStatus: 'graded', result: result(16), gradedAt: '2026-01-02' },
    ])
    expect(average.average20).toBe(16)
    expect(average.gradedCount).toBe(1)
  })
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
  it('no inventa mastery ni evidenceCount para conocimientos sin preguntas', () => {
    const result = grade(
      { ...definition(), maxScore: 5, questions: [question('only', 'addition', 5)] },
      'student-1',
      { only: 0 },
    )
    expect(result.skills).toEqual([
      {
        skillId: 'addition',
        score: 5,
        maxScore: 5,
        evidenceCount: 1,
        mastery: 1,
      },
    ])
  })
  it.each([
    { overallScore: 21 },
    { overallScore: -1 },
    {
      skills: [
        { skillId: 'addition', score: 11, maxScore: 10, mastery: 1.1, evidenceCount: 1 },
      ],
    },
    {
      skills: [
        { skillId: 'addition', score: 10, maxScore: 10, mastery: 1, evidenceCount: 0 },
      ],
    },
  ])('rechaza resultados inconsistentes %j', (changes) => {
    const result = grade(definition(), 'student-1', {
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0,
    })
    const invalid = { ...result, ...changes }
    if (changes.skills) invalid.skills = changes.skills
    expect(() => validateResult(invalid)).toThrow()
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

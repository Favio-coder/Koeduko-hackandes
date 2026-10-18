import { describe, expect, it } from 'vitest'
import assessmentExample from './fixtures/assessment-results-v1.json'
import { createMatchingResult } from '../services/matchingService'
import { normalizeAssessmentResults } from '../services/normalizeAssessmentResults'
import { groupAssessmentResults } from '../services/assessmentMatching'

const example = () => JSON.parse(JSON.stringify(assessmentExample))

describe('paquete AssessmentResults 1.0', () => {
  it('acepta exactamente el ejemplo y detecta apoyos recíprocos sin inventar las otras habilidades', () => {
    const input = example()
    const original = JSON.stringify(input)
    const result = createMatchingResult(input)
    expect(result).toMatchObject({ status: 'optimal', assessmentId: 'diagnostico-001', courseId: 'matematica-5A', competencyId: 'resuelve-problemas-cantidad', generatedAt: input.generatedAt })
    expect(result.variablesUsed).toEqual(['addition', 'subtraction', 'fraction'])
    expect(result.evidenceCoverage.unevaluatedForEveryone).toEqual(['multiplication', 'division', 'estimation'])
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]).toMatchObject({ studentIds: ['student-001', 'student-002'], focusSkillIds: ['addition', 'subtraction'], proposedMode: 'reciprocal_peer_support', complementaryScore: 0.1125 })
    expect(result.groups[0].supportEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ helperId: 'student-001', learnerId: 'student-002', skillId: 'addition' }),
      expect.objectContaining({ helperId: 'student-002', learnerId: 'student-001', skillId: 'subtraction' }),
    ]))
    expect(result.groups[0].supportEvidence.some(({ skillId }) => skillId === 'fraction')).toBe(false)
    expect(result.assessmentEvidence[0].skills[0]).toMatchObject({ score: 9, maxScore: 10, evidenceCount: 5, mastery: 0.9 })
    expect(result.validation.educationallyValidatedForKoeduko).toBe(false)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    expect(JSON.stringify(input)).toBe(original)
  })

  it('no confunde puntos con ítems correctos ni cambia pesos por la cantidad de evidencias', () => {
    const input = example()
    const first = createMatchingResult(input)
    input.students[0].skills[0].evidenceCount = 10
    expect(createMatchingResult(input).groups).toEqual(first.groups)
    const normalized = normalizeAssessmentResults(input)
    expect(normalized.profiles[0].evidence.addition).toMatchObject({ type: 'assessment_summary', score: 9, maxScore: 10, evidenceCount: 10 })
    const report = groupAssessmentResults({ students: normalized.profiles }, { skillIds: normalized.skillIds })
    expect(report.profiles[0].evidence[0]).toMatchObject({ evidenceCount: 10, itemCount: null, correctCount: null })
  })

  it('usa una base de habilidades común y excluye las que no tienen evidencia para todo el aula', () => {
    const input = example()
    input.students[0].skills[0].evidenceCount = 0
    const normalized = normalizeAssessmentResults(input)
    expect(normalized.profiles[0].skills).not.toHaveProperty('addition')
    const result = createMatchingResult(input)
    expect(result.variablesUsed).toEqual(['subtraction', 'fraction'])
    expect(result.evidenceCoverage.excludedForIncompleteCoverage).toEqual(['addition'])
    expect(result.groups[0].supportEvidence.every(({ skillId }) => skillId !== 'addition')).toBe(true)
  })

  it('informa evidencia insuficiente cuando no hay habilidades comunes y conserva los no asignados', () => {
    const input = example()
    input.students[0].skills = []
    const result = createMatchingResult(input)
    expect(result).toMatchObject({ status: 'insufficient_evidence', groups: [], variablesUsed: [], unmatchedStudentIds: ['student-001', 'student-002'] })
    expect(result.validation.optimalForDefinedObjective).toBe(false)
    expect(createMatchingResult({ ...input, students: [] })).toMatchObject({ status: 'empty', groups: [], unmatchedStudentIds: [] })
    expect(createMatchingResult({ ...input, students: [input.students[0]] }).status).toBe('waiting')
  })

  it('rechaza versiones, estados, datos fuera de rango y alias duplicados', () => {
    const mutations = [
      (input) => { input.schemaVersion = '2.0' },
      (input) => { input.status = 'draft' },
      (input) => { input.competencyId = 'lectura' },
      (input) => { input.generatedAt = 'ayer' },
      (input) => { input.students[0].skills[0].mastery = 1.1 },
      (input) => { input.students[0].skills[0].maxScore = 0 },
      (input) => { input.students[0].skills[0].score = 11 },
      (input) => { input.students[0].skills[0].evidenceCount = 1.5 },
      (input) => { input.students[0].skills[0].evidenceCount = -1 },
      (input) => { input.students[0].skills[0].skillId = 'personalidad' },
      (input) => { input.students[0].skills.push({ ...input.students[0].skills[0], skillId: 'addition' }) },
      (input) => { input.students.push(input.students[0]) },
    ]
    for (const mutate of mutations) {
      const input = example()
      mutate(input)
      expect(() => createMatchingResult(input)).toThrow()
    }
    expect(() => createMatchingResult(example(), { assessmentId: 'otra' })).toThrow(/seleccionada/)
  })

  it('conserva mastery si es una estimación diferente de score/maxScore y lo advierte', () => {
    const input = example()
    input.students[0].skills[0].mastery = 0.85
    const result = createMatchingResult(input)
    expect(result.assessmentEvidence[0].skills[0].mastery).toBe(0.85)
    expect(result.inputWarnings).toContainEqual(expect.objectContaining({ studentId: 'student-001', skillId: 'addition', code: 'mastery_differs_from_point_ratio' }))
  })

  it('es determinista al reordenar estudiantes y habilidades y respeta restricciones', () => {
    const input = example()
    const first = createMatchingResult(input)
    input.students.reverse()
    input.students.forEach((student) => student.skills.reverse())
    expect(createMatchingResult(input)).toEqual(first)
    expect(createMatchingResult(input, { forbiddenPairs: [['student-001', 'student-002']] })).toMatchObject({ status: 'infeasible', groups: [], unmatchedStudentIds: ['student-001', 'student-002'] })
  })
})

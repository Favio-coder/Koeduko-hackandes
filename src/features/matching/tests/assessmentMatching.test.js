import { describe, expect, it } from 'vitest'
import { DIMENSION_IDS } from '../data/matchingConfig'
import { createDemoAssessmentInput, groupAssessmentResults, matchingErrorJson } from '../services/assessmentMatching'

describe('reporte de agrupamiento basado en resultados', () => {
  it('explicita variables, evidencia faltante y límites de la validación sin generar actividades', () => {
    const report = groupAssessmentResults(createDemoAssessmentInput())
    expect(report.variables.used.map(({ id }) => id)).toEqual(DIMENSION_IDS)
    expect(report.profiles.every((profile) => profile.evidence.every(({ type, itemCount }) => type === 'simulated' && itemCount === null))).toBe(true)
    expect(report.profiles[0].otherCompetencies).toEqual({ reading: null, collaboration: null, interpersonal: null, progress: null })
    expect(report.validation).toMatchObject({ educationallyValidatedForKoeduko: false, assessmentInstrumentValidated: null, optimalForDefinedObjective: true })
    expect(Object.values(report.validation.checks).every(Boolean)).toBe(true)
    expect(report.strategyComparison).toHaveLength(6)
    expect(report.method.dualSubjectPatterns.currentStatus).toContain('not_computable')
    expect(report.groups.every((group) => !('activity' in group) && !('meetingUrl' in group))).toBe(true)
    expect(JSON.parse(JSON.stringify(report))).toEqual(report)
  })

  it.each([[0, [], 'empty'], [1, [], 'waiting'], [2, [2], 'proposal'], [3, [3], 'proposal'], [4, [2, 2], 'proposal'], [5, [2, 3], 'proposal'], [40, Array(20).fill(2), 'proposal']])('da cobertura correcta para %i estudiantes', (count, sizes, status) => {
    const report = groupAssessmentResults(createDemoAssessmentInput(count))
    expect(report.status).toBe(status)
    expect(report.groups.map(({ size }) => size).sort()).toEqual(sizes)
    expect(report.validation.checks.allStudentsAccountedFor).toBe(true)
    expect(new Set(report.groups.flatMap((group) => group.members.map(({ studentId }) => studentId))).size + report.unassigned.length).toBe(count)
  })

  it('distingue observaciones, estimaciones y puntajes proporcionados', () => {
    const students = ['a', 'b'].map((studentId) => ({ studentId, skills: Object.fromEntries(DIMENSION_IDS.map((id) => [id, 0.5])) }))
    students[0].evidence = { addition: { type: 'observed', correct: 2, total: 4 }, subtraction: { type: 'estimated' } }
    const input = { source: { kind: 'assessment_scores', assessmentId: 'assessment-1' }, students }
    const report = groupAssessmentResults(input)
    expect(report.source.containsSimulatedData).toBe(false)
    expect(report.profiles[0].evidence[0]).toEqual({ skillId: 'addition', type: 'observed', correctCount: 2, itemCount: 4 })
    expect(report.profiles[0].evidence[1].type).toBe('estimated')
    expect(report.profiles[0].evidence[2]).toMatchObject({ type: 'provided_score', itemCount: null })
    expect(report.validation.assessmentInstrumentValidated).toBeNull()
  })

  it('no presenta simulaciones como observaciones reales aunque tengan conteos', () => {
    const input = createDemoAssessmentInput(2)
    input.students[0].evidence = { addition: { type: 'observed', correct: 92, total: 100 } }
    expect(groupAssessmentResults(input).profiles[0].evidence[0].type).toBe('simulated')
  })

  it('rechaza ausencias, campos no implementados y observaciones inconsistentes', () => {
    const mutations = [
      (input) => { input.students[0].skills.addition = null },
      (input) => { input.students[0].evidence = { addition: { type: 'observed', correct: 1, total: 2 } } },
      (input) => { input.students[0].evidence = { addition: { type: 'observed', correct: 0, total: 0 } } },
      (input) => { input.students[0].reading = { literal: 0.8 } },
      (input) => { input.students[0].skills.personality = 0.8 },
      (input) => { input.constraints.strategy = 'invented' },
      (input) => { input.students.push(input.students[0]) },
    ]
    for (const mutate of mutations) {
      const input = createDemoAssessmentInput(2)
      mutate(input)
      expect(() => groupAssessmentResults(input)).toThrow()
    }
  })

  it('respeta convivencia y declara imposibilidad en vez de forzar una pareja', () => {
    const input = createDemoAssessmentInput(2)
    input.constraints.forbiddenPairs = [['student-001', 'student-002']]
    const report = groupAssessmentResults(input)
    expect(report.status).toBe('infeasible')
    expect(report.groups).toEqual([])
    expect(report.unassigned).toHaveLength(2)
    expect(report.validation.optimalForDefinedObjective).toBe(false)
  })

  it('es reproducible, no modifica los resultados originales y no puntúa por nombres', () => {
    const input = createDemoAssessmentInput()
    const original = JSON.stringify(input)
    const first = groupAssessmentResults(input)
    expect(JSON.stringify(input)).toBe(original)
    expect(groupAssessmentResults({ ...input, students: [...input.students].reverse() })).toEqual(first)
    const renamed = groupAssessmentResults({ ...input, students: input.students.map((student) => ({ ...student, displayName: 'Otro nombre' })) })
    expect(renamed.groups.map(({ id, scoring }) => ({ id, scoring }))).toEqual(first.groups.map(({ id, scoring }) => ({ id, scoring })))
    expect(matchingErrorJson(new Error('Falta evidencia'))).toMatchObject({ status: 'invalid_input', groups: [], error: 'Falta evidencia' })
  })
})

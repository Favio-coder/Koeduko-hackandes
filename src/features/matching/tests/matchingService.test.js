import { describe, expect, it } from 'vitest'
import { SKILL_IDS } from '@/shared/constants/contracts'
import { DEMO_STUDENTS, toKnowledgeProfiles } from '@/shared/lib/demoData'
import { matchStudents } from '../algorithms/matchingAlgorithm'
import { createMatchingResult } from '../services/matchingService'

const realProfiles = () => toKnowledgeProfiles(DEMO_STUDENTS).map((profile) => ({ ...profile, assessmentId: 'assessment-1', totalScore: 50, computedAt: { seconds: 100 } }))

describe('KnowledgeProfile[] a grupos internos', () => {
  it('consume el contrato existente y conserva Pair[] sin perder el trío', () => {
    const profiles = realProfiles().slice(0, 5)
    const original = JSON.stringify(profiles)
    const result = createMatchingResult(profiles)
    expect(result.assessmentId).toBe('assessment-1')
    expect(result.variablesUsed).toEqual(SKILL_IDS)
    expect(result.pairs).toEqual(matchStudents(profiles).pairs)
    expect(result.totalScore).toBe(matchStudents(profiles).totalScore)
    expect(result.groups.map(({ size }) => size).sort()).toEqual([2, 3])
    expect(new Set(result.groups.flatMap(({ studentIds }) => studentIds)).size).toBe(5)
    expect(result.unmatchedStudentIds).toEqual([])
    expect(result.source.containsSimulatedData).toBe(false)
    expect(result.validation.educationallyValidatedForKoeduko).toBe(false)
    expect(JSON.stringify(profiles)).toBe(original)
  })

  it('no mezcla evaluaciones ni acepta perfiles ajenos a la evaluación seleccionada', () => {
    const profiles = realProfiles()
    expect(() => createMatchingResult([{ ...profiles[0], assessmentId: 'otra' }, profiles[1]])).toThrow(/distintas/)
    expect(() => createMatchingResult(profiles, { assessmentId: 'otra' })).toThrow(/seleccionada/)
    expect(() => createMatchingResult([profiles[0], { ...profiles[1], assessmentId: undefined }])).toThrow(/seleccionada/)
    expect(() => createMatchingResult(profiles, { assessmentId: '' })).toThrow(/válido/)
  })

  it('tolera el contrato sin nombres y no puntúa usando la nota total o el timestamp', () => {
    const profiles = realProfiles().map((profile) => {
      const next = { ...profile }
      delete next.displayName
      return next
    })
    const first = createMatchingResult(profiles)
    const changed = createMatchingResult(profiles.map((profile) => ({ ...profile, totalScore: 100, computedAt: { seconds: 9999 } })))
    expect(changed).toEqual(first)
    expect(first.groups[0].members[0].displayName).toBe(first.groups[0].members[0].studentId)
  })

  it('una fuente vacía o incompleta nunca se sustituye silenciosamente con la demo', () => {
    expect(createMatchingResult([], { assessmentId: 'assessment-1' })).toMatchObject({ status: 'empty', groups: [], assessmentId: 'assessment-1' })
    const profiles = realProfiles()
    delete profiles[0].skills.addition
    expect(() => createMatchingResult(profiles)).toThrow(/evidencia/)
    expect(() => createMatchingResult(null)).toThrow(/KnowledgeProfile/)
  })
})

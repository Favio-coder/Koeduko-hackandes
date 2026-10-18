import { SKILL_IDS } from '@/shared/constants/contracts'
import { SCORE_SCALE } from '../data/matchingConfig'
import { groupAssessmentResults } from './assessmentMatching'
import { normalizeAssessmentResults } from './normalizeAssessmentResults'

/**
 * Entrada interna: KnowledgeProfile[] existente o paquete AssessmentResults 1.0.
 * La segunda forma admite habilidades parciales sin fabricar puntajes ausentes.
 */
export function createMatchingResult(input, options = {}) {
  if (!input || typeof input !== 'object') throw new Error('Se requiere KnowledgeProfile[] o un paquete de resultados finalizados.')
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Las opciones de agrupamiento deben ser un objeto.')
  if (Object.keys(options).some((key) => !['assessmentId', 'forbiddenPairs'].includes(key))) throw new Error('Opción de agrupamiento no implementada.')
  if (options.assessmentId !== undefined && (typeof options.assessmentId !== 'string' || !options.assessmentId.trim())) throw new Error('assessmentId debe ser un identificador válido.')

  const batch = Array.isArray(input) ? null : normalizeAssessmentResults(input)
  const profiles = batch ? batch.profiles : input
  if (batch && options.assessmentId !== undefined && options.assessmentId !== batch.metadata.assessmentId) throw new Error('El paquete no corresponde a la evaluación seleccionada.')
  const assessmentIds = new Set()
  for (const profile of profiles) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error('Hay un KnowledgeProfile inválido.')
    if (profile.assessmentId !== undefined && (typeof profile.assessmentId !== 'string' || !profile.assessmentId.trim())) throw new Error('Hay un perfil con assessmentId inválido.')
    if (profile.assessmentId !== undefined) assessmentIds.add(profile.assessmentId)
  }
  if (assessmentIds.size > 1) throw new Error('No se pueden mezclar perfiles de distintas evaluaciones.')
  const assessmentId = batch?.metadata.assessmentId ?? options.assessmentId ?? [...assessmentIds][0] ?? null
  if (assessmentId !== null && profiles.some((profile) => profile.assessmentId !== assessmentId)) throw new Error('Todos los perfiles deben pertenecer a la evaluación seleccionada.')
  const forbiddenPairs = options.forbiddenPairs === undefined ? [] : options.forbiddenPairs
  const ids = new Set(profiles.map(({ studentId }) => studentId))
  if (!Array.isArray(forbiddenPairs) || forbiddenPairs.some((pair) => !Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] || pair.some((id) => !ids.has(id)))) throw new Error('Hay una restricción de pareja inválida.')

  const simulated = profiles.some((profile) => profile.simulated === true)
  const kind = simulated ? 'simulated' : assessmentId ? 'assessment_scores' : 'provided_scores'
  const skillIds = batch ? batch.skillIds : SKILL_IDS
  const context = {
    assessmentId,
    ...(batch ? {
      inputSchemaVersion: batch.metadata.schemaVersion,
      courseId: batch.metadata.courseId,
      competencyId: batch.metadata.competencyId,
      generatedAt: batch.metadata.generatedAt,
      assessmentStatus: batch.metadata.assessmentStatus,
      assessmentEvidence: batch.inputEvidence,
      evidenceCoverage: batch.coverage,
      inputWarnings: batch.warnings,
      inputScorePolicy: {
        mastery: 'provided_normalized_score_used_for_grouping_not_a_verified_probability',
        evidenceCount: 'positive_evidence_required_not_a_reliability_weight_or_count_of_correct_answers',
        scoreAndMaxScore: 'validated_and_preserved_not_substituted_for_mastery',
        overallScore: 'preserved_as_metadata_not_used_for_compatibility',
        absentSkills: 'not_evaluated_not_imputed_as_zero',
      },
    } : {}),
    variablesUsed: [...skillIds],
    algorithm: 'exact-blossom-with-trio-enumeration',
  }

  if (batch && !skillIds.length) {
    const status = profiles.length === 0 ? 'empty' : profiles.length === 1 ? 'waiting' : 'insufficient_evidence'
    return {
      ...context, status, groups: [], pairs: [],
      unmatchedStudentIds: [...ids].sort(), totalScore: 0,
      source: { kind, containsSimulatedData: simulated, assessmentId },
      validation: {
        optimizationStatus: 'not_run', optimalForDefinedObjective: false,
        educationallyValidatedForKoeduko: false, assessmentInstrumentValidated: null,
        requiresTeacherReview: profiles.length > 0,
        reason: 'No hay habilidades con evidencia positiva común a todos los estudiantes.',
      },
    }
  }

  const report = groupAssessmentResults({
    source: { kind, ...(assessmentId ? { assessmentId } : {}) },
    students: profiles,
    constraints: { forbiddenPairs },
  }, { skillIds })
  const groups = report.groups.map((group) => ({
    id: group.id,
    studentIds: group.members.map(({ studentId }) => studentId),
    members: group.members,
    size: group.size,
    focusSkillIds: group.focusSkillIds,
    complementaryScore: group.scoring.utility / (2 * group.size),
    explanation: group.rationale,
    supportEvidence: group.inferredSupports,
    proposedMode: group.proposedMode,
    requiresTeacherReview: group.requiresTeacherReview,
  }))
  return {
    ...context,
    status: report.validation.optimizationStatus,
    groups,
    // Pair solo representa parejas. Los tríos permanecen íntegros en groups.
    pairs: groups.filter(({ size }) => size === 2).map(({ id, studentIds, complementaryScore, explanation }) => ({ id, studentAId: studentIds[0], studentBId: studentIds[1], complementaryScore, explanation })),
    unmatchedStudentIds: report.unassigned.map(({ studentId }) => studentId),
    totalScore: report.groups.reduce((sum, group) => sum + Math.round(group.scoring.utility * SCORE_SCALE), 0) / SCORE_SCALE,
    source: report.source,
    validation: report.validation,
  }
}

import { matchStudents } from '../algorithms/matchingAlgorithm'
import { DEMO_STUDENTS } from '@/shared/lib/demoData'
import { DIMENSION_IDS, MODEL_VERSION } from '../data/matchingConfig'
import { GROUPING_STRATEGIES, MATCHING_REFERENCES, METHOD_SPECIFICATION, VARIABLE_FEEDBACK } from '../data/matchingEvidence'
import { prepareDemoProfiles } from '../data/prepareDemoProfiles'
import { validateSkillSummary } from './normalizeAssessmentResults'

export function createDemoAssessmentInput(count = DEMO_STUDENTS.length) {
  return {
    source: { kind: 'simulated', reference: 'shared/lib/demoData.js' },
    students: prepareDemoProfiles(count).map(({ studentId, displayName, skills, simulated, templateStudentId }) => ({ studentId, displayName, skills, simulated, templateStudentId })),
    constraints: { forbiddenPairs: [] },
  }
}

function validateEnvelope(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.students)) throw new Error('Se requiere un objeto JSON con students: [...].')
  const unknown = Object.keys(input).filter((key) => !['source', 'students', 'constraints'].includes(key))
  if (unknown.length) throw new Error(`Campos de entrada no implementados: ${unknown.join(', ')}.`)
  if (input.source !== undefined && (!input.source || typeof input.source !== 'object' || Array.isArray(input.source))) throw new Error('source debe ser un objeto.')
  const kind = input.source?.kind ?? 'provided_scores'
  if (!['simulated', 'assessment_scores', 'provided_scores'].includes(kind)) throw new Error('source.kind debe ser simulated, assessment_scores o provided_scores.')
  if (input.constraints !== undefined && (!input.constraints || typeof input.constraints !== 'object' || Array.isArray(input.constraints))) throw new Error('constraints debe ser un objeto.')
  if (Object.keys(input.constraints ?? {}).some((key) => key !== 'forbiddenPairs')) throw new Error('Solo se implementa constraints.forbiddenPairs; no se aplicarán restricciones desconocidas silenciosamente.')
  if (input.constraints?.forbiddenPairs !== undefined && !Array.isArray(input.constraints.forbiddenPairs)) throw new Error('forbiddenPairs debe ser una lista de pares de identificadores.')
  for (const student of input.students) {
    if (!student || typeof student !== 'object' || Array.isArray(student)) throw new Error('Cada estudiante debe ser un objeto.')
    if (student.displayName !== undefined && typeof student.displayName !== 'string') throw new Error('displayName debe ser texto; no participa en la puntuación.')
    if (student.simulated !== undefined && typeof student.simulated !== 'boolean') throw new Error('simulated debe ser un booleano.')
    const unknownSkills = Object.keys(student.skills ?? {}).filter((id) => !DIMENSION_IDS.includes(id))
    if (unknownSkills.length) throw new Error(`Habilidades sin modelo implementado: ${unknownSkills.join(', ')}. No se convertirán a las seis habilidades actuales.`)
    if (['reading', 'collaboration', 'interpersonal', 'progress'].some((key) => student[key] !== undefined)) throw new Error('Esta versión solo puntúa matemática. Los criterios adicionales requieren un modelo e instrumentos validados antes de incorporarse.')
    if (student.evidence !== undefined && (!student.evidence || typeof student.evidence !== 'object' || Array.isArray(student.evidence))) throw new Error('evidence debe ser un objeto por habilidad.')
    if (Object.keys(student.evidence ?? {}).some((id) => !DIMENSION_IDS.includes(id))) throw new Error('Hay evidencia para una habilidad no implementada.')
  }
  return kind
}

function summarizeEvidence(student, kind) {
  return DIMENSION_IDS.map((id) => {
    const evidence = student.evidence?.[id]
    if (evidence !== undefined && (!evidence || typeof evidence !== 'object' || Array.isArray(evidence))) throw new Error(`Evidencia inválida de ${id} para ${student.studentId}.`)
    if (evidence && !['observed', 'estimated', 'provided_score', 'assessment_summary'].includes(evidence.type)) throw new Error(`Tipo de evidencia inválido de ${id} para ${student.studentId}.`)
    if (evidence?.type === 'assessment_summary') {
      validateSkillSummary(evidence, `${student.studentId}/${id}`)
      return {
        skillId: id,
        type: evidence.evidenceCount === 0 ? 'missing' : 'provided_assessment_summary',
        evidenceCount: evidence.evidenceCount, itemCount: null, correctCount: null,
        score: evidence.score, maxScore: evidence.maxScore, mastery: evidence.mastery,
      }
    }
    if (!Object.hasOwn(student.skills ?? {}, id)) return { skillId: id, type: 'missing', itemCount: null, correctCount: null }
    let itemCount = null
    let correctCount = null
    if (evidence?.type === 'observed') {
      const { correct, total } = evidence
      if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) throw new Error(`Se requieren aciertos e ítems válidos para ${student.studentId}/${id}.`)
      if (Math.abs(student.skills?.[id] - correct / total) > 1e-9) throw new Error(`El puntaje no coincide con aciertos/ítems en ${student.studentId}/${id}.`)
      itemCount = total
      correctCount = correct
    }
    return {
      skillId: id,
      type: kind === 'simulated' || student.simulated === true ? 'simulated' : evidence?.type ?? 'provided_score',
      itemCount, correctCount,
    }
  })
}

/** Entrada: resultados ya calculados. No construye exámenes ni infiere rasgos personales. */
export function groupAssessmentResults(input, options = {}) {
  const kind = validateEnvelope(input)
  const profileEvidence = input.students.map((student) => ({
    studentId: student.studentId,
    evidence: summarizeEvidence(student, kind),
  }))
  const result = matchStudents(input.students, { ...(input.constraints ?? {}), ...(options.skillIds !== undefined ? { skillIds: options.skillIds } : {}) })
  const skillIds = result.evaluatedSkillIds
  const ordered = [...input.students].sort((a, b) => a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0)
  const evidenceById = new Map(profileEvidence.map((profile) => [profile.studentId, profile.evidence]))
  const forbiddenPairs = input.constraints?.forbiddenPairs ?? []
  const assignedIds = result.groups.flatMap((group) => group.studentIds)
  const allIds = [...assignedIds, ...result.unmatchedStudentIds]
  const simulation = kind === 'simulated' || ordered.some((student) => student.simulated === true)

  return {
    schemaVersion: 'assessment-grouping-json-v1',
    status: result.status === 'optimal' ? 'proposal' : result.status,
    source: {
      kind, containsSimulatedData: simulation,
      reference: typeof input.source?.reference === 'string' ? input.source.reference : null,
      assessmentId: typeof input.source?.assessmentId === 'string' ? input.source.assessmentId : null,
      independentStudentSample: simulation ? false : null,
    },
    variables: { ...VARIABLE_FEEDBACK, used: VARIABLE_FEEDBACK.used.filter(({ id }) => skillIds.includes(id)), notUsedSkillIds: DIMENSION_IDS.filter((id) => !skillIds.includes(id)) },
    method: { ...METHOD_SPECIFICATION, representation: { ...METHOD_SPECIFICATION.representation, order: skillIds }, modelVersion: MODEL_VERSION, scorePrecision: result.precision },
    strategyComparison: GROUPING_STRATEGIES,
    validation: {
      optimizationStatus: result.status,
      optimalForDefinedObjective: result.status === 'optimal',
      educationallyValidatedForKoeduko: false,
      assessmentInstrumentValidated: null,
      requiresTeacherReview: ordered.length > 0,
      checks: {
        validRequiredScores: true,
        uniqueMembership: new Set(allIds).size === allIds.length,
        allStudentsAccountedFor: allIds.length === ordered.length && ordered.every((student) => allIds.includes(student.studentId)),
        validGroupSizes: result.groups.every((group) => group.size === 2 || group.size === 3),
        forbiddenPairsRespected: result.groups.every((group) => forbiddenPairs.every((pair) => !pair.every((id) => group.studentIds.includes(id)))),
      },
      limitations: [
        ...(simulation ? ['Se usan datos ficticios; las réplicas no son estudiantes independientes para validar aprendizaje.'] : []),
        'No se han verificado la validez del instrumento, la dificultad de los ítems ni sus prerrequisitos.',
        'Las diferencias de puntaje no prueban capacidad de explicar, afinidad ni beneficio para ambos.',
        'Los umbrales, la función de puntuación y sus pesos son hipótesis pendientes de evaluación educativa.',
      ],
      educationalValidationPlan: [
        'Validar ítems, rúbricas y puntajes por competencia; estudiar fiabilidad y acuerdo entre evaluadores cuando corresponda.',
        'Comparar asignación aleatoria restringida, similitud y complementariedad con iguales tareas, tiempo y acompañamiento.',
        'Medir aprendizaje individual antes/después y retención, participación y calidad de explicaciones en ambos integrantes.',
        'Registrar agrupamientos y ajustar pesos en datos de desarrollo; evaluar aparte con otras aulas y análisis de incertidumbre.',
      ],
    },
    constraints: { forbiddenPairs, interpersonalCompatibilityMeasured: false, groupsOf: [2, 3], maximumTrios: 1 },
    profiles: ordered.map((student) => ({
      studentId: student.studentId,
      displayName: student.displayName || student.studentId,
      vector: skillIds.map((id) => student.skills[id]),
      evidence: evidenceById.get(student.studentId),
      otherCompetencies: { reading: null, collaboration: null, interpersonal: null, progress: null },
    })),
    groups: result.groups.map((group) => ({
      id: group.id, size: group.size,
      members: group.members.map(({ studentId, displayName }) => ({ studentId, displayName })),
      focusSkillIds: group.activity.skillIds,
      proposedMode: group.activity.advanced ? 'deepening'
        : group.supportedStudentCount === group.size ? 'reciprocal_peer_support'
          : group.supportedStudentCount > 0 ? 'directed_peer_support' : 'no_detected_peer_support',
      scoring: { utility: group.objectiveScore, studentsWithDetectedSupport: group.supportedStudentCount, probabilityOfSuccess: null },
      inferredSupports: group.contributions.map(({ helperId, learnerId, skillId, helperScore, learnerScore, gap }) => ({ helperId, learnerId, skillId, helperScore, learnerScore, gap, evidenceType: 'inferred_opportunity_not_observed_learning' })),
      rationale: group.explanation,
      requiresTeacherReview: true,
      reviewReasons: group.supportFlags,
      suggestedTurnPolicy: group.size === 3 ? ['proponer', 'explicar_o_contrastar', 'comprobar'] : ['proponer_y_explicar', 'contrastar_y_comprobar'],
      rolesArePermanent: false,
    })),
    unassigned: result.unmatchedStudentIds.map((studentId) => ({ studentId, reason: result.status === 'waiting' ? 'needs_at_least_one_peer_or_individual_support' : 'constraints_prevent_complete_grouping' })),
    summary: result.summary,
    references: MATCHING_REFERENCES,
  }
}

export function matchingErrorJson(error) {
  return { schemaVersion: 'assessment-grouping-json-v1', status: 'invalid_input', error: error?.message || 'Entrada inválida.', groups: [] }
}

import { COMPETENCY_ID, SKILL_IDS } from '@/shared/constants/contracts'
import { MAX_DEMO_STUDENTS } from '../data/matchingConfig'

// Adaptación local; no cambia los identificadores del contrato compartido.
const SKILL_ALIASES = Object.freeze({
  addition: 'addition', adicion: 'addition', adición: 'addition',
  subtraction: 'subtraction', sustraccion: 'subtraction', sustracción: 'subtraction', resta: 'subtraction',
  multiplication: 'multiplication', multiplicacion: 'multiplication', multiplicación: 'multiplication',
  division: 'division', división: 'division',
  fraction: 'fraction', fraccion: 'fraction', fracción: 'fraction', fracciones: 'fraction',
  estimation: 'estimation', estimacion: 'estimation', estimación: 'estimation',
})

const validText = (value) => typeof value === 'string' && value.trim().length > 0
const finite = (value) => typeof value === 'number' && Number.isFinite(value)

export function validateSkillSummary(summary, label = 'habilidad') {
  if (!summary || !finite(summary.score) || !finite(summary.maxScore) || summary.maxScore <= 0 || summary.score < 0 || summary.score > summary.maxScore) throw new Error(`Puntaje o máximo inválido en ${label}.`)
  if (!finite(summary.mastery) || summary.mastery < 0 || summary.mastery > 1) throw new Error(`mastery debe estar entre 0 y 1 en ${label}.`)
  if (!Number.isInteger(summary.evidenceCount) || summary.evidenceCount < 0) throw new Error(`evidenceCount debe ser un entero no negativo en ${label}.`)
}

/** Adapta el paquete finalizado del diagnóstico sin imputar habilidades ausentes. */
export function normalizeAssessmentResults(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Se requiere el paquete de resultados de evaluación.')
  if (input.schemaVersion !== '1.0') throw new Error('Versión de resultados no compatible; se admite schemaVersion 1.0.')
  if (input.status !== 'finalized') throw new Error('Solo se agrupan resultados con status finalized.')
  for (const key of ['courseId', 'assessmentId', 'competencyId']) if (!validText(input[key])) throw new Error(`Falta ${key} en los resultados.`)
  if (input.competencyId !== COMPETENCY_ID.RESOLVE_QUANTITY_PROBLEMS) throw new Error('La competencia recibida todavía no está implementada en matching.')
  if (!validText(input.generatedAt) || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(input.generatedAt) || !Number.isFinite(Date.parse(input.generatedAt))) throw new Error('generatedAt debe ser una fecha ISO con zona horaria.')
  if (!Array.isArray(input.students)) throw new Error('students debe ser una lista.')
  if (input.students.length > MAX_DEMO_STUDENTS) throw new Error(`Esta versión admite hasta ${MAX_DEMO_STUDENTS} estudiantes.`)
  const ids = new Set()
  const warnings = []
  const inputEvidence = []
  const profiles = input.students.map((student) => {
    if (!student || !validText(student.studentId) || ids.has(student.studentId)) throw new Error('Hay estudiantes sin identificador o duplicados.')
    ids.add(student.studentId)
    if (!finite(student.overallScore) || !finite(student.maxScore) || student.maxScore <= 0 || student.overallScore < 0 || student.overallScore > student.maxScore) throw new Error(`Nota global inválida para ${student.studentId}.`)
    if (student.displayName !== undefined && typeof student.displayName !== 'string') throw new Error('displayName debe ser texto.')
    if (!Array.isArray(student.skills)) throw new Error(`skills debe ser una lista para ${student.studentId}.`)
    const skills = {}
    const evidence = {}
    const received = new Set()
    const summaries = student.skills.map((item) => {
      const skillId = typeof item?.skillId === 'string' ? SKILL_ALIASES[item.skillId.normalize('NFC')] : undefined
      if (!SKILL_IDS.includes(skillId)) throw new Error(`Habilidad no implementada: ${item?.skillId ?? 'sin identificador'}.`)
      if (received.has(skillId)) throw new Error(`Habilidad duplicada para ${student.studentId}: ${skillId}.`)
      received.add(skillId)
      validateSkillSummary(item, `${student.studentId}/${item.skillId}`)
      // evidenceCount cuenta evidencias, no puntos máximos ni aciertos.
      evidence[skillId] = { type: 'assessment_summary', score: item.score, maxScore: item.maxScore, mastery: item.mastery, evidenceCount: item.evidenceCount }
      if (item.evidenceCount > 0) skills[skillId] = item.mastery
      if (Math.abs(item.mastery - item.score / item.maxScore) > 1e-6) warnings.push({ studentId: student.studentId, skillId, code: 'mastery_differs_from_point_ratio', policy: 'Use supplied mastery; its estimation method is not specified.' })
      return { sourceSkillId: item.skillId, skillId, score: item.score, maxScore: item.maxScore, mastery: item.mastery, evidenceCount: item.evidenceCount }
    })
    inputEvidence.push({ studentId: student.studentId, overallScore: student.overallScore, maxScore: student.maxScore, skills: summaries.sort((a, b) => SKILL_IDS.indexOf(a.skillId) - SKILL_IDS.indexOf(b.skillId)) })
    return {
      studentId: student.studentId,
      ...(student.displayName !== undefined ? { displayName: student.displayName } : {}),
      assessmentId: input.assessmentId, skills, evidence,
    }
  })
  // La misma base de comparación para todo el aula evita premiar la ausencia de datos.
  const skillIds = profiles.length ? SKILL_IDS.filter((id) => profiles.every((profile) => Object.hasOwn(profile.skills, id))) : []
  const coverage = {
    policy: 'common_skills_with_positive_evidence_for_all_students',
    usedSkillIds: skillIds,
    notUsedSkillIds: SKILL_IDS.filter((id) => !skillIds.includes(id)),
    unevaluatedForEveryone: SKILL_IDS.filter((id) => profiles.every((profile) => !Object.hasOwn(profile.skills, id))),
    excludedForIncompleteCoverage: SKILL_IDS.filter((id) => profiles.some((profile) => Object.hasOwn(profile.skills, id)) && !skillIds.includes(id)),
    perStudent: profiles.map((profile) => ({ studentId: profile.studentId, unavailableSkillIds: SKILL_IDS.filter((id) => !Object.hasOwn(profile.skills, id)) })),
  }
  const byId = (a, b) => a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0
  return {
    profiles, skillIds,
    metadata: { schemaVersion: input.schemaVersion, courseId: input.courseId, assessmentId: input.assessmentId, competencyId: input.competencyId, generatedAt: input.generatedAt, assessmentStatus: input.status },
    inputEvidence: inputEvidence.sort(byId),
    coverage: { ...coverage, perStudent: coverage.perStudent.sort(byId) },
    warnings: warnings.sort((a, b) => byId(a, b) || SKILL_IDS.indexOf(a.skillId) - SKILL_IDS.indexOf(b.skillId)),
  }
}

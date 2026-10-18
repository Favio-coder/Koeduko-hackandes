import { SKILL_IDS } from '@/shared/constants/contracts'
import { MODEL_VERSION } from '../data/matchingConfig'

export const MATCHING_RESULT_KEY = 'koeduko.matching.last-result.v1'

/** Valida una propuesta guardada sin ejecutar de nuevo el algoritmo. */
export function validateSavedMatching(result) {
  if (!result || result.status !== 'optimal' || !Array.isArray(result.groups) || !result.groups.length) throw new Error('No hay un agrupamiento válido guardado.')
  if (!Array.isArray(result.variablesUsed) || result.variablesUsed.some((id) => !SKILL_IDS.includes(id))) throw new Error('Las habilidades guardadas no son compatibles.')
  const ids = []
  let trios = 0
  for (const group of result.groups) {
    if (!group || typeof group.id !== 'string' || ![2, 3].includes(group.size) || !Array.isArray(group.studentIds) || group.studentIds.length !== group.size || !Array.isArray(group.members) || group.members.length !== group.size) throw new Error('El agrupamiento guardado está incompleto.')
    if (group.size === 3) trios++
    group.members.forEach((member, index) => {
      if (!member || typeof member.studentId !== 'string' || !member.studentId.trim() || member.studentId !== group.studentIds[index] || typeof member.displayName !== 'string') throw new Error('Hay integrantes inválidos en el resultado guardado.')
      ids.push(member.studentId)
    })
    if (typeof group.explanation !== 'string' || !Array.isArray(group.focusSkillIds) || group.focusSkillIds.some((id) => !result.variablesUsed.includes(id))) throw new Error('El detalle guardado no es compatible.')
    if (!Array.isArray(group.supportEvidence) || group.supportEvidence.some((support) => !group.studentIds.includes(support.helperId) || !group.studentIds.includes(support.learnerId) || !group.focusSkillIds.includes(support.skillId))) throw new Error('Los apoyos guardados no son compatibles.')
  }
  if (new Set(ids).size !== ids.length || trios > 1 || trios !== ids.length % 2 || !Array.isArray(result.unmatchedStudentIds) || result.unmatchedStudentIds.length) throw new Error('La cobertura del resultado guardado es inválida.')
  return result
}

export function saveMatchingResult(result, storage = globalThis.sessionStorage) {
  validateSavedMatching(result)
  storage.setItem(MATCHING_RESULT_KEY, JSON.stringify({ modelVersion: MODEL_VERSION, result }))
}

export function readMatchingResult(storage) {
  try {
    const raw = (storage ?? globalThis.sessionStorage).getItem(MATCHING_RESULT_KEY)
    if (!raw) return { result: null, error: null }
    const snapshot = JSON.parse(raw)
    if (snapshot.modelVersion !== MODEL_VERSION) throw new Error('El modelo de agrupamiento cambió.')
    return { result: validateSavedMatching(snapshot.result), error: null }
  } catch {
    return { result: null, error: 'El último agrupamiento no está disponible. Vuelve a Estudiantes y pulsa Agrupar.' }
  }
}

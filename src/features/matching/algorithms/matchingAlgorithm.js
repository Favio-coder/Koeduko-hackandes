import blossom from '../vendor/blossom'
import {
  DIMENSION_IDS, DIMENSION_LABELS, MATCHING_ACTIVITIES, MAX_DEMO_STUDENTS,
  MIN_HELPER_SCORE, MIN_SUPPORT_GAP, MODEL_VERSION, SCORE_SCALE,
} from '../data/matchingConfig'

function resolveSkillIds(options) {
  const ids = options.skillIds === undefined ? DIMENSION_IDS : options.skillIds
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some((id) => !DIMENSION_IDS.includes(id))) throw new Error('Se requieren habilidades evaluadas válidas, sin duplicados.')
  return DIMENSION_IDS.filter((id) => ids.includes(id))
}

function validateProfiles(profiles, skillIds) {
  if (!Array.isArray(profiles)) throw new Error('Se necesita una lista de perfiles.')
  if (profiles.length > MAX_DEMO_STUDENTS) throw new Error(`Esta prueba admite hasta ${MAX_DEMO_STUDENTS} estudiantes.`)
  const ids = new Set()
  for (const profile of profiles) {
    if (!profile || typeof profile.studentId !== 'string' || !profile.studentId.trim()) throw new Error('Hay un perfil sin identificador.')
    if (ids.has(profile.studentId)) throw new Error(`El estudiante ${profile.studentId} está duplicado.`)
    ids.add(profile.studentId)
    for (const id of skillIds) {
      const value = profile.skills?.[id]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`Falta evidencia válida de ${DIMENSION_LABELS[id]} para ${profile.displayName || profile.studentId}.`)
      }
    }
  }
}

const compareIds = (a, b) => a < b ? -1 : a > b ? 1 : 0
const keyForPair = (a, b) => JSON.stringify([a, b].sort(compareIds))
const nameOf = (profile) => profile.displayName || profile.studentId
const groupKey = (ids) => ids.map(encodeURIComponent).join('+')
const canonicalGroups = (groups) => groups.map((ids) => [...ids].sort(compareIds))
  .sort((a, b) => compareIds(groupKey(a), groupKey(b)))

function analyzeActivity(members, activity) {
  const contributions = []
  const incoming = members.map((learner) => {
    let value = 0
    for (const skillId of activity.skillIds) {
      const helpers = members.filter((peer) => peer.studentId !== learner.studentId
        && peer.skills[skillId] >= MIN_HELPER_SCORE
        && peer.skills[skillId] - learner.skills[skillId] >= MIN_SUPPORT_GAP)
        .sort((a, b) => b.skills[skillId] - a.skills[skillId] || compareIds(a.studentId, b.studentId))
      const helper = helpers[0]
      if (!helper) continue
      const gap = helper.skills[skillId] - learner.skills[skillId]
      value += (1 - learner.skills[skillId]) * gap / activity.skillIds.length
      contributions.push({
        skillId, helperId: helper.studentId, learnerId: learner.studentId,
        helperName: nameOf(helper), learnerName: nameOf(learner),
        helperScore: helper.skills[skillId], learnerScore: learner.skills[skillId], gap,
      })
    }
    return { studentId: learner.studentId, value }
  })
  const values = incoming.map(({ value }) => value)
  const utility = values.reduce((sum, value) => sum + value, 0) + members.length * Math.min(...values)
  return {
    activity, incoming, contributions,
    supportedStudentCount: values.filter((value) => value > 0).length,
    utilityInteger: Math.round(utility * SCORE_SCALE),
    need: members.reduce((sum, member) => sum + activity.skillIds.reduce((s, id) => s + 1 - member.skills[id], 0), 0) / activity.skillIds.length,
  }
}

function analyzeMembers(members, skillIds) {
  const advanced = members.every((member) => skillIds.every((id) => member.skills[id] >= MIN_HELPER_SCORE))
  // El foco conserva únicamente habilidades realmente comparables en esta evaluación.
  const candidates = MATCHING_ACTIVITIES.filter((activity) => advanced ? activity.advanced : !activity.advanced)
    .map((activity) => ({ ...activity, skillIds: activity.skillIds.filter((id) => skillIds.includes(id)) }))
    .filter((activity) => activity.skillIds.length > 0)
  return candidates.map((activity) => analyzeActivity(members, activity)).sort((a, b) =>
    b.supportedStudentCount - a.supportedStudentCount
    || b.utilityInteger - a.utilityInteger || b.need - a.need
    || compareIds(a.activity.id, b.activity.id))[0]
}

/** Modelo de oportunidades, no predicción de aprendizaje. Ver README.md e INVESTIGACION.md. */
export function analyzeGroup(profiles, options = {}) {
  const skillIds = resolveSkillIds(options)
  validateProfiles(profiles, skillIds)
  if (profiles.length < 2 || profiles.length > 3) throw new Error('Un grupo necesita dos o tres integrantes.')
  return analyzeMembers([...profiles].sort((a, b) => compareIds(a.studentId, b.studentId)), skillIds)
}

export function complementarityScore(profileA, profileB, options = {}) {
  return analyzeGroup([profileA, profileB], options).utilityInteger / SCORE_SCALE / 4
}

function describeGroup(members, analysis) {
  const supportFlags = []
  if (analysis.supportedStudentCount < members.length) {
    supportFlags.push('Revisar con el docente: el modelo no detecta apoyo para todos. Explicar también puede aportar aprendizaje.')
  }
  const explanation = analysis.contributions.length
    ? analysis.contributions.map((item) => `${item.helperName} puede apoyar a ${item.learnerName} en ${DIMENSION_LABELS[item.skillId].toLowerCase()}.`).join(' ')
    : analysis.activity.advanced
      ? 'El diagnóstico muestra un desempeño alto en lo evaluado. Se propone contrastar estrategias y resolver un reto compartido.'
      : 'No hay diferencias suficientes para proponer un tutor por habilidad. Se recomienda trabajo guiado y revisión docente.'
  const studentIds = members.map(({ studentId }) => studentId)
  return {
    id: `group-${groupKey(studentIds)}`, studentIds,
    members: members.map(({ studentId, displayName, skills, route }) => ({ studentId, displayName: displayName || studentId, skills, route })),
    size: members.length,
    activity: analysis.activity,
    complementaryScore: analysis.utilityInteger / SCORE_SCALE / (2 * members.length),
    objectiveScore: analysis.utilityInteger / SCORE_SCALE,
    supportedStudentCount: analysis.supportedStudentCount,
    contributions: analysis.contributions,
    incomingSupport: analysis.incoming,
    explanation, supportFlags,
    participationPlan: members.length === 3
      ? 'Rótense en cada tarea: una persona propone, otra explica o contrasta y la tercera comprueba. Todos deben participar.'
      : 'Alternen quién propone y quién explica o comprueba. Usen las fortalezas indicadas como apoyo, sin fijar roles permanentes.',
  }
}

export function explainGroup(profiles, options = {}) {
  const analysis = analyzeGroup(profiles, options)
  return describeGroup([...profiles].sort((a, b) => compareIds(a.studentId, b.studentId)), analysis)
}

/**
 * Exacto sobre pesos enteros: primero cobertura de oportunidades, luego utilidad.
 * Pares: Blossom. Impares: todos los tríos permitidos + Blossom del resto.
 * Sin reloj ni aleatoriedad. Debe ejecutarse en worker para cantidades impares.
 */
export function matchStudents(profiles, options = {}) {
  const skillIds = resolveSkillIds(options)
  validateProfiles(profiles, skillIds)
  const ordered = [...profiles].sort((a, b) => compareIds(a.studentId, b.studentId))
  const ids = new Set(ordered.map(({ studentId }) => studentId))
  const forbidden = new Set()
  for (const pair of options.forbiddenPairs || []) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] || pair.some((id) => !ids.has(id))) throw new Error('Hay una restricción de pareja inválida.')
    forbidden.add(keyForPair(...pair))
  }
  const base = {
    modelVersion: MODEL_VERSION, algorithm: 'exact-blossom-with-trio-enumeration',
    objective: 'Priorizar oportunidades de apoyo para todos y después maximizar utilidad.',
    precision: 1 / SCORE_SCALE,
    evaluatedSkillIds: skillIds,
  }
  const finish = (status, groups = [], unmatchedStudentIds = [], candidateTriples = 0) => ({
    ...base, status, groups,
    // Adaptador local: los tríos solo se representan en groups; no inventar una pareja.
    pairs: groups.filter(({ size }) => size === 2).map((group) => ({
      id: group.id, studentAId: group.studentIds[0], studentBId: group.studentIds[1],
      complementaryScore: group.complementaryScore, explanation: group.explanation,
    })),
    unmatchedStudentIds,
    totalScore: groups.reduce((sum, group) => sum + Math.round(group.objectiveScore * SCORE_SCALE), 0) / SCORE_SCALE,
    summary: {
      studentCount: ordered.length,
      pairCount: groups.filter(({ size }) => size === 2).length,
      trioCount: groups.filter(({ size }) => size === 3).length,
      supportedStudentCount: groups.reduce((sum, group) => sum + group.supportedStudentCount, 0),
      reviewGroupCount: groups.filter(({ supportFlags }) => supportFlags.length > 0).length,
      candidateTriples,
    },
  })
  if (!ordered.length) return finish('empty')
  if (ordered.length === 1) return finish('waiting', [], [ordered[0].studentId])

  // Un integrante más con apoyo supera cualquier variación de utilidad total.
  const primaryMultiplier = 2 * ordered.length * SCORE_SCALE + 1
  const objective = (analysis) => analysis.supportedStudentCount * primaryMultiplier + analysis.utilityInteger
  const allowed = (a, b) => !forbidden.has(keyForPair(ordered[a].studentId, ordered[b].studentId))
  const pairAnalysis = ordered.map((a, i) => ordered.map((b, j) => i < j && allowed(i, j) ? analyzeMembers([a, b], skillIds) : null))
  const pairAt = (a, b) => pairAnalysis[Math.min(a, b)][Math.max(a, b)]

  function solvePairs(indices) {
    if (!indices.length) return { groups: [], weight: 0 }
    const edges = []
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const analysis = pairAt(indices[i], indices[j])
        if (analysis) edges.push([i, j, objective(analysis)])
      }
    }
    const mates = blossom(edges, true)
    const groups = []
    let weight = 0
    for (let i = 0; i < indices.length; i++) {
      const j = mates[i]
      if (!Number.isInteger(j) || j < 0) return null
      if (mates[j] !== i || j >= indices.length || i === j) throw new Error('El optimizador devolvió un grupo inválido.')
      if (i < j) {
        groups.push([indices[i], indices[j]])
        weight += objective(pairAt(indices[i], indices[j]))
      }
    }
    return { groups, weight }
  }
  const indices = ordered.map((_, index) => index)
  let best = null
  let candidateTriples = 0
  if (ordered.length % 2 === 0) best = solvePairs(indices)
  else {
    for (let a = 0; a < ordered.length; a++) {
      for (let b = a + 1; b < ordered.length; b++) {
        for (let c = b + 1; c < ordered.length; c++) {
          if (!allowed(a, b) || !allowed(a, c) || !allowed(b, c)) continue
          candidateTriples++
          const remaining = indices.filter((index) => index !== a && index !== b && index !== c)
          const rest = solvePairs(remaining)
          if (!rest) continue
          const trio = analyzeMembers([ordered[a], ordered[b], ordered[c]], skillIds)
          const weight = rest.weight + objective(trio)
          // Bucle y entrada ordenados: primer óptimo en caso de empate.
          if (!best || weight > best.weight) best = { groups: [...rest.groups, [a, b, c]], weight }
        }
      }
    }
  }
  if (!best) return finish('infeasible', [], ordered.map(({ studentId }) => studentId), candidateTriples)
  const lookup = new Map(ordered.map((profile) => [profile.studentId, profile]))
  const groups = canonicalGroups(best.groups.map((group) => group.map((index) => ordered[index].studentId)))
    .map((studentIds) => {
      const members = studentIds.map((id) => lookup.get(id))
      return describeGroup(members, analyzeMembers(members, skillIds))
    })
  return finish('optimal', groups, [], candidateTriples)
}

/**
 * Demostración de investigación, sin dependencias ni acceso a Firebase.
 * node exa-results/koeduko-diagnostico-y-agrupamiento-2026-10-17/simular.mjs
 *
 * Genera evidencia ficticia para 40 estudiantes y verifica por enumeración
 * problemas de hasta 9 estudiantes. NO es el solver de producción para 40.
 */
import { writeFile } from 'node:fs/promises'

const dimensions = [
  ['unitRepresentation', 'U'],
  ['magnitudeComparison', 'M'],
  ['equivalence', 'E'],
  ['additiveProcedures', 'P'],
  ['wordProblemTranslation', 'T'],
  ['justification', 'J'],
]
const seed = 20261017
let randomState = seed >>> 0
function seededRandom() {
  randomState += 0x6D2B79F5
  let x = randomState
  x = Math.imul(x ^ (x >>> 15), x | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}
const clamp = (x, min, max) => Math.max(min, Math.min(max, x))
const round = (x) => Math.round(x * 1e8) / 1e8
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const itemBank = dimensions.flatMap(([dimension, prefix]) =>
  [1, 2, 3, 4].map((number) => ({
    id: `${prefix}${number}`,
    dimension,
    maxPoints: prefix === 'J' ? 2 : 1,
    // Supuesto artificial; no es dificultad calibrada de un ítem real.
    syntheticDifficultyOffset: [-0.08, 0.02, 0.10, 0.16][number - 1],
  })),
)

function simulateStudent(index) {
  const id = `sim-${String(index + 1).padStart(3, '0')}`
  // Componente general y variación de perfil. No se envían al matching.
  const common = 0.24 + seededRandom() * 0.56
  const conceptualContrast = (seededRandom() - 0.5) * 0.42
  const latent = dimensions.map((_, k) => {
    const contrast = k <= 2 ? conceptualContrast : k === 3 ? -conceptualContrast : 0
    return clamp(common + contrast + (seededRandom() - 0.5) * 0.24, 0.08, 0.95)
  })
  const scoredItems = itemBank.map((item) => {
    const k = dimensions.findIndex(([dimension]) => dimension === item.dimension)
    const chance = clamp(latent[k] - item.syntheticDifficultyOffset, 0.04, 0.96)
    let awardedPoints
    if (item.maxPoints === 2) {
      // Simula una categoría de rúbrica. No son dos ensayos independientes.
      const draw = seededRandom()
      const chanceFull = chance * chance
      awardedPoints = draw < chanceFull ? 2 : draw < chance ? 1 : 0
    } else {
      awardedPoints = Number(seededRandom() < chance)
    }
    return {
      itemId: item.id,
      dimension: item.dimension,
      responseStatus: 'answered',
      awardedPoints,
      maxPoints: item.maxPoints,
      scoringSource: 'synthetic-generator',
      simulated: true,
    }
  })
  const evidence = Object.fromEntries(dimensions.map(([dimension]) => {
    const records = scoredItems.filter((item) => item.dimension === dimension)
    const earnedPoints = records.reduce((s, item) => s + item.awardedPoints, 0)
    const possiblePoints = records.reduce((s, item) => s + item.maxPoints, 0)
    return [dimension, {
      observedScore: earnedPoints / possiblePoints,
      earnedPoints,
      possiblePoints,
      observedItems: records.length,
      expectedItems: 4,
      itemIds: records.map((item) => item.itemId),
    }]
  }))
  return {
    studentId: id,
    displayName: `Estudiante simulado ${index + 1}`,
    grade: '5to',
    domainId: 'fractions-additive-grade5',
    instrumentVersion: 'proposal-v1',
    simulated: true,
    evidence,
    scoredItems,
  }
}

// Utilidad propuesta en README. Los vectores recibidos deben tener evidencia.
function opportunityUtilities(vectors, weights) {
  assert(vectors.length >= 2 && vectors.length <= 3, 'Tamaño de grupo inválido')
  assert(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-10, 'Pesos inválidos')
  return vectors.map((vector, i) => weights.reduce((sum, weight, k) => {
    assert(Number.isFinite(vector[k]) && vector[k] >= 0 && vector[k] <= 1, 'Perfil inválido')
    const largestGap = Math.max(0, ...vectors
      .filter((_, j) => i !== j)
      .map((peer) => peer[k] - vector[k]))
    return sum + weight * (1 - vector[k]) * largestGap
  }, 0))
}
function groupUtility(vectors, weights, lambda = 1) {
  const utility = opportunityUtilities(vectors, weights)
  return round(utility.reduce((a, b) => a + b, 0)
    + lambda * vectors.length * Math.min(...utility))
}

// Enumeración exacta pequeña. No usar esta implementación para un aula de 40.
function enumeratePartitions(ids, triplesLeft, visit, prefix = []) {
  if (ids.length === 0) {
    if (triplesLeft === 0) visit(prefix)
    return
  }
  const [first, ...rest] = ids
  for (let i = 0; i < rest.length; i++) {
    const next = rest.filter((_, j) => j !== i)
    enumeratePartitions(next, triplesLeft, visit, [...prefix, [first, rest[i]]])
  }
  if (triplesLeft > 0) {
    for (let i = 0; i < rest.length; i++) {
      for (let j = i + 1; j < rest.length; j++) {
        const next = rest.filter((_, k) => k !== i && k !== j)
        enumeratePartitions(next, triplesLeft - 1, visit,
          [...prefix, [first, rest[i], rest[j]]])
      }
    }
  }
}
function exactSmall(profiles, weights) {
  assert(profiles.length <= 9, 'El enumerador solo admite hasta 9 estudiantes')
  if (profiles.length < 2) return {
    status: profiles.length === 0 ? 'EMPTY' : 'WAITING',
    groups: [],
    pendingStudentIds: profiles.map((p) => p.studentId),
    score: 0,
    examinedPartitions: 0,
  }
  const lookup = new Map(profiles.map((p) => [p.studentId, p.vector]))
  const ids = [...lookup.keys()].sort()
  assert(ids.length === profiles.length, 'Identificadores duplicados')
  let best = null
  let examinedPartitions = 0
  enumeratePartitions(ids, profiles.length % 2, (groups) => {
    examinedPartitions++
    const score = round(groups.reduce((sum, group) => sum
      + groupUtility(group.map((id) => lookup.get(id)), weights), 0))
    const key = JSON.stringify(groups)
    if (best === null || score > best.score
      || (score === best.score && key < best.key)) best = { groups, score, key }
  })
  assert(best !== null, 'No se encontró partición')
  return {
    status: 'OPTIMAL_FOR_ROUNDED_DEMO_OBJECTIVE',
    groups: best.groups,
    pendingStudentIds: [],
    score: best.score,
    examinedPartitions,
  }
}

const students = Array.from({ length: 40 }, (_, index) => simulateStudent(index))
for (const student of students) {
  assert(student.scoredItems.length === 24, 'Número de tareas incorrecto')
  for (const [dimension] of dimensions) {
    const evidence = student.evidence[dimension]
    assert(evidence.observedScore === evidence.earnedPoints / evidence.possiblePoints,
      'Puntaje sin respaldo en los registros')
  }
}
const profiles = students.map((student) => ({
  studentId: student.studentId,
  vector: dimensions.map(([dimension]) => student.evidence[dimension].observedScore),
}))
const weights = dimensions.map(() => 1 / dimensions.length)
const sizeChecks = Array.from({ length: 10 }, (_, n) => {
  const result = exactSmall(profiles.slice(0, n), weights)
  const members = result.groups.flat()
  assert(new Set(members).size === members.length, 'Estudiante repetido')
  assert(members.length === (n < 2 ? 0 : n), 'Cobertura incorrecta')
  assert(result.groups.filter((group) => group.length === 3).length
    === (n >= 3 ? n % 2 : 0), 'Número de tríos incorrecto')
  assert(result.groups.every((group) => group.length === 2 || group.length === 3), 'Grupo inválido')
  return { n, ...result }
})
const exampleProfiles = [
  { studentId: 'A', vector: [0.9, 0.4] },
  { studentId: 'B', vector: [0.4, 0.9] },
  { studentId: 'C', vector: [0.9, 0.9] },
  { studentId: 'D', vector: [0.4, 0.4] },
]
const example = exactSmall(exampleProfiles, [0.5, 0.5])
assert(example.score === 0.9, 'El ejemplo numérico no coincide')
assert(example.examinedPartitions === 3, 'Deben existir tres particiones de cuatro')
assert(sizeChecks[5].examinedPartitions === 10, 'Deben existir diez particiones de cinco')
assert(JSON.stringify(example) === JSON.stringify(exactSmall([...exampleProfiles].reverse(), [0.5, 0.5])),
  'La solución pequeña debe conservarse al reordenar entradas')

const cosine = (a, b) => a.reduce((sum, x, k) => sum + x * b[k], 0)
  / (Math.hypot(...a) * Math.hypot(...b))
const cosineScaleExample = cosine([0.9, 0.9], [0.3, 0.3])
assert(Math.abs(cosineScaleExample - 1) < 1e-12, 'Ejemplo de escala del coseno incorrecto')

const summary = {
  simulated: true,
  seed,
  studentCount: students.length,
  scoredItemCount: students.reduce((sum, student) => sum + student.scoredItems.length, 0),
  fortyStudentCandidatePairs: 40 * 39 / 2,
  fortyOneStudentCandidateTriples: 41 * 40 * 39 / 6,
  productionSolverFor40Executed: false,
  interpretation: 'Verificación de fórmula y casos pequeños; sin evidencia de eficacia educativa.',
  cosineScaleExample,
  fourStudentExample: example,
  sizeChecks,
}
await writeFile(new URL('./simulacion-40.json', import.meta.url), JSON.stringify({
  metadata: {
    simulated: true,
    seed,
    domainId: 'fractions-additive-grade5',
    instrumentVersion: 'proposal-v1',
    generatorAssumptions: 'Componente común, contraste conceptual/procedimental, dificultad artificial y ruido; sin calibración empírica. No se exportan valores latentes.',
    itemSpecifications: 'variables-y-tareas.md',
    caution: 'No son datos de estudiantes reales ni respuestas textuales corregidas.',
  },
  dimensions: dimensions.map(([id]) => id),
  itemBank,
  students,
}, null, 2) + '\n')
await writeFile(new URL('./comprobaciones.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify({
  students: summary.studentCount,
  syntheticScoringRecords: summary.scoredItemCount,
  checkedSizes: sizeChecks.map(({ n, groups, examinedPartitions }) => ({
    n,
    groupSizes: groups.map((group) => group.length),
    examinedPartitions,
  })),
  fourStudentExample: example,
  productionSolverFor40Executed: false,
}, null, 2))

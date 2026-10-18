/**
 * Prototipo de investigación aislado: grupos exactos de 2, o un trío y parejas.
 * node exa-results/koeduko-diagnostico-y-agrupamiento-2026-10-17/optimizar.mjs
 *
 * Utiliza la fórmula hipotética de README, no un predictor de aprendizaje.
 * Ejecuta Blossom para 40 y todos los tríos + Blossom para 39 estudiantes.
 */
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'

const require = createRequire(import.meta.url)
const blossom = require('./vendor/edmonds-blossom/app/blossom.cjs')
const dataset = JSON.parse(await readFile(new URL('./simulacion-40.json', import.meta.url), 'utf8'))
const dimensions = dataset.dimensions
const profiles = dataset.students.map((student) => ({
  id: student.studentId,
  vector: dimensions.map((key) => student.evidence[key].observedScore),
}))

// Para esta fixture: puntajes en octavos, seis pesos iguales y λ ∈ {0, .5, 1}.
// 768 conserva exactamente las utilidades como enteros, sin redondear pesos.
// Para otro instrumento/esquema de pesos se debe revisar esta escala.
const scale = 768
const round = (value) => Math.round(value * 1e9) / 1e9
function opportunities(vectors) {
  return vectors.map((vector, i) => vector.reduce((sum, value, k) => {
    const gap = Math.max(0, ...vectors.filter((_, j) => j !== i).map((other) => other[k] - value))
    return sum + (1 - value) * gap / vector.length
  }, 0))
}
function scoreVectors(vectors, lambda = 1) {
  const values = opportunities(vectors)
  const raw = values.reduce((a, b) => a + b, 0) + lambda * vectors.length * Math.min(...values)
  const integer = Math.round(raw * scale)
  assert.ok(Math.abs(integer - raw * scale) < 1e-7, 'Escala inexacta: revisar denominadores del instrumento')
  return integer
}
function normalizeGroups(groups) {
  return groups.map((members) => [...members].sort())
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'))
}
const pairKey = (a, b) => JSON.stringify([a, b].sort())

function solverContext(input, { lambda = 1, forbiddenPairs = [], priority = 'utility' } = {}) {
  assert.ok([0, 0.5, 1].includes(lambda), 'λ fuera del esquema de precisión verificado')
  assert.ok(['utility', 'supportCoverage'].includes(priority), 'Prioridad desconocida')
  const ordered = [...input].sort((a, b) => a.id.localeCompare(b.id, 'en'))
  assert.equal(new Set(ordered.map((p) => p.id)).size, ordered.length, 'IDs duplicados')
  for (const profile of ordered) {
    assert.equal(profile.vector.length, dimensions.length, 'Dimensiones incompatibles')
    assert.ok(profile.vector.every((value) => Number.isFinite(value) && value >= 0 && value <= 1),
      'NEEDS_DIAGNOSIS: puntaje ausente o inválido')
  }
  const forbidden = new Set(forbiddenPairs.map(([a, b]) => pairKey(a, b)))
  const compatible = (a, b) => !forbidden.has(pairKey(ordered[a].id, ordered[b].id))
  // La utilidad total es <= (1+λ)*N; este multiplicador conserva prioridad
  // lexicográfica exacta: una persona con apoyo pesa más que toda la utilidad.
  const primaryMultiplier = (1 + lambda) * ordered.length * scale + 1
  function scoreGroup(vectors) {
    const base = scoreVectors(vectors, lambda)
    if (priority === 'utility') return base
    const supported = opportunities(vectors).filter((value) => value > 0).length
    return supported * primaryMultiplier + base
  }
  const pairWeights = ordered.map((a, i) => ordered.map((b, j) =>
    i === j || !compatible(i, j) ? null : scoreGroup([a.vector, b.vector])))

  function even(indices, metric = null) {
    if (indices.length === 0) return { score: 0, groups: [], complete: true }
    const edges = []
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        if (pairWeights[indices[i]][indices[j]] === null) continue
        const weight = metric
          ? metric(ordered[indices[i]].vector, ordered[indices[j]].vector)
          : pairWeights[indices[i]][indices[j]]
        edges.push([i, j, weight])
      }
    }
    const mates = blossom(edges, true)
    const groups = []
    let score = 0
    for (let i = 0; i < indices.length; i++) {
      const j = mates[i]
      if (!Number.isInteger(j) || j < 0) continue
      assert.equal(mates[j], i, 'Matching asimétrico de la librería')
      assert.ok(j < indices.length && j !== i, 'Índice de matching inválido')
      if (i < j) {
        groups.push([ordered[indices[i]].id, ordered[indices[j]].id])
        score += pairWeights[indices[i]][indices[j]]
      }
    }
    return { score, groups, complete: groups.length * 2 === indices.length }
  }
  return { ordered, pairWeights, compatible, even, lambda, scoreGroup, priority }
}

function solve(input, options = {}) {
  const start = performance.now()
  const context = solverContext(input, options)
  const { ordered, compatible, even, lambda, scoreGroup, priority } = context
  if (ordered.length < 2) return {
    status: ordered.length === 0 ? 'EMPTY' : 'WAITING',
    groups: [],
    pendingStudentIds: ordered.map((p) => p.id),
    scoreInteger: 0,
    score: 0,
    testedTriples: 0,
    elapsedMs: round(performance.now() - start),
  }
  const indices = ordered.map((_, index) => index)
  let best = null
  let testedTriples = 0
  if (ordered.length % 2 === 0) {
    const result = even(indices)
    if (result.complete) best = result
  } else {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        for (let c = b + 1; c < indices.length; c++) {
          if (!compatible(a, b) || !compatible(a, c) || !compatible(b, c)) continue
          testedTriples++
          const remaining = indices.filter((id) => id !== a && id !== b && id !== c)
          const result = even(remaining)
          if (!result.complete) continue
          const score = result.score + scoreGroup([ordered[a].vector, ordered[b].vector, ordered[c].vector])
          const groups = normalizeGroups([...result.groups, [ordered[a].id, ordered[b].id, ordered[c].id]])
          const key = JSON.stringify(groups)
          if (!best || score > best.score || (score === best.score && key < best.key)) {
            best = { score, groups, key }
          }
        }
      }
    }
  }
  const lookup = new Map(ordered.map((p) => [p.id, p.vector]))
  const baseScore = best ? best.groups.reduce((sum, group) => sum
    + scoreVectors(group.map((id) => lookup.get(id)), lambda), 0) : null
  return {
    status: best ? 'OPTIMAL_FOR_SPECIFIED_INTEGER_OBJECTIVE' : 'INFEASIBLE_COMPLETE_COVERAGE',
    groups: best ? normalizeGroups(best.groups) : [],
    pendingStudentIds: best ? [] : ordered.map((p) => p.id),
    priority,
    objectiveInteger: best?.score ?? null,
    scoreInteger: baseScore,
    score: best ? round(baseScore / scale) : null,
    testedTriples,
    elapsedMs: round(performance.now() - start),
  }
}

// Oráculo independiente: enumera particiones completas pequeñas.
function bruteForce(input, { lambda = 1, forbiddenPairs = [], priority = 'utility' } = {}) {
  const ordered = [...input].sort((a, b) => a.id.localeCompare(b.id, 'en'))
  if (ordered.length < 2) return 0
  const forbidden = new Set(forbiddenPairs.map(([a, b]) => pairKey(a, b)))
  let best = -Infinity
  function visit(remaining, tripleAvailable, total) {
    if (remaining.length === 0) {
      if (!tripleAvailable) best = Math.max(best, total)
      return
    }
    const [first, ...rest] = remaining
    const candidate = (members, next, consumeTriple) => {
      for (let a = 0; a < members.length; a++) {
        for (let b = a + 1; b < members.length; b++) {
          if (forbidden.has(pairKey(members[a].id, members[b].id))) return
        }
      }
      const vectors = members.map((p) => p.vector)
      const base = scoreVectors(vectors, lambda)
      const bonus = priority === 'supportCoverage'
        ? opportunities(vectors).filter((value) => value > 0).length * ((1 + lambda) * ordered.length * scale + 1)
        : 0
      visit(next, tripleAvailable && !consumeTriple, total + base + bonus)
    }
    for (let i = 0; i < rest.length; i++) {
      candidate([first, rest[i]], rest.filter((_, j) => i !== j), false)
    }
    if (tripleAvailable) {
      for (let i = 0; i < rest.length; i++) {
        for (let j = i + 1; j < rest.length; j++) {
          candidate([first, rest[i], rest[j]], rest.filter((_, k) => k !== i && k !== j), true)
        }
      }
    }
  }
  visit(ordered, ordered.length % 2 === 1, 0)
  return best
}

const sizeChecks = []
for (let n = 0; n <= 9; n++) {
  const input = profiles.slice(0, n)
  const result = solve(input)
  assert.equal(result.scoreInteger, bruteForce(input), `Desacuerdo con enumeración para N=${n}`)
  const members = result.groups.flat()
  assert.equal(new Set(members).size, members.length, 'Repetición de estudiante')
  assert.equal(members.length, n < 2 ? 0 : n, 'Cobertura incorrecta')
  assert.equal(result.groups.filter((group) => group.length === 3).length, n >= 3 ? n % 2 : 0)
  sizeChecks.push({ n, ...result })
}

// Contrasta restricciones duras con enumeración, incluido un problema imposible.
const forbiddenPairs = [[profiles[0].id, profiles[1].id], [profiles[1].id, profiles[2].id]]
for (const n of [4, 5, 6, 7]) {
  const result = solve(profiles.slice(0, n), { forbiddenPairs })
  assert.equal(result.scoreInteger, bruteForce(profiles.slice(0, n), { forbiddenPairs }))
  for (const group of result.groups) {
    assert.ok(!forbiddenPairs.some(([a, b]) => group.includes(a) && group.includes(b)))
  }
  const lexicographic = solve(profiles.slice(0, n), { forbiddenPairs, priority: 'supportCoverage' })
  assert.equal(lexicographic.objectiveInteger,
    bruteForce(profiles.slice(0, n), { forbiddenPairs, priority: 'supportCoverage' }))
}
assert.equal(solve(profiles.slice(0, 2), { forbiddenPairs }).status, 'INFEASIBLE_COMPLETE_COVERAGE')
assert.throws(() => solve([{ ...profiles[0], vector: [null, ...profiles[0].vector.slice(1)] }]), /NEEDS_DIAGNOSIS/)
assert.throws(() => solve([profiles[0], profiles[0]]), /IDs duplicados/)

let randomState = 12345
function random() {
  randomState = Math.imul(1664525, randomState) + 1013904223 | 0
  return (randomState >>> 0) / 4294967296
}
const randomizedOracleChecks = 60
for (let run = 0; run < randomizedOracleChecks; run++) {
  const n = 2 + run % 7
  const input = Array.from({ length: n }, (_, i) => ({
    id: `oracle-${i}`,
    vector: dimensions.map(() => Math.floor(random() * 9) / 8),
  }))
  const result = solve(input)
  assert.equal(result.scoreInteger, bruteForce(input), `Discrepancia aleatoria en caso ${run}`)
}
const equalProfiles = profiles.map((profile) => ({ ...profile, vector: dimensions.map(() => 0.5) }))
const equalResult = solve(equalProfiles)
assert.equal(equalResult.groups.length, 20)
assert.equal(equalResult.scoreInteger, 0)

console.log('Oráculo pequeño, restricciones, datos ausentes y perfiles iguales: correctos.')
const forty = solve(profiles)
assert.equal(forty.groups.length, 20)
assert.equal(new Set(forty.groups.flat()).size, 40)
assert.deepEqual(solve([...profiles].reverse()).groups, forty.groups, 'Dependencia del orden de entrada')
console.log(`40 estudiantes: ${forty.groups.length} parejas, utilidad ${forty.score}, ${forty.elapsedMs.toFixed(1)} ms.`)

const vectorLookup = new Map(profiles.map((p) => [p.id, p.vector]))
function evaluateGroups(groups, lambda = 1) {
  const scoreInteger = groups.reduce((sum, group) => sum
    + scoreVectors(group.map((id) => vectorLookup.get(id)), lambda), 0)
  const supported = groups.map((group) => opportunities(group.map((id) => vectorLookup.get(id))))
  return {
    score: round(scoreInteger / scale),
    scoreInteger,
    groupsWithPositiveSupportForEveryMember: supported.filter((values) => values.every((value) => value > 0)).length,
    studentsWithPositiveIncomingSupport: supported.flat().filter((value) => value > 0).length,
  }
}
function pairsFromOrder(ordered) {
  return Array.from({ length: ordered.length / 2 }, (_, i) => [ordered[2 * i].id, ordered[2 * i + 1].id])
}
const mean = (vector) => vector.reduce((a, b) => a + b, 0) / vector.length
const scoreOrder = [...profiles].sort((a, b) => mean(a.vector) - mean(b.vector) || a.id.localeCompare(b.id, 'en'))
const nearestOverall = evaluateGroups(pairsFromOrder(scoreOrder))
const cosine = (a, b) => {
  const norm = Math.hypot(...a) * Math.hypot(...b)
  // Convención para el baseline, no evidencia de parecido de estudiantes sin datos.
  return norm === 0 ? 0 : a.reduce((sum, value, k) => sum + value * b[k], 0) / norm
}
const cosineContext = solverContext(profiles)
const cosineMatching = cosineContext.even(profiles.map((_, i) => i), (a, b) => Math.round(cosine(a, b) * 1e6))
assert.ok(cosineMatching.complete)
const cosineGroups = evaluateGroups(cosineMatching.groups)
const candidateEdges = profiles.flatMap((a, i) => profiles.slice(i + 1).map((b) => ({
  members: [a.id, b.id],
  score: scoreVectors([a.vector, b.vector]),
}))).sort((a, b) => b.score - a.score || JSON.stringify(a.members).localeCompare(JSON.stringify(b.members), 'en'))
const used = new Set()
const greedyGroups = []
for (const { members } of candidateEdges) {
  if (members.some((id) => used.has(id))) continue
  members.forEach((id) => used.add(id))
  greedyGroups.push(members)
}
assert.equal(greedyGroups.length, 20)
const greedy = evaluateGroups(greedyGroups)
const randomScores = []
for (let run = 0; run < 500; run++) {
  const order = [...profiles]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  randomScores.push(evaluateGroups(pairsFromOrder(order)).scoreInteger)
}
for (const comparison of [nearestOverall, cosineGroups, greedy]) assert.ok(forty.scoreInteger >= comparison.scoreInteger)
assert.ok(randomScores.every((value) => value <= forty.scoreInteger))
const sensitivity = [0, 0.5, 1].map((lambda) => {
  const result = solve(profiles, { lambda })
  return { lambda, groups: result.groups, ...evaluateGroups(result.groups, lambda) }
})
const detailedForty = forty.groups.map((members) => {
  const vectors = members.map((id) => vectorLookup.get(id))
  const incoming = opportunities(vectors)
  const opportunitiesByMember = members.map((id, i) => ({
    studentId: id,
    incomingOpportunity: round(incoming[i]),
    dimensionsWherePeerHasHigherObservedScore: dimensions.filter((_, k) => vectors[1 - i][k] > vectors[i][k]),
  }))
  return {
    members,
    score: round(scoreVectors(vectors) / scale),
    evidence: opportunitiesByMember,
    supportFlags: incoming.some((value) => value === 0)
      ? ['El modelo no detecta oportunidades de recibir ayuda para todos; revisar actividad y aportes de explicar.']
      : [],
  }
})

const fortyCoverage = solve(profiles, { priority: 'supportCoverage' })
const coverageMetrics = evaluateGroups(fortyCoverage.groups)
assert.ok(coverageMetrics.studentsWithPositiveIncomingSupport
  >= evaluateGroups(forty.groups).studentsWithPositiveIncomingSupport)
assert.ok(fortyCoverage.scoreInteger <= forty.scoreInteger)
console.log(`Prioridad alternativa de cobertura de apoyo: ${coverageMetrics.studentsWithPositiveIncomingSupport}/40; utilidad ${coverageMetrics.score}.`)

console.log('Comienza caso impar: 39 estudiantes, 9 139 tríos candidatos y matching exacto restante.')
const thirtyNine = solve(profiles.slice(0, 39))
assert.equal(thirtyNine.groups.length, 19)
assert.equal(thirtyNine.groups.filter((group) => group.length === 3).length, 1)
assert.equal(new Set(thirtyNine.groups.flat()).size, 39)
assert.equal(thirtyNine.testedTriples, 9139)
console.log(`39 estudiantes: 18 parejas y 1 trío; ${thirtyNine.elapsedMs.toFixed(1)} ms.`)

const randomMean = randomScores.reduce((a, b) => a + b, 0) / randomScores.length / scale
const results = {
  simulated: true,
  objective: 'Q(G) = sum incoming opportunity + lambda * group size * min incoming opportunity',
  lambda: 1,
  integerScale: scale,
  scoreInterpretation: 'Utilidad de diseño, no porcentaje ni predicción calibrada de aprendizaje.',
  solver: { name: 'edmonds-blossom', version: '1.0.0', license: 'MIT', oddPolicy: 'enumerate-all-triples-then-blossom' },
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  evidenceLimit: 'Fixture única y validación computacional; sin estudiantes reales, calibración ni evaluación educativa. Prerrequisitos de actividad aún no incorporados.',
  verification: { exactSmallSizes: '0–9', randomizedOracleChecks, forbiddenPairs: true, missingData: true, duplicateIds: true, equalProfiles: true, inputOrderInvariantForForty: true },
  forty: { ...forty, groupDetails: detailedForty },
  fortyPrioritizingSupportCoverage: { ...fortyCoverage, metrics: coverageMetrics },
  thirtyNine,
  baselinesOnForty: {
    optimalProposedObjective: evaluateGroups(forty.groups),
    greedyProposedObjective: greedy,
    adjacentByOverallScore: nearestOverall,
    maximumCosineMatching: cosineGroups,
    random500: { meanScore: round(randomMean), bestScore: round(Math.max(...randomScores) / scale), worstScore: round(Math.min(...randomScores) / scale) },
    interpretation: 'Comparaciones dentro de la utilidad propuesta. Su máximo será favorable por construcción: no son pruebas de mayor aprendizaje.',
  },
  lambdaSensitivity: sensitivity,
  sizeChecks,
}
await writeFile(new URL('./resultado-optimizacion.json', import.meta.url), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify({ forty: { score: forty.score, elapsedMs: forty.elapsedMs }, thirtyNine: { score: thirtyNine.score, elapsedMs: thirtyNine.elapsedMs }, baselines: results.baselinesOnForty }, null, 2))

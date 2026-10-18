import { describe, expect, it } from 'vitest'
import { DEMO_STUDENTS } from '@/shared/lib/demoData'
import { analyzeGroup, complementarityScore, matchStudents } from '../algorithms/matchingAlgorithm'
import { DIMENSION_IDS, SCORE_SCALE } from '../data/matchingConfig'
import { prepareDemoProfiles } from '../data/prepareDemoProfiles'

const makeProfile = (id, skills) => ({ studentId: id, displayName: id, skills: Object.fromEntries(DIMENSION_IDS.map((key) => [key, typeof skills === 'number' ? skills : skills[key] ?? 0.5])) })

// Oráculo de selección: enumera todas las particiones sin utilizar Blossom.
function exhaustiveBest(profiles, options = {}) {
  const multiplier = 2 * profiles.length * SCORE_SCALE + 1
  let best = -Infinity
  function visit(remaining, tripleAvailable, score) {
    if (!remaining.length) {
      if (!tripleAvailable) best = Math.max(best, score)
      return
    }
    const [first, ...rest] = remaining
    const next = (group, tail, usesTriple) => {
      const analysis = analyzeGroup(group, options)
      visit(tail, tripleAvailable && !usesTriple, score + analysis.supportedStudentCount * multiplier + analysis.utilityInteger)
    }
    for (let i = 0; i < rest.length; i++) next([first, rest[i]], rest.filter((_, j) => j !== i), false)
    if (tripleAvailable) {
      for (let i = 0; i < rest.length; i++) {
        for (let j = i + 1; j < rest.length; j++) next([first, rest[i], rest[j]], rest.filter((_, k) => k !== i && k !== j), true)
      }
    }
  }
  visit(profiles, profiles.length % 2 === 1, 0)
  return best
}

describe('fuente demo compartida', () => {
  it('usa exactamente los perfiles y valores de shared, sin otra fuente de puntuaciones', () => {
    const profiles = prepareDemoProfiles()
    expect(profiles).toHaveLength(DEMO_STUDENTS.length)
    profiles.forEach((profile, index) => {
      expect(profile.studentId).toBe(DEMO_STUDENTS[index].id)
      expect(profile.skills).toEqual(DEMO_STUDENTS[index].skills)
    })
    const forty = prepareDemoProfiles(40)
    expect(new Set(forty.map(({ studentId }) => studentId)).size).toBe(40)
    forty.forEach((profile) => expect(profile.skills).toEqual(DEMO_STUDENTS.find(({ id }) => id === profile.templateStudentId).skills))
    profiles[0].skills.addition = 0
    expect(DEMO_STUDENTS[0].skills.addition).toBe(0.92)
  })

  it('valida cantidades y produce una demo reproducible', () => {
    expect(prepareDemoProfiles(5, 2)).toEqual(prepareDemoProfiles(5, 2))
    expect(() => prepareDemoProfiles(-1)).toThrow()
    expect(() => prepareDemoProfiles(2.5)).toThrow()
    expect(() => prepareDemoProfiles(41)).toThrow()
  })
})

describe('matching exacto', () => {
  it.each([[0, [], 'empty'], [1, [], 'waiting'], [2, [2], 'optimal'], [3, [3], 'optimal'], [4, [2, 2], 'optimal'], [5, [2, 3], 'optimal']])(
    'respeta la política con %i estudiantes', (n, sizes, status) => {
      const result = matchStudents(prepareDemoProfiles(n))
      expect(result.status).toBe(status)
      expect(result.groups.map(({ size }) => size).sort()).toEqual(sizes)
      const members = result.groups.flatMap(({ studentIds }) => studentIds)
      expect(new Set(members).size).toBe(members.length)
      expect(members.length + result.unmatchedStudentIds.length).toBe(n)
    },
  )

  it('calcula aportes cruzados en la actividad pertinente', () => {
    const a = makeProfile('a', { addition: 1, subtraction: 0 })
    const b = makeProfile('b', { addition: 0, subtraction: 1 })
    const analysis = analyzeGroup([a, b])
    expect(analysis.activity.id).toBe('additive-strategies')
    expect(analysis.supportedStudentCount).toBe(2)
    expect(analysis.utilityInteger).toBe(1_333_333)
    expect(complementarityScore(a, b)).toBeCloseTo(1 / 3, 5)
  })

  it('contrasta la asignación con todas las particiones para varios escenarios pares e impares', () => {
    for (let scenario = 0; scenario < 3; scenario++) {
      for (const n of [4, 5, 6, 7]) {
        const profiles = prepareDemoProfiles(n, scenario)
        const result = matchStudents(profiles)
        const objective = result.summary.supportedStudentCount * (2 * n * SCORE_SCALE + 1) + Math.round(result.totalScore * SCORE_SCALE)
        expect(objective).toBe(exhaustiveBest(profiles))
      }
    }
  })

  it('forma 20 parejas con 40 y conserva la salida byte a byte al reordenar entradas', () => {
    const profiles = prepareDemoProfiles(40)
    const result = matchStudents(profiles)
    expect(result.summary.pairCount).toBe(20)
    expect(result.groups.flatMap(({ studentIds }) => studentIds)).toHaveLength(40)
    expect(JSON.stringify(matchStudents([...profiles].reverse()))).toBe(JSON.stringify(result))
  })

  it('evalúa todos los tríos de un aula impar completa', () => {
    const result = matchStudents(prepareDemoProfiles(39))
    expect(result.summary).toMatchObject({ pairCount: 18, trioCount: 1, candidateTriples: 9139 })
    expect(new Set(result.groups.flatMap(({ studentIds }) => studentIds)).size).toBe(39)
  }, 20000)

  it('expone revisión docente cuando hay perfiles iguales o ayuda asimétrica', () => {
    const same = matchStudents([makeProfile('a', 0.5), makeProfile('b', 0.5)])
    expect(same.groups[0].supportedStudentCount).toBe(0)
    expect(same.groups[0].supportFlags).not.toHaveLength(0)
    const asymmetric = matchStudents([makeProfile('a', 1), makeProfile('b', 0)])
    expect(asymmetric.groups[0].supportedStudentCount).toBe(1)
    expect(asymmetric.groups[0].supportFlags).not.toHaveLength(0)
  })

  it('reserva retos de profundización para perfiles altos en todo lo evaluado', () => {
    const result = matchStudents([makeProfile('a', 0.9), makeProfile('b', 0.9)])
    expect(result.groups[0].activity.id).toBe('challenge')
  })

  it('cumple restricciones o informa imposibilidad sin relajar prohibiciones', () => {
    const profiles = prepareDemoProfiles(4)
    const forbiddenPairs = [[profiles[0].studentId, profiles[1].studentId]]
    const result = matchStudents(profiles, { forbiddenPairs })
    expect(result.status).toBe('optimal')
    expect(result.groups.every(({ studentIds }) => !forbiddenPairs.some((pair) => pair.every((id) => studentIds.includes(id))))).toBe(true)
    expect(matchStudents(profiles.slice(0, 2), { forbiddenPairs }).status).toBe('infeasible')
  })

  it('rechaza duplicados y evidencia ausente sin convertirla en cero', () => {
    const profiles = prepareDemoProfiles(2)
    expect(() => matchStudents([profiles[0], profiles[0]])).toThrow(/duplicado/)
    expect(() => matchStudents([{ ...profiles[0], skills: { ...profiles[0].skills, fraction: null } }])).toThrow(/evidencia/)
    expect(() => matchStudents([{ ...profiles[0], skills: { ...profiles[0].skills, fraction: 1.1 } }])).toThrow(/evidencia/)
  })

  it('mantiene optimalidad global con un subconjunto declarado de habilidades evaluadas', () => {
    const options = { skillIds: ['fraction', 'subtraction', 'addition'] }
    const source = prepareDemoProfiles(7).map(({ studentId, skills }) => ({ studentId, skills: { addition: skills.addition, subtraction: skills.subtraction, fraction: skills.fraction } }))
    for (const count of [4, 5, 6, 7]) {
      const profiles = source.slice(0, count)
      const result = matchStudents(profiles, options)
      const objective = result.summary.supportedStudentCount * (2 * count * SCORE_SCALE + 1) + Math.round(result.totalScore * SCORE_SCALE)
      expect(objective).toBe(exhaustiveBest(profiles, options))
      expect(result.evaluatedSkillIds).toEqual(['addition', 'subtraction', 'fraction'])
      expect(result.groups.every((group) => group.activity.skillIds.every((id) => options.skillIds.includes(id)))).toBe(true)
    }
  })
})

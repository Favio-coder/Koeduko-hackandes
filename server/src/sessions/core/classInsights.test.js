import { describe, expect, it } from 'vitest'
import { MIN_OBSERVATIONS, addReport, describeInsights, emptyInsights, summaryForTeacher } from './classInsights.js'

const student = (states) => ({ key: 'x', capacidades: ['traduce', 'comunica', 'usa-estrategias', 'argumenta'].map((id, i) => ({ id, estado: states[i] })) })
const WITH = 'con evidencia'
const PART = 'evidencia parcial'
const NONE = 'sin evidencia suficiente'
const report = (skillId, ...students) => ({ problema: { skillId }, estudiantes: students })

describe('addReport', () => {
  it('counts sessions, students and the state of each capability by skill, without mutating the previous value', () => {
    const before = emptyInsights()
    const after = addReport(before, report('multiplication', student([WITH, WITH, PART, NONE]), student([NONE, WITH, NONE, NONE])))
    expect(before).toEqual(emptyInsights())
    expect(after).toMatchObject({ sessions: 1, students: 2 })
    expect(after.skills.multiplication.traduce).toEqual({ con: 1, parcial: 0, sin: 1 })
    expect(after.skills.multiplication.argumenta).toEqual({ con: 0, parcial: 0, sin: 2 })
    expect(after.skills.multiplication['usa-estrategias']).toEqual({ con: 0, parcial: 1, sin: 1 })
  })

  it('accumulates across rooms and keeps skills apart', () => {
    let insights = addReport(emptyInsights(), report('multiplication', student([WITH, WITH, WITH, WITH])))
    insights = addReport(insights, report('division', student([NONE, NONE, NONE, NONE])))
    insights = addReport(insights, report('multiplication', student([NONE, WITH, WITH, WITH])))
    expect(insights).toMatchObject({ sessions: 3, students: 3 })
    expect(insights.skills.multiplication.traduce).toEqual({ con: 1, parcial: 0, sin: 1 })
    expect(insights.skills.division.traduce).toEqual({ con: 0, parcial: 0, sin: 1 })
  })

  it('ignores an empty or malformed report and a malformed stored document, never throwing', () => {
    expect(addReport(emptyInsights(), report('multiplication'))).toEqual(emptyInsights())
    for (const junk of [null, undefined, 'x', 7, { skills: 'x' }, { skills: { division: 'x' } }, { sessions: -4 }]) {
      expect(() => addReport(junk, report('division', student([WITH, WITH, WITH, WITH])))).not.toThrow()
    }
    expect(addReport(null, report('division', student([WITH, WITH, WITH, WITH]))).sessions).toBe(1)
  })

  it('stores only counts: no names, no quotes', () => {
    const withQuote = { problema: { skillId: 'division' }, estudiantes: [{ key: 'ana torres', name: 'Ana', capacidades: [{ id: 'traduce', estado: WITH, evidencia: [{ cita: 'son ochenta y ocho' }] }] }] }
    expect(JSON.stringify(addReport(emptyInsights(), withQuote))).not.toMatch(/ana|torres|ochenta/i)
  })
})

describe('summaryForTeacher', () => {
  it('lists the capabilities from the hardest to the easiest, with plain counts', () => {
    const insights = [student([WITH, WITH, WITH, NONE]), student([WITH, WITH, PART, NONE]), student([NONE, WITH, WITH, NONE])].reduce((acc, s) => addReport(acc, report('multiplication', s)), emptyInsights())
    const summary = summaryForTeacher(insights)
    expect(summary).toMatchObject({ sessions: 3, students: 3 })
    expect(summary.capacities[0]).toMatchObject({ id: 'argumenta', sin: 3, total: 3, sinPct: 100 })
    expect(summary.capacities.at(-1).sinPct).toBeLessThanOrEqual(summary.capacities[0].sinPct)
    expect(summary.skills).toEqual([{ id: 'multiplication', nombre: 'multiplicación' }])
  })

  it('is safe with no data', () => {
    expect(summaryForTeacher(null)).toMatchObject({ sessions: 0, students: 0 })
    expect(summaryForTeacher(emptyInsights()).capacities.every((c) => c.total === 0)).toBe(true)
  })
})

describe('describeInsights: one line for the tutor, no numbers', () => {
  const hard = Array.from({ length: MIN_OBSERVATIONS }, () => student([WITH, WITH, WITH, NONE])).reduce((acc, s) => addReport(acc, report('multiplication', s)), emptyInsights())

  it('names what has been hardest in other rooms for that skill', () => {
    const line = describeInsights(hard, 'multiplication')
    expect(line).toBe('En otras salas de este curso, lo que más ha costado en multiplicación es: argumenta afirmaciones sobre las relaciones numéricas y las operaciones.')
    expect(line).not.toMatch(/\d/)
  })

  it('says nothing with too few observations, when nothing stands out, or for a skill with no data', () => {
    expect(describeInsights(addReport(emptyInsights(), report('multiplication', student([WITH, WITH, WITH, NONE]))), 'multiplication')).toBe('')
    const easy = Array.from({ length: 5 }, () => student([WITH, WITH, WITH, WITH])).reduce((acc, s) => addReport(acc, report('multiplication', s)), emptyInsights())
    expect(describeInsights(easy, 'multiplication')).toBe('')
    expect(describeInsights(emptyInsights(), 'multiplication')).toBe('')
    expect(describeInsights(null, 'division')).toBe('')
  })
})

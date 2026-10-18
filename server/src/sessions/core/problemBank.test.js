import { describe, expect, it } from 'vitest'
import { extractNumbers } from './spanishNumbers.js'
import { BANK_SKILLS, pickProblem } from './problemBank.js'

describe('pickProblem', () => {
  it('is deterministic: the same skill and seed give the same problem', () => {
    for (const skill of BANK_SKILLS) {
      expect(pickProblem({ skillIds: [skill], seed: 'room-1' })).toEqual(pickProblem({ skillIds: [skill], seed: 'room-1' }))
    }
  })

  it('gives different problems to different rooms', () => {
    const texts = new Set(Array.from({ length: 12 }, (_, i) => pickProblem({ skillIds: ['multiplication'], seed: `room-${i}` }).text))
    expect(texts.size).toBeGreaterThan(6)
  })

  it('covers every evaluated skill with a whole-number answer that is NOT in the statement', () => {
    for (const skill of BANK_SKILLS) {
      for (let i = 0; i < 40; i += 1) {
        const problem = pickProblem({ skillIds: [skill], seed: `seed-${i}` })
        expect(problem.skillId).toBe(skill)
        expect(Number.isInteger(problem.expectedAnswer)).toBe(true)
        expect(problem.expectedAnswer).toBeGreaterThan(0)
        expect(problem.text.length).toBeGreaterThan(30)
        expect(extractNumbers(problem.text)).not.toContain(problem.expectedAnswer)
        expect(problem.activityId).toBe(`auto-${skill}`)
      }
    }
  })

  it('computes the right answer (checked by hand per skill)', () => {
    const mult = pickProblem({ skillIds: ['multiplication'], seed: 'x' })
    const [a, b] = extractNumbers(mult.text)
    expect(mult.expectedAnswer).toBe(a * b)

    const sub = pickProblem({ skillIds: ['subtraction'], seed: 'x' })
    const [from, minus] = extractNumbers(sub.text)
    expect(sub.expectedAnswer).toBe(from - minus)

    const div = pickProblem({ skillIds: ['division'], seed: 'x' })
    const [total, kids] = extractNumbers(div.text)
    expect(total / kids).toBe(div.expectedAnswer)

    const frac = pickProblem({ skillIds: ['fraction'], seed: 'x' })
    expect(extractNumbers(frac.text)[0] / 4).toBe(frac.expectedAnswer)
  })

  it('picks among the focus skills of the group, and falls back to multiplication for unknown or missing ones', () => {
    const seen = new Set(Array.from({ length: 30 }, (_, i) => pickProblem({ skillIds: ['addition', 'division'], seed: `r${i}` }).skillId))
    expect([...seen].sort()).toEqual(['addition', 'division'])
    for (const skillIds of [null, undefined, [], ['algebra'], 'addition']) {
      expect(pickProblem({ skillIds, seed: 's' }).skillId).toBe('multiplication')
    }
  })
})

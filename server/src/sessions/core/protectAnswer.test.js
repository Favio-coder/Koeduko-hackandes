import { describe, expect, it } from 'vitest'
import { splitAnswer } from './protectAnswer.js'

const problem = { activityId: 'p-01', skillId: 'multiplication', text: '6 cajas con 8 lápices', expectedAnswer: 48 }

describe('splitAnswer', () => {
  it('leaves activityId, skillId and text in the public problem and moves the answer out', () => {
    const result = splitAnswer({ title: 'x', currentProblem: problem })
    expect(result.needed).toBe(true)
    expect(result.publicProblem).toEqual({ activityId: 'p-01', skillId: 'multiplication', text: '6 cajas con 8 lápices' })
    expect(result.answer).toEqual({ activityId: 'p-01', expectedAnswer: 48 })
    expect(JSON.stringify(result.publicProblem)).not.toContain('48')
  })

  it('accepts a legacy id and a numeric string', () => {
    const result = splitAnswer({ currentProblem: { id: 'p-9', text: 't', expectedAnswer: '12' } })
    expect(result.answer).toEqual({ activityId: 'p-9', expectedAnswer: 12 })
  })

  it('does nothing when there is no problem, no answer or it is not a number (idempotent)', () => {
    expect(splitAnswer(null)).toEqual({ needed: false })
    expect(splitAnswer({})).toEqual({ needed: false })
    expect(splitAnswer({ currentProblem: { activityId: 'p-01', text: 't' } })).toEqual({ needed: false })
    expect(splitAnswer({ currentProblem: { ...problem, expectedAnswer: 'abc' } })).toEqual({ needed: false })
  })

  it('does not mutate the session', () => {
    const session = { currentProblem: { ...problem } }
    splitAnswer(session)
    expect(session.currentProblem.expectedAnswer).toBe(48)
  })
})

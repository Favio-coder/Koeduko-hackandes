import { describe, expect, it } from 'vitest'
import { OUTCOME, outcomesOf } from './interventionOutcome.js'
import { DECAY, MIN_TRIES, STYLES, chooseStyle, describeLearning, rateOf, recordOutcome, recordOutcomes, seededUnit, statsOf } from './learning.js'

const win = (profile, signal, style, times = 1) => recordOutcomes(profile, Array.from({ length: times }, () => ({ signal, style, outcome: OUTCOME.IMPROVED })))
const lose = (profile, signal, style, times = 1) => recordOutcomes(profile, Array.from({ length: times }, () => ({ signal, style, outcome: OUTCOME.NO_CHANGE })))

describe('outcomesOf: what happened after each intervention', () => {
  const problem = { expectedAnswer: 48 }
  const say = (k, t, x) => ({ k, t, x })

  it('WRONG_ANSWER improves when the addressee then gives the expected answer, or plans the operation', () => {
    const base = { id: 'i1', signal: 'WRONG_ANSWER', participantKey: 'a', t: 100, style: 'pregunta' }
    expect(outcomesOf({ interventions: [base], transcripts: [say('a', 110, 'ah, son cuarenta y ocho')], problem })[0].outcome).toBe(OUTCOME.IMPROVED)
    expect(outcomesOf({ interventions: [base], transcripts: [say('a', 110, 'seis por ocho')], problem })[0].outcome).toBe(OUTCOME.IMPROVED)
    expect(outcomesOf({ interventions: [base], transcripts: [say('a', 110, 'creo que son cuarenta y dos')], problem })[0].outcome).toBe(OUTCOME.NO_CHANGE)
  })

  it('only looks at the window after the intervention, and only at the addressee for answers', () => {
    const base = { signal: 'WRONG_ANSWER', participantKey: 'a', t: 100 }
    const before = [say('a', 90, 'son cuarenta y ocho')]
    const late = [say('a', 200, 'son cuarenta y ocho')]
    const other = [say('b', 110, 'son cuarenta y ocho')]
    for (const transcripts of [before, late, other]) {
      expect(outcomesOf({ interventions: [base], transcripts, problem })[0].outcome).toBe(OUTCOME.NO_CHANGE)
    }
  })

  it('SILENT_PEER improves when the quiet person speaks; DOMINANCE when someone else does', () => {
    const talk = 'yo pienso que hay que sumar las cajas de lápices'
    const silent = { signal: 'SILENT_PEER', participantKey: 'b', t: 50 }
    expect(outcomesOf({ interventions: [silent], transcripts: [say('b', 60, talk)] })[0].outcome).toBe(OUTCOME.IMPROVED)
    expect(outcomesOf({ interventions: [silent], transcripts: [say('b', 60, 'no sé')] })[0].outcome).toBe(OUTCOME.NO_CHANGE)

    const dominant = { signal: 'DOMINANCE', participantKey: 'a', t: 50 }
    expect(outcomesOf({ interventions: [dominant], transcripts: [say('b', 60, talk)] })[0].outcome).toBe(OUTCOME.IMPROVED)
    expect(outcomesOf({ interventions: [dominant], transcripts: [say('a', 60, talk)] })[0].outcome).toBe(OUTCOME.NO_CHANGE)
  })

  it('STUCK improves with an answer, a plan or talk without confusion; not with more confusion', () => {
    const stuck = { signal: 'STUCK', participantKey: 'a', t: 50 }
    expect(outcomesOf({ interventions: [stuck], transcripts: [say('a', 60, 'a ver, entonces cada caja tiene ocho lápices y hay seis')], problem })[0].outcome).toBe(OUTCOME.IMPROVED)
    expect(outcomesOf({ interventions: [stuck], transcripts: [say('a', 60, 'no entiendo nada de esto, no sé cómo se hace')], problem })[0].outcome).toBe(OUTCOME.NO_CHANGE)
  })

  it('group signals and interventions without a clock are unknown: nothing is learned from them', () => {
    expect(outcomesOf({ interventions: [{ signal: 'STUCK', participantKey: null, t: 10 }], transcripts: [] })[0].outcome).toBe(OUTCOME.UNKNOWN)
    expect(outcomesOf({ interventions: [{ signal: 'STUCK', participantKey: 'a' }], transcripts: [] })[0].outcome).toBe(OUTCOME.UNKNOWN)
    expect(outcomesOf({ interventions: [{ signal: 'OTRA', participantKey: 'a', t: 1 }], transcripts: [] })[0].outcome).toBe(OUTCOME.UNKNOWN)
  })
})

describe('chooseStyle: learns what works for each student and signal', () => {
  it('tries every style MIN_TRIES times before deciding', () => {
    const seen = new Set()
    let profile = {}
    for (let i = 0; i < STYLES.length * MIN_TRIES; i += 1) {
      const { style, reason } = chooseStyle(profile, 'STUCK', `s:${i}`)
      expect(reason).toBe('explore')
      seen.add(style)
      profile = lose(profile, 'STUCK', style)
    }
    expect([...seen].sort()).toEqual([...STYLES].sort())
    expect(chooseStyle(profile, 'STUCK', 'x').reason).not.toBe('explore')
  })

  it('then prefers the style that improved the situation, almost always', () => {
    let profile = {}
    for (const style of STYLES) profile = style === 'pista' ? win(profile, 'STUCK', style, 4) : lose(profile, 'STUCK', style, 4)
    const picks = Array.from({ length: 200 }, (_, i) => chooseStyle(profile, 'STUCK', `seed-${i}`))
    const exploit = picks.filter((p) => p.reason === 'exploit')
    expect(exploit.length).toBeGreaterThan(150)
    expect(exploit.every((p) => p.style === 'pista')).toBe(true)
  })

  it('keeps stats per signal: what works for STUCK says nothing about SILENT_PEER', () => {
    const profile = win({}, 'STUCK', 'pista', 5)
    expect(statsOf(profile, 'SILENT_PEER', 'pista')).toEqual({ tries: 0, wins: 0 })
    expect(chooseStyle(profile, 'SILENT_PEER', 'x').reason).toBe('explore')
  })

  it('is deterministic for the same seed', () => {
    const profile = win(lose({}, 'STUCK', 'pregunta', 3), 'STUCK', 'paso', 3)
    expect(chooseStyle(profile, 'STUCK', 'same')).toEqual(chooseStyle(profile, 'STUCK', 'same'))
    expect(seededUnit('a')).toBeGreaterThanOrEqual(0)
    expect(seededUnit('a')).toBeLessThan(1)
  })

  it('survives a missing or malformed profile', () => {
    for (const profile of [null, undefined, {}, { styles: 'x' }, { styles: { STUCK: { pista: { tries: 'a' } } } }]) {
      expect(STYLES).toContain(chooseStyle(profile, 'STUCK', 's').style)
    }
  })
})

describe('recordOutcome', () => {
  it('counts tries and wins without mutating the profile, and ignores unknown outcomes and styles', () => {
    const profile = Object.freeze({ sessions: 2 })
    const next = recordOutcome(profile, { signal: 'STUCK', style: 'pista', outcome: OUTCOME.IMPROVED })
    expect(next).toMatchObject({ sessions: 2, styles: { STUCK: { pista: { tries: 1, wins: 1 } } } })
    expect(recordOutcome(next, { signal: 'STUCK', style: 'pista', outcome: OUTCOME.UNKNOWN })).toBe(next)
    expect(recordOutcome(next, { signal: 'STUCK', style: 'inventado', outcome: OUTCOME.IMPROVED })).toBe(next)
  })

  it('makes the old weigh less (decay), so recent results win', () => {
    let profile = {}
    for (let i = 0; i < 6; i += 1) profile = win(profile, 'STUCK', 'pista')
    const before = statsOf(profile, 'STUCK', 'pista')
    const after = statsOf(lose(profile, 'STUCK', 'pista'), 'STUCK', 'pista')
    expect(after.tries).toBeCloseTo(before.tries * DECAY + 1, 1)
    expect(after.wins).toBeCloseTo(before.wins * DECAY, 1)
    expect(rateOf(after)).toBeLessThan(rateOf(before))
  })
})

describe('describeLearning', () => {
  it('says nothing without enough data, and names the style that worked otherwise', () => {
    expect(describeLearning({}, 'STUCK')).toBe('')
    expect(describeLearning(win({}, 'STUCK', 'pista', 3), 'STUCK')).toContain('el estilo pista')
    expect(describeLearning(lose({}, 'STUCK', 'pista', 4), 'STUCK')).toBe('')
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { replaySignals } from './replay.js'

/**
 * El motor contra la sesion real de la prueba de humo (fixtures/smoke-001.json):
 * Estudiante A y C conversan, Estudiante B entro y nunca hablo.
 */
const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/smoke-001.json', import.meta.url), 'utf8'))
const detected = (timeline) => timeline.flatMap(({ now, signals }) => signals.map((s) => ({ now, ...s })))

describe('signals engine over the real smoke-001 session', () => {
  it('has the expected participants in the fixture', () => {
    expect(fixture.participants.map((p) => p.participantKey)).toEqual(['estudiante a', 'estudiante b', 'estudiante c'])
    const spoke = new Set(fixture.events.filter((e) => e.type === 'speech_on').map((e) => e.participantKey))
    expect([...spoke].sort()).toEqual(['estudiante a', 'estudiante c'])
  })

  it('detects only SILENT_PEER, only for the participant who never spoke', () => {
    const all = detected(replaySignals(fixture.events, { stepSec: 5 }))

    expect(all.length).toBeGreaterThan(0)
    expect(new Set(all.map((s) => `${s.type}:${s.participantKey}`))).toEqual(new Set(['SILENT_PEER:estudiante b']))
  })

  it('fires SILENT_PEER as soon as there is enough conversation (45 s of speech)', () => {
    const timeline = replaySignals(fixture.events, { stepSec: 5 })
    const first = detected(timeline).find((s) => s.type === 'SILENT_PEER')

    expect(first.now).toBe(55)
    expect(first.evidence.totalSpeechSec).toBeGreaterThanOrEqual(45)
    expect(first.evidence.shares['estudiante b']).toBe(0)
    expect(first.evidence.shares['estudiante a']).toBeCloseTo(0.5, 1)
    expect(first.evidence.shares['estudiante c']).toBeCloseTo(0.5, 1)
    expect(first.evidence.presentSec).toBeGreaterThanOrEqual(30)
  })

  it('does not call the balanced pair dominant, silent, stuck or in group silence', () => {
    const types = new Set(detected(replaySignals(fixture.events, { stepSec: 5 })).map((s) => s.type))
    for (const type of ['DOMINANCE', 'GROUP_SILENCE', 'STUCK', 'WRONG_ANSWER', 'CORRECT_ANSWER']) {
      expect(types.has(type)).toBe(false)
    }
  })

  it('intervenes once for the quiet peer and the cooldown stops repeating it', () => {
    const chosen = replaySignals(fixture.events, { stepSec: 5 }).flatMap(({ now, selected }) => selected.map((s) => ({ now, ...s })))
    expect(chosen.map((s) => [s.now, s.type, s.participantKey])).toEqual([[55, 'SILENT_PEER', 'estudiante b']])
  })

  it('recognises a spoken answer ("Dos.") against an illustrative problem, and nothing else', () => {
    const problem = { activityId: 'act-demo', skillId: 'demo', text: 'problema ilustrativo', expectedAnswer: 2, startedAtT: 35 }
    const all = detected(replaySignals(fixture.events, { stepSec: 5, problem }))
    const answers = all.filter((s) => s.type.endsWith('_ANSWER'))

    expect(answers.map((s) => [s.type, s.participantKey])).toEqual([['CORRECT_ANSWER', 'estudiante c']])
    expect(answers[0].evidence).toMatchObject({ expectedAnswer: 2, numbers: [2], skillId: 'demo', activityId: 'act-demo' })
  })

  it('marks the same spoken "Dos." as wrong when the expected answer is another number', () => {
    const problem = { activityId: 'act-demo', skillId: 'demo', text: 'problema ilustrativo', expectedAnswer: 48, startedAtT: 35 }
    const answers = detected(replaySignals(fixture.events, { stepSec: 5, problem })).filter((s) => s.type.endsWith('_ANSWER'))

    expect(answers.map((s) => [s.type, s.participantKey])).toEqual([['WRONG_ANSWER', 'estudiante c']])
  })

  it('is deterministic over the whole session', () => {
    expect(replaySignals(fixture.events, { stepSec: 5 })).toEqual(replaySignals([...fixture.events].reverse(), { stepSec: 5 }))
  })
})

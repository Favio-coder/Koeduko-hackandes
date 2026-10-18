import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emptyState } from './liveEngine.js'
import { processEvent } from './liveEngine.js'
import { inArrivalOrder, toRecallPayload } from './recallPayload.js'
import { normalizeRecallEvent } from './recallEvents.js'

// smoke-002: la primera prueba real de MATEMATICA en Meet (18-oct-2026), con un solo participante.
const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/smoke-002.json', import.meta.url), 'utf8'))
const problem = { activityId: 'p-01', skillId: 'multiplication', text: 'Hay 6 cajas con 8 lápices cada una.', expectedAnswer: 48 }

describe('fixtures/smoke-002.json', () => {
  it('is anonymized: one participant, no real name anywhere', () => {
    expect(fixture.participants).toEqual([{ participantId: 100, participantKey: 'estudiante a' }])
  })

  it('has every event type of a real session, and its counts add up', () => {
    expect(fixture.counts).toEqual({ join: 1, speech_on: 7, transcript: 8, speech_off: 7, leave: 1 })
    expect(fixture.events).toHaveLength(24)
    expect(Object.values(fixture.counts).reduce((a, b) => a + b, 0)).toBe(fixture.events.length)
  })

  it('survives the trip through the normalizer (every event comes back as itself)', () => {
    for (const original of fixture.events) {
      const normalized = normalizeRecallEvent(toRecallPayload(original, { sessionId: 'smoke-replay-002' }))
      const { id, ...expected } = original
      expect(normalized, `${original.type} t=${original.t}`).not.toBeNull()
      expect(normalized.eventId).toBe(id)
      expect(normalized.event).toEqual(expected)
    }
  })

  it('arrives in a coherent order: no speech ends before it starts', () => {
    let open = null
    for (const event of [...fixture.events].sort((a, b) => a.t - b.t)) {
      if (event.type === 'speech_on') {
        expect(open).toBeNull()
        open = event.t
      }
      if (event.type === 'speech_off') {
        expect(open).not.toBeNull()
        expect(event.t).toBeGreaterThan(open)
        open = null
      }
    }
  })

  it('makes the engine react the way it did in production: STUCK around 53 s, then CORRECT_ANSWER around 95 s', () => {
    let state = emptyState()
    const interventions = []
    for (const event of inArrivalOrder(fixture.events)) {
      const result = processEvent(state, event, { eventId: event.id, problem })
      state = result.state
      if (result.intervention) interventions.push({ type: result.intervention.type, t: Math.round(result.intervention.t) })
    }
    expect(interventions.map((i) => i.type)).toEqual(['STUCK', 'CORRECT_ANSWER', 'STUCK'])
    expect(interventions[0].t).toBeGreaterThanOrEqual(50)
    expect(interventions[0].t).toBeLessThanOrEqual(56)
    expect(interventions[1].t).toBeGreaterThanOrEqual(92)
    expect(interventions[1].t).toBeLessThanOrEqual(98)
  })

  it('accumulates the whole-session speech for the report (63 s and 7 turns)', () => {
    let state = emptyState()
    for (const event of inArrivalOrder(fixture.events)) state = processEvent(state, event, { eventId: event.id, problem }).state
    const mine = state.totals.find((t) => t.k === 'estudiante a')
    expect(mine.turns).toBe(7)
    expect(mine.sec).toBeGreaterThan(60)
    expect(mine.sec).toBeLessThan(66)
  })
})

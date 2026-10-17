import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emptyState, evaluateDue, historyOf, ingestEvent, problemFromSession, processEvent } from './liveEngine.js'
import { DEFAULT_CONFIG } from './signals.js'

const join = (key, t) => ({ type: 'join', participantKey: key, studentId: null, t, tEnd: null, text: null })
const on = (key, t) => ({ type: 'speech_on', participantKey: key, studentId: null, t, tEnd: null, text: null })
const off = (key, t) => ({ type: 'speech_off', participantKey: key, studentId: null, t, tEnd: null, text: null })
const say = (key, t, tEnd, text) => ({ type: 'transcript', participantKey: key, studentId: null, t, tEnd, text })

/** Reproduce eventos en orden y devuelve cada evaluacion que ocurrio. */
function run(events, { problem = null, config = {} } = {}) {
  let state = emptyState()
  const evaluations = []
  for (const event of events) {
    const result = processEvent(state, event, { problem, config })
    state = result.state
    if (result.evaluated) evaluations.push({ at: state.lastT, intervention: result.intervention })
  }
  return { state, evaluations }
}

describe('problemFromSession', () => {
  it('maps currentProblem to the engine problem', () => {
    expect(problemFromSession({ currentProblem: { id: 'p-03', text: '6 x 8', expectedAnswer: 48, skillId: 'multiplication' } })).toEqual({
      activityId: 'p-03',
      skillId: 'multiplication',
      text: '6 x 8',
      expectedAnswer: 48,
    })
  })

  it('prefers activityId and accepts a numeric string', () => {
    expect(problemFromSession({ currentProblem: { id: 'x', activityId: 'act-9', expectedAnswer: '12' } })).toMatchObject({ activityId: 'act-9', expectedAnswer: 12 })
  })

  it.each([undefined, null, {}, { currentProblem: null }, { currentProblem: { id: 'p', expectedAnswer: 'abc' } }, { currentProblem: { expectedAnswer: 3 } }])(
    'returns null when there is no usable problem (%j)',
    (session) => {
      expect(problemFromSession(session)).toBeNull()
    },
  )
})

describe('throttle: at most one evaluation every evalEverySec of session time', () => {
  it('evaluates on the first event and then not again until 5 s have passed', () => {
    const events = [join('a', 0), join('b', 0), on('a', 1), off('a', 2), on('b', 3), off('b', 4), on('a', 5), off('a', 5.9), on('b', 6), off('b', 7)]
    const { evaluations } = run(events)
    expect(evaluations.map((e) => e.at)).toEqual([0, 5, 6].slice(0, evaluations.length))
    // 0 (primer evento), luego el primer evento con lastT >= 5
    expect(evaluations[0].at).toBe(0)
    expect(evaluations[1].at).toBeGreaterThanOrEqual(5)
  })

  it('never evaluates twice inside the same 5 s, however many events arrive', () => {
    const burst = Array.from({ length: 40 }, (_, i) => (i % 2 ? off('a', 10 + i * 0.1) : on('a', 10 + i * 0.1)))
    const { evaluations } = run([join('a', 0), join('b', 0), ...burst])
    const times = evaluations.map((e) => e.at)
    for (let i = 1; i < times.length; i += 1) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(DEFAULT_CONFIG.evalEverySec)
    expect(evaluations.length).toBeLessThanOrEqual(3)
  })

  it('does not evaluate for an event that changed nothing', () => {
    const first = processEvent(emptyState(), join('a', 0))
    const second = processEvent(first.state, { type: 'weird', participantKey: 'a', t: 99 })
    expect(second.evaluated).toBe(false)
    expect(second.state).toBe(first.state)
  })

  it('keeps session time monotonic when a transcript arrives with an older end time', () => {
    const ingested = ingestEvent(processEvent(emptyState(), on('a', 20)).state, say('a', 15, 18, 'hola'))
    expect(ingested.state.lastT).toBe(20)
  })

  it('honours a custom interval', () => {
    const { evaluations } = run([join('a', 0), join('b', 0), on('a', 1), off('a', 2), on('b', 3)], { config: { evalEverySec: 1 } })
    expect(evaluations.length).toBeGreaterThan(2)
  })
})

describe('interventions are remembered, so the cooldown works across events', () => {
  // a y c se turnan en tramos de 10 s durante 100 s; b entra y nunca habla -> SILENT_PEER para b
  const session = [
    join('a', 0), join('b', 0), join('c', 0),
    ...Array.from({ length: 10 }, (_, i) => [on(i % 2 === 0 ? 'a' : 'c', i * 10), off(i % 2 === 0 ? 'a' : 'c', i * 10 + 10)]).flat(),
  ]

  it('intervenes once for the silent peer and the cooldown stops repeating it', () => {
    const { evaluations, state } = run(session)
    const chosen = evaluations.filter((e) => e.intervention)

    expect(chosen).toHaveLength(1)
    expect(chosen[0].intervention).toMatchObject({ type: 'SILENT_PEER', participantKey: 'b' })
    expect(state.interventions).toHaveLength(1)
    expect(historyOf(state)).toEqual([{ type: 'SILENT_PEER', participantKey: 'b', t: chosen[0].at }])
  })

  it('lets the same signal through again once the cooldown passes', () => {
    const { evaluations } = run(session, { config: { cooldownSec: 20 } })
    expect(evaluations.filter((e) => e.intervention).length).toBeGreaterThan(1)
  })

  it('caps the stored interventions', () => {
    const { state } = run(session, { config: { cooldownSec: 0.001, maxInterventions: 2 } })
    expect(state.interventions.length).toBeLessThanOrEqual(2)
  })
})

describe('the current problem', () => {
  const problem = { activityId: 'act-1', skillId: 'multiplication', text: '6 x 8', expectedAnswer: 48 }
  const room = [join('a', 0), join('b', 0)]

  it('recognises an answer and carries skillId and activityId in the evidence', () => {
    const { evaluations } = run([...room, say('a', 10, 12, 'son cuarenta y ocho'), on('b', 18)], { problem })
    const answer = evaluations.map((e) => e.intervention).find(Boolean)
    expect(answer).toMatchObject({ type: 'CORRECT_ANSWER', participantKey: 'a', evidence: { skillId: 'multiplication', activityId: 'act-1', numbers: [48] } })
  })

  it('ignores what was said before the problem appeared', () => {
    // la respuesta "son 48" se dijo ANTES de que el problema act-1 rigiera (rige desde la primera evaluacion)
    const before = [...room, say('a', 1, 2, 'son 48')]
    const first = processEvent(emptyState(), before[0], { problem })
    const next = before.slice(1).reduce((state, event) => processEvent(state, event, { problem }).state, first.state)
    expect(next.problem).toEqual({ id: 'act-1', startedT: 0 })
  })

  it('remembers when each problem started and restarts the clock when it changes', () => {
    let state = emptyState()
    state = processEvent(state, join('a', 0), { problem }).state
    state = processEvent(state, join('b', 7), { problem }).state
    expect(state.problem).toEqual({ id: 'act-1', startedT: 0 })

    const other = { ...problem, activityId: 'act-2' }
    state = processEvent(state, on('a', 20), { problem: other }).state
    expect(state.problem).toEqual({ id: 'act-2', startedT: 20 })
  })

  it('clears the problem when there is none', () => {
    const withProblem = processEvent(emptyState(), join('a', 0), { problem }).state
    expect(processEvent(withProblem, join('b', 6), { problem: null }).state.problem).toBeNull()
  })

  it('evaluateDue can be called on its own with a problem', () => {
    const { state } = ingestEvent(emptyState(), join('a', 0))
    const result = evaluateDue(state, { problem })
    expect(result.state.lastEvalT).toBe(0)
    expect(result.intervention).toBeNull()
  })
})

describe('the incremental engine over the real smoke-001 session', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/smoke-001.json', import.meta.url), 'utf8'))
  const arrival = [...fixture.events].sort((a, b) => (a.type === 'transcript' ? a.tEnd : a.t) - (b.type === 'transcript' ? b.tEnd : b.t))

  it('intervenes once, for the participant who never spoke, as soon as there is enough conversation', () => {
    const { evaluations, state } = run(arrival)
    const chosen = evaluations.filter((e) => e.intervention)

    expect(chosen).toHaveLength(1)
    expect(chosen[0].intervention).toMatchObject({ type: 'SILENT_PEER', participantKey: 'estudiante b' })
    expect(chosen[0].intervention.evidence.totalSpeechSec).toBeGreaterThanOrEqual(45)
    expect(chosen[0].at).toBeGreaterThanOrEqual(45)
    expect(chosen[0].at).toBeLessThan(65)
    expect(state.interventions).toHaveLength(1)
  })

  it('evaluates about once every 5 s of session time, not once per event', () => {
    const { evaluations } = run(arrival)
    expect(arrival.length).toBeGreaterThan(250)
    expect(evaluations.length).toBeLessThanOrEqual(Math.ceil(107 / DEFAULT_CONFIG.evalEverySec) + 2)
  })

  it('keeps the state small enough for one Firestore document', () => {
    const { state } = run(arrival)
    expect(JSON.stringify(state).length).toBeLessThan(20_000)
    expect(state.transcripts.length).toBeLessThanOrEqual(DEFAULT_CONFIG.maxTranscripts)
  })

  it('gives the same decisions for the same arrival order (deterministic)', () => {
    expect(run(arrival).evaluations).toEqual(run(arrival).evaluations)
  })
})

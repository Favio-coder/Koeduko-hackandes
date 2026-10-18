import { describe, expect, it, vi } from 'vitest'
import { createAfterLiveEventSaved } from './afterLiveEventSaved.js'
import { closeSession } from './closeSession.js'
import { STYLES, recordOutcomes } from './core/learning.js'
import { OUTCOME } from './core/interventionOutcome.js'
import { studentKeyOf } from './core/studentKey.js'

const A = 'estudiante a'
const session = {
  createdBy: 'docente-1',
  status: 'scheduled',
  currentProblem: { activityId: 'p-01', skillId: 'multiplication', text: 'Hay 6 cajas con 8 lápices cada una. ¿Cuántos lápices hay en total?' },
}
const state = {
  lastT: 120,
  presence: [{ k: A, s: 0 }],
  totals: [{ k: A, sec: 30, turns: 4 }],
  students: [],
  problem: { id: 'p-01', startedT: 0 },
  answer: { id: 'p-01', v: 48 },
}
// A se equivoca, el tutor interviene (t=20, estilo "pista") y después A da la respuesta: la intervención sirvió.
const transcripts = [
  { k: A, t: 10, e: 12, x: 'creo que son cuarenta y dos' },
  { k: A, t: 30, e: 32, x: 'ah, entonces seis por ocho son cuarenta y ocho' },
]
const interventions = [{ id: 'i1', signal: 'WRONG_ANSWER', participantKey: A, t: 20, style: 'pista' }]

function closeSetup({ previous = null, extra = {} } = {}) {
  const store = {
    getSession: vi.fn().mockResolvedValue(session),
    getLiveState: vi.fn().mockResolvedValue(state),
    getTranscripts: vi.fn().mockResolvedValue(transcripts),
    getAnswer: vi.fn().mockResolvedValue({ expectedAnswer: 48 }),
    getSummary: vi.fn().mockResolvedValue(null),
    saveClosure: vi.fn().mockResolvedValue(undefined),
    getInterventions: vi.fn().mockResolvedValue(interventions),
    getProfile: vi.fn().mockResolvedValue(previous),
    saveProfile: vi.fn().mockResolvedValue(undefined),
    ...extra,
  }
  return { store, run: () => closeSession({ sessionId: 's1', store, memory: null, leaveBot: null, generate: null, logger: { info: vi.fn() } }) }
}

describe('closeSession learns from what happened after each intervention', () => {
  it('measures the outcome, updates the profile of each student and keeps what it already knew', async () => {
    const previous = recordOutcomes({ sessions: 1, skills: {}, signals: {} }, [{ signal: 'WRONG_ANSWER', style: 'pista', outcome: OUTCOME.IMPROVED }])
    const { store, run } = closeSetup({ previous })
    const result = await run()

    const key = studentKeyOf({ participantKey: A, scope: 'docente-1' })
    expect(store.getProfile).toHaveBeenCalledWith(key)
    const [savedKey, profile] = store.saveProfile.mock.calls[0]
    expect(savedKey).toBe(key)
    expect(profile.sessions).toBe(2)
    expect(profile.styles.WRONG_ANSWER.pista.wins).toBeGreaterThan(1)
    expect(profile.styles.WRONG_ANSWER.pista.tries).toBeGreaterThan(1)
    expect(result.steps.learning).toEqual({ profiles: 1, improved: 1, noChange: 0, unknown: 0 })
  })

  it('starts from an empty profile for a student it did not know', async () => {
    const { store, run } = closeSetup({ previous: null })
    await run()
    expect(store.saveProfile.mock.calls[0][1]).toMatchObject({ sessions: 1, styles: { WRONG_ANSWER: { pista: { tries: 1, wins: 1 } } } })
  })

  it('a failure in the learning step never breaks the close, and it is recorded', async () => {
    const { store, run } = closeSetup({ extra: { getInterventions: vi.fn().mockRejectedValue(new Error('firestore')) } })
    const result = await run()
    expect(result.status).toBe('completed')
    expect(store.saveClosure).toHaveBeenCalledTimes(1)
    expect(String(result.steps.learning)).toMatch(/^failed:/)
  })

  it('is skipped when the store has no profile support (older stores keep working)', async () => {
    const { store, run } = closeSetup({ extra: { getProfile: undefined } })
    const result = await run()
    expect(result.steps.learning).toBe('skipped')
    expect(store.saveProfile).not.toHaveBeenCalled()
  })
})

describe('afterLiveEventSaved uses the profile to choose a style and to personalize', () => {
  const signal = { type: 'WRONG_ANSWER', participantKey: A, studentId: null, t: 55, evidence: { numbers: [42] } }
  const problem = { activityId: 'p-01', skillId: 'multiplication', text: '¿Cuántos lápices hay en total?', expectedAnswer: 48 }
  const result = { evaluated: true, intervention: signal, context: { problem, transcriptTail: [{ k: A, x: 'son cuarenta y dos' }] } }

  function liveSetup(profile) {
    const store = {
      createIntervention: vi.fn().mockResolvedValue({ created: true }),
      getSession: vi.fn().mockResolvedValue({ createdBy: 'docente-1' }),
      getProfile: vi.fn().mockResolvedValue(profile),
    }
    const generate = vi.fn().mockResolvedValue('Estudiante A, ¿qué número usaste para cada caja?')
    const logger = { info: vi.fn() }
    const hook = createAfterLiveEventSaved({ getStore: () => store, getGenerate: () => generate, logger, now: () => 1000 })
    return { hook, store, generate, logger }
  }

  it('picks a style, puts it in the prompt, saves it in the intervention and logs it', async () => {
    const { hook, store, generate, logger } = liveSetup(null)
    await hook({ sessionId: 's2', result })
    const style = store.createIntervention.mock.calls[0][2].style
    expect(STYLES).toContain(style)
    expect(generate.mock.calls[0][0].userPrompt).toContain('Estilo:')
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ style, styleReason: 'explore', profile: false }))
  })

  it('tells the model what the profile knows about the student (patterns and the style that worked)', async () => {
    let profile = { v: 1, sessions: 3, skills: {}, signals: { SILENT_PEER: 2 } }
    profile = recordOutcomes(profile, Array.from({ length: 3 }, () => ({ signal: 'WRONG_ANSWER', style: 'paso', outcome: OUTCOME.IMPROVED })))
    const { hook, generate, logger } = liveSetup(profile)
    await hook({ sessionId: 's2', result })

    const { userPrompt } = generate.mock.calls[0][0]
    expect(userPrompt).toContain('Suele participar poco cuando trabaja en pareja')
    expect(userPrompt).toContain('ha funcionado mejor el estilo paso')
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ profile: true }))
  })

  it('still speaks when the profile cannot be read', async () => {
    const { hook, store } = liveSetup(null)
    store.getProfile.mockRejectedValue(new Error('firestore'))
    await hook({ sessionId: 's2', result })
    expect(store.createIntervention).toHaveBeenCalledTimes(1)
  })

  it('never puts the expected answer or the student name in what it adds', async () => {
    const profile = { v: 1, sessions: 1, skills: {}, signals: { DOMINANCE: 1 } }
    const { hook, generate } = liveSetup(profile)
    await hook({ sessionId: 's2', result })
    expect(generate.mock.calls[0][0].userPrompt).not.toMatch(/\b48\b|cuarenta y ocho/)
  })
})

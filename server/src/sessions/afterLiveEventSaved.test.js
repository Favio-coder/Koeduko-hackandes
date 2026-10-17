import { describe, expect, it, vi } from 'vitest'
import { createAfterLiveEventSaved } from './afterLiveEventSaved.js'

const problem = { activityId: 'p-03', skillId: 'multiplication', text: '¿Cuánto es 6 x 8?', expectedAnswer: 48 }
const intervention = {
  type: 'SILENT_PEER',
  participantKey: 'estudiante b',
  studentId: null,
  t: 55,
  evidence: { shares: { 'estudiante a': 0.5, 'estudiante b': 0, 'estudiante c': 0.5 }, skillId: 'multiplication', activityId: 'p-03' },
}
const result = { evaluated: true, intervention, context: { problem, transcriptTail: [{ k: 'estudiante a', x: 'hola' }], present: [] } }

function setup({ generate = vi.fn().mockResolvedValue('Estudiante B, ¿cómo explicarías tú el problema con tus palabras?'), store = {}, options = {} } = {}) {
  const fakeStore = { createIntervention: vi.fn().mockResolvedValue({ created: true }), ...store }
  const logger = { info: vi.fn() }
  const hook = createAfterLiveEventSaved({ getStore: () => fakeStore, getGenerate: () => generate, logger, now: () => 1000, ...options })
  return { hook, store: fakeStore, logger, generate }
}

describe('afterLiveEventSaved', () => {
  it('does nothing when no intervention was decided: no store, no Gemini', async () => {
    const { hook, store, generate } = setup()
    await hook({ sessionId: 's1', result: { evaluated: true, intervention: null } })
    await hook({ sessionId: 's1', result: undefined })
    await hook({ sessionId: 's1' })
    expect(store.createIntervention).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
  })

  it('writes the intervention with signal, evidence (skillId + activityId), message and deliveredTo ["app"]', async () => {
    const { hook, store } = setup()
    await hook({ sessionId: 'smoke-replay-001', result })

    const [sessionId, interventionId, data] = store.createIntervention.mock.calls[0]
    expect(sessionId).toBe('smoke-replay-001')
    expect(interventionId).toMatch(/^int-/)
    expect(data).toEqual({
      signal: 'SILENT_PEER',
      targetStudentId: null,
      participantKey: 'estudiante b',
      evidence: intervention.evidence,
      message: 'Estudiante B, ¿cómo explicarías tú el problema con tus palabras?',
      source: 'gemini',
      deliveredTo: ['app'],
      t: 55,
    })
    expect(data.evidence).toMatchObject({ skillId: 'multiplication', activityId: 'p-03' })
  })

  it('uses a deterministic id: same intervention -> same id; another recipient, type or cooldown window -> another', async () => {
    const ids = []
    for (const signal of [intervention, intervention, { ...intervention, participantKey: 'estudiante c' }, { ...intervention, type: 'DOMINANCE' }, { ...intervention, t: 150 }]) {
      const { hook, store } = setup()
      await hook({ sessionId: 's1', result: { ...result, intervention: signal } })
      ids.push(store.createIntervention.mock.calls[0][1])
    }
    expect(ids[0]).toBe(ids[1])
    expect(new Set(ids).size).toBe(4)
  })

  it('still delivers a deterministic message when Gemini fails or there is no key', async () => {
    const failing = setup({ generate: vi.fn().mockRejectedValue(new Error('down')) })
    await failing.hook({ sessionId: 's1', result })
    const { message, source } = failing.store.createIntervention.mock.calls[0][2]
    expect(source).toBe('fallback')
    expect(message).toMatch(/^Estudiante B, .*\?$/)

    const noKey = setup({ generate: null })
    await noKey.hook({ sessionId: 's1', result })
    expect(noKey.store.createIntervention.mock.calls[0][2].source).toBe('fallback')
  })

  it('never writes a message that reveals the answer, whatever Gemini says', async () => {
    const { hook, store } = setup({ generate: vi.fn().mockResolvedValue('Estudiante B, en el problema ¿no serán 48?') })
    await hook({ sessionId: 's1', result })
    const { message, source } = store.createIntervention.mock.calls[0][2]
    expect(source).toBe('fallback')
    expect(message).not.toMatch(/48/)
  })

  it('reports an already delivered intervention without failing', async () => {
    const { hook, logger } = setup({ store: { createIntervention: vi.fn().mockResolvedValue({ created: false }) } })
    await hook({ sessionId: 's1', result })
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ created: false }))
  })

  it('does not log the message text (it names a child) unless asked to', async () => {
    const quiet = setup()
    await quiet.hook({ sessionId: 's1', result })
    expect(JSON.stringify(quiet.logger.info.mock.calls)).not.toContain('explicarías')

    const verbose = setup({ options: { logText: true } })
    await verbose.hook({ sessionId: 's1', result })
    expect(verbose.logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ text: expect.stringContaining('Estudiante B') }))
  })

  it('logs the fallback reason and how long it took', async () => {
    const times = [1000, 1450]
    const { hook, logger } = setup({ generate: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { reason: 'http' })), options: { now: () => times.shift() } })
    await hook({ sessionId: 's1', result })
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ source: 'fallback', reason: 'http', ms: 450 }))
  })

  it('propagates a storage failure so the caller can log it', async () => {
    const { hook } = setup({ store: { createIntervention: vi.fn().mockRejectedValue(new Error('firestore down')) } })
    await expect(hook({ sessionId: 's1', result })).rejects.toThrow('firestore down')
  })
})

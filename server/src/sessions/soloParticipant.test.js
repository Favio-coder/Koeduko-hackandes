import { describe, expect, it, vi } from 'vitest'
import { createAfterLiveEventSaved, soloAddressee } from './afterLiveEventSaved.js'
import { buildInterventionPrompt, fallbackMessage, validateMessage } from './core/interventionPolicy.js'

const problem = { activityId: 'p-01', skillId: 'multiplication', text: '¿Cuántos lápices hay en total?', expectedAnswer: 48 }
const stuck = { type: 'STUCK', participantKey: null, studentId: null, t: 40, evidence: {} }

describe('one person in the meeting', () => {
  it('soloAddressee gives a group signal to the only human, and leaves everything else alone', () => {
    expect(soloAddressee(stuck, ['jayo'])).toMatchObject({ type: 'STUCK', participantKey: 'jayo' })
    expect(soloAddressee(stuck, ['a', 'b'])).toBe(stuck)
    expect(soloAddressee(stuck, [])).toBe(stuck)
    const direct = { ...stuck, participantKey: 'b' }
    expect(soloAddressee(direct, ['a'])).toBe(direct)
  })

  it('the prompt tells the model there is one person, and does not when there are more', () => {
    const solo = buildInterventionPrompt({ signal: { ...stuck, participantKey: 'jayo' }, problem, participants: 1 })
    expect(solo.userPrompt).toContain('Hay una sola persona en la reunión')
    expect(buildInterventionPrompt({ signal: stuck, problem, participants: 2 }).userPrompt).not.toContain('una sola persona')
    expect(buildInterventionPrompt({ signal: stuck, problem }).userPrompt).not.toContain('una sola persona')
  })

  it('the fallback speaks to one person: no "compañero", no plurals, and it still passes the policy', () => {
    for (const type of ['STUCK', 'GROUP_SILENCE', 'WRONG_ANSWER', 'CORRECT_ANSWER', 'SILENT_PEER']) {
      const signal = { type, participantKey: 'jayo', t: 1 }
      const message = fallbackMessage(signal, { problem, participants: 1 })
      expect(message).not.toMatch(/compañer|ustedes|tienen|les |podrían|chicos/i)
      expect(validateMessage(message, { addressee: 'Jayo', expectedAnswer: 48, problemText: problem.text }).ok).toBe(true)
    }
    expect(fallbackMessage({ type: 'STUCK', participantKey: 'a' }, { problem })).toContain('tienen')
  })

  it('afterLiveEventSaved addresses a STUCK signal to the only human, with memory and profile, and ignores the bot', async () => {
    const store = {
      createIntervention: vi.fn().mockResolvedValue({ created: true }),
      getSession: vi.fn().mockResolvedValue({ createdBy: 'docente-1' }),
      getProfile: vi.fn().mockResolvedValue(null),
    }
    const memory = { recall: vi.fn().mockResolvedValue([]) }
    const generate = vi.fn().mockResolvedValue('Jayo, ¿qué datos tienes del problema y cuál te falta?')
    const hook = createAfterLiveEventSaved({ getStore: () => store, getGenerate: () => generate, getMemory: () => memory, logger: { info: vi.fn() }, now: () => 1000 })

    await hook({ sessionId: 's9', result: { intervention: stuck, context: { problem, transcriptTail: [], present: ['jayo', 'tutor koeduko'] } } })

    const data = store.createIntervention.mock.calls[0][2]
    expect(data).toMatchObject({ signal: 'STUCK', participantKey: 'jayo' })
    expect(memory.recall).toHaveBeenCalledTimes(1)
    expect(store.getProfile).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0][0].userPrompt).toContain('Hay una sola persona en la reunión')
  })
})

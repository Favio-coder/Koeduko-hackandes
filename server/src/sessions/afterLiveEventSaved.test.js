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
      targetName: 'Estudiante B',
      evidence: intervention.evidence,
      message: 'Estudiante B, ¿cómo explicarías tú el problema con tus palabras?',
      source: 'gemini',
      deliveredTo: ['app'],
      t: 55,
    })
    expect(data.evidence).toMatchObject({ skillId: 'multiplication', activityId: 'p-03' })
  })

  it('never stores the expected answer in the evidence, because students of the session can read it', async () => {
    const wrong = { ...intervention, type: 'WRONG_ANSWER', evidence: { expectedAnswer: 48, numbers: [46], skillId: 'multiplication', activityId: 'p-03' } }
    const { hook, store } = setup()
    await hook({ sessionId: 's1', result: { ...result, intervention: wrong } })

    const { evidence, message } = store.createIntervention.mock.calls[0][2]
    expect(evidence).toEqual({ numbers: [46], skillId: 'multiplication', activityId: 'p-03' })
    expect(JSON.stringify(store.createIntervention.mock.calls[0][2])).not.toContain('expectedAnswer')
    expect(message).not.toMatch(/48/)
  })

  it('stores a name for the recipient, or the group for signals without one', async () => {
    const group = setup()
    await group.hook({ sessionId: 's1', result: { ...result, intervention: { ...intervention, type: 'STUCK', participantKey: null } } })
    expect(group.store.createIntervention.mock.calls[0][2]).toMatchObject({ targetName: 'Chicos', participantKey: null })
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

describe('afterLiveEventSaved: Meet chat', () => {
  const chatOn = { enabled: true, apiKey: 'k', region: 'us-west-2' }
  const botSession = { bot: { id: 'bot-1', status: 'in_call', region: 'us-west-2' } }

  function chatSetup({ chat = chatOn, session = botSession, sendChat = vi.fn().mockResolvedValue({ ok: true, status: 200 }), store = {} } = {}) {
    const fakeStore = {
      getSession: vi.fn().mockResolvedValue(session),
      setDeliveredTo: vi.fn().mockResolvedValue(undefined),
      ...store,
    }
    return { ...setup({ store: fakeStore, options: { getChat: () => chat, sendChat } }), sendChat }
  }

  it('sends a new intervention to the Meet chat exactly as written and records meet_chat', async () => {
    const { hook, store, sendChat, logger } = chatSetup()
    await hook({ sessionId: 's1', result })

    const [, interventionId, data] = store.createIntervention.mock.calls[0]
    expect(sendChat).toHaveBeenCalledTimes(1)
    expect(sendChat).toHaveBeenCalledWith({ apiKey: 'k', region: 'us-west-2', botId: 'bot-1', text: data.message })
    expect(store.setDeliveredTo).toHaveBeenCalledWith('s1', interventionId, ['app', 'meet_chat'])
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ chat: 'sent', chatStatus: 200 }))
  })

  it('reads the session once, and only when there is a new intervention', async () => {
    const none = chatSetup()
    await none.hook({ sessionId: 's1', result: { evaluated: true, intervention: null } })
    expect(none.store.getSession).not.toHaveBeenCalled()

    const one = chatSetup()
    await one.hook({ sessionId: 's1', result })
    expect(one.store.getSession).toHaveBeenCalledTimes(1)
  })

  it('does not resend a duplicate intervention', async () => {
    const { hook, store, sendChat, logger } = chatSetup({ store: { createIntervention: vi.fn().mockResolvedValue({ created: false }) } })
    await hook({ sessionId: 's1', result })

    expect(sendChat).not.toHaveBeenCalled()
    expect(store.getSession).not.toHaveBeenCalled()
    expect(store.setDeliveredTo).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ created: false, chat: 'duplicate' }))
  })

  it.each([
    ['400', { ok: false, status: 400 }],
    ['404', { ok: false, status: 404 }],
    ['timeout', { ok: false, status: 0 }],
  ])('keeps the intervention in the app only when Recall answers %s, and logs the status', async (_name, answer) => {
    const { hook, store, logger } = chatSetup({ sendChat: vi.fn().mockResolvedValue(answer) })
    await hook({ sessionId: 's1', result })

    expect(store.createIntervention.mock.calls[0][2].deliveredTo).toEqual(['app'])
    expect(store.setDeliveredTo).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ created: true, chat: 'failed', chatStatus: answer.status }))
  })

  it('does not fail the intervention when Recall is down (sendChat throws)', async () => {
    const { hook, store } = chatSetup({ sendChat: vi.fn().mockRejectedValue(new Error('boom')) })
    await expect(hook({ sessionId: 's1', result })).resolves.toBeUndefined()
    expect(store.createIntervention).toHaveBeenCalledTimes(1)
    expect(store.setDeliveredTo).not.toHaveBeenCalled()
  })

  it('does not fail when the session cannot be read or the delivery cannot be recorded', async () => {
    const unreadable = chatSetup({ store: { getSession: vi.fn().mockRejectedValue(new Error('firestore')) } })
    await expect(unreadable.hook({ sessionId: 's1', result })).resolves.toBeUndefined()
    expect(unreadable.sendChat).not.toHaveBeenCalled()

    const unrecorded = chatSetup({ store: { setDeliveredTo: vi.fn().mockRejectedValue(new Error('firestore')) } })
    await expect(unrecorded.hook({ sessionId: 's1', result })).resolves.toBeUndefined()
    expect(unrecorded.logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ chat: 'sent-not-recorded' }))
  })

  it('skips the chat when it is disabled, there is no bot id, or no chat config', async () => {
    const off = chatSetup({ chat: { ...chatOn, enabled: false } })
    await off.hook({ sessionId: 's1', result })
    expect(off.store.getSession).not.toHaveBeenCalled()
    expect(off.sendChat).not.toHaveBeenCalled()

    const noBot = chatSetup({ session: { bot: { id: null, status: 'requested' } } })
    await noBot.hook({ sessionId: 's1', result })
    expect(noBot.sendChat).not.toHaveBeenCalled()

    const noConfig = chatSetup({ chat: null })
    await noConfig.hook({ sessionId: 's1', result })
    expect(noConfig.sendChat).not.toHaveBeenCalled()
  })

  it('uses the region the bot was created in', async () => {
    const { hook, sendChat } = chatSetup({ session: { bot: { id: 'bot-1', region: 'eu-central-1' } } })
    await hook({ sessionId: 's1', result })
    expect(sendChat).toHaveBeenCalledWith(expect.objectContaining({ region: 'eu-central-1' }))
  })

  it('never logs the message text, even when it is sent to the chat', async () => {
    const { hook, logger } = chatSetup()
    await hook({ sessionId: 's1', result })
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('explicarías')
  })
})

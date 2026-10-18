import { describe, expect, it, vi } from 'vitest'
import { RecallApiError } from './adapters/recall.js'
import { SessionBotError } from './errors.js'
import { startSessionBot } from './startSessionBot.js'

const config = {
  apiKey: 'fake-api-key',
  region: 'us-west-2',
  webhookUrl: 'https://koeduko-sessions.vercel.app/api/recall-webhook',
  webhookToken: 'fake-token',
  language: 'es',
}
const MEET = 'https://meet.google.com/abc-defg-hij'

function setup({ store = {}, createBot } = {}) {
  const deps = {
    sessionId: 'smoke-001',
    nowMs: 1000,
    config,
    store: {
      claimBot: vi.fn().mockResolvedValue({ meetingUrl: MEET }),
      setBotId: vi.fn().mockResolvedValue(undefined),
      markBotFailed: vi.fn().mockResolvedValue(undefined),
      ...store,
    },
    createBot: createBot ?? vi.fn().mockResolvedValue({ botId: 'bot-1' }),
  }
  return deps
}

describe('startSessionBot', () => {
  it('claims, creates the bot with the stored Meet link and saves its id', async () => {
    const deps = setup()

    await expect(startSessionBot(deps)).resolves.toEqual({ botId: 'bot-1', status: 'requested', problemAssigned: false, rolesAssigned: false })

    expect(deps.store.claimBot).toHaveBeenCalledWith('smoke-001', { region: 'us-west-2', nowMs: 1000 })
    expect(deps.createBot).toHaveBeenCalledWith({
      apiKey: 'fake-api-key',
      region: 'us-west-2',
      meetingUrl: MEET,
      sessionId: 'smoke-001',
      webhookUrl: 'https://koeduko-sessions.vercel.app/api/recall-webhook?token=fake-token',
      language: 'es',
      speak: false,
    })
    expect(deps.store.setBotId).toHaveBeenCalledWith('smoke-001', 'bot-1')
    expect(deps.store.markBotFailed).not.toHaveBeenCalled()
  })

  it.each([undefined, null, '', 42, 'a/b', 'x'.repeat(129)])('rejects an invalid sessionId (%s)', async (sessionId) => {
    const deps = setup()
    await expect(startSessionBot({ ...deps, sessionId })).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(deps.store.claimBot).not.toHaveBeenCalled()
  })

  it('does not call Recall when the claim fails (duplicate invitation)', async () => {
    const claimError = new SessionBotError('failed-precondition', 'El tutor ya fue invitado a esta sesion.')
    const deps = setup({ store: { claimBot: vi.fn().mockRejectedValue(claimError) } })

    await expect(startSessionBot(deps)).rejects.toBe(claimError)
    expect(deps.createBot).not.toHaveBeenCalled()
  })

  it('marks the bot as failed and reports unavailable on Recall 429 or 5xx', async () => {
    const createBot = vi.fn().mockRejectedValue(new RecallApiError('Recall respondio 429', { status: 429 }))
    const deps = setup({ createBot })

    await expect(startSessionBot(deps)).rejects.toMatchObject({ code: 'unavailable' })
    expect(deps.store.markBotFailed).toHaveBeenCalledWith('smoke-001')
    expect(deps.store.setBotId).not.toHaveBeenCalled()
  })

  it('reports internal and hides Recall details on other failures', async () => {
    const createBot = vi.fn().mockRejectedValue(new RecallApiError('Recall respondio 400: secret detail', { status: 400 }))
    const deps = setup({ createBot })

    const error = await startSessionBot(deps).catch((e) => e)
    expect(error.code).toBe('internal')
    expect(error.message).not.toContain('secret detail')
    expect(deps.store.markBotFailed).toHaveBeenCalled()
  })

  it('still fails with the original error if marking the failure also fails', async () => {
    const deps = setup({
      createBot: vi.fn().mockRejectedValue(new Error('network')),
      store: { markBotFailed: vi.fn().mockRejectedValue(new Error('firestore down')) },
    })
    await expect(startSessionBot(deps)).rejects.toMatchObject({ code: 'internal' })
  })

  it('reports the bot id and does not mark failure when saving the id fails', async () => {
    const deps = setup({ store: { setBotId: vi.fn().mockRejectedValue(new Error('firestore down')) } })

    const error = await startSessionBot(deps).catch((e) => e)
    expect(error.code).toBe('internal')
    expect(error.botId).toBe('bot-1')
    expect(deps.store.markBotFailed).not.toHaveBeenCalled()
  })
})

describe('startSessionBot: problem assignment', () => {
  const config = { apiKey: 'k', region: 'us-west-2', webhookUrl: 'https://x.test/api/recall-webhook', webhookToken: 't', language: 'es' }
  const base = () => ({
    claimBot: vi.fn().mockResolvedValue({ meetingUrl: 'https://meet.google.com/abc-defg-hij' }),
    setBotId: vi.fn().mockResolvedValue(undefined),
    markBotFailed: vi.fn().mockResolvedValue(undefined),
  })

  it('assigns the problem after the bot is claimed and before it is created, and reports it', async () => {
    const order = []
    const store = { ...base(), ensureProblem: vi.fn().mockImplementation(async () => { order.push('problem'); return { assigned: true } }) }
    const createBot = vi.fn().mockImplementation(async () => { order.push('bot'); return { botId: 'b1' } })
    const result = await startSessionBot({ sessionId: 's1', nowMs: 1, config, store, createBot })
    expect(order).toEqual(['problem', 'bot'])
    expect(result).toEqual({ botId: 'b1', status: 'requested', problemAssigned: true, rolesAssigned: false })
  })

  it('never blocks the bot: a failure assigning the problem is swallowed', async () => {
    const store = { ...base(), ensureProblem: vi.fn().mockRejectedValue(new Error('firestore')) }
    const result = await startSessionBot({ sessionId: 's1', nowMs: 1, config, store, createBot: vi.fn().mockResolvedValue({ botId: 'b1' }) })
    expect(result.problemAssigned).toBe(false)
  })

  it('does not assign anything if the bot cannot be claimed', async () => {
    const store = { ...base(), claimBot: vi.fn().mockRejectedValue(new Error('ya invitado')), ensureProblem: vi.fn() }
    await expect(startSessionBot({ sessionId: 's1', nowMs: 1, config, store, createBot: vi.fn() })).rejects.toThrow()
    expect(store.ensureProblem).not.toHaveBeenCalled()
  })
})

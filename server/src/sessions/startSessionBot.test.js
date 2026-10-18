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

    await expect(startSessionBot(deps)).resolves.toEqual({ botId: 'bot-1', status: 'requested' })

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

import { describe, expect, it, vi } from 'vitest'
import { createAfterLiveEventSaved } from './afterLiveEventSaved.js'

const signal = { type: 'SILENT_PEER', participantKey: 'estudiante b', studentId: null, t: 55, evidence: { shares: { 'estudiante a': 1, 'estudiante b': 0 } } }
const problem = { activityId: 'p-01', skillId: 'multiplication', text: '¿Cuántos lápices hay en total?', expectedAnswer: 48 }
const result = { evaluated: true, intervention: signal, context: { problem, transcriptTail: [] } }
const MESSAGE = 'Estudiante B, ¿cómo explicarías tú el problema con tus palabras?'

const chatOn = { enabled: true, apiKey: 'rk', region: 'us-west-2' }
const voiceOn = { enabled: true, elevenKey: 'ek', voiceId: 'voz1234567890', modelId: 'eleven_flash_v2_5', apiKey: 'rk', region: 'us-west-2' }
const botSession = { createdBy: 'docente-1', bot: { id: 'bot-1', region: 'us-west-2' } }

function setup({ chat = chatOn, voice = voiceOn, session = botSession, sendChat, synthesizeSpeech, sendAudioToBot, store = {} } = {}) {
  const fakeStore = {
    createIntervention: vi.fn().mockResolvedValue({ created: true }),
    getSession: vi.fn().mockResolvedValue(session),
    setDeliveredTo: vi.fn().mockResolvedValue(undefined),
    ...store,
  }
  const deps = {
    sendChat: sendChat ?? vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    synthesizeSpeech: synthesizeSpeech ?? vi.fn().mockResolvedValue({ ok: true, status: 200, mp3Base64: 'QUJD' }),
    sendAudioToBot: sendAudioToBot ?? vi.fn().mockResolvedValue({ ok: true, status: 200 }),
  }
  const logger = { info: vi.fn() }
  const generate = vi.fn().mockResolvedValue(MESSAGE)
  const hook = createAfterLiveEventSaved({ getStore: () => fakeStore, getGenerate: () => generate, getChat: () => chat, getVoice: () => voice, logger, now: () => 1000, ...deps })
  return { run: () => hook({ sessionId: 's1', result }), store: fakeStore, logger, ...deps }
}

describe('the tutor voice (experimental, off by default)', () => {
  it('does nothing when the voice is off: no TTS, no audio, and the chat works exactly as before', async () => {
    const { run, synthesizeSpeech, sendAudioToBot, sendChat, store, logger } = setup({ voice: null })
    await run()
    expect(synthesizeSpeech).not.toHaveBeenCalled()
    expect(sendAudioToBot).not.toHaveBeenCalled()
    expect(sendChat).toHaveBeenCalledTimes(1)
    expect(store.setDeliveredTo).toHaveBeenCalledWith('s1', expect.stringMatching(/^int-/), ['app', 'meet_chat'])
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ chat: 'sent', voice: 'disabled' }))
  })

  it('also stays off when the voice config says disabled', async () => {
    const { run, synthesizeSpeech } = setup({ voice: { ...voiceOn, enabled: false } })
    await run()
    expect(synthesizeSpeech).not.toHaveBeenCalled()
  })

  it('speaks the same validated message it writes: ElevenLabs makes the mp3 and Recall plays it in the bot', async () => {
    const { run, synthesizeSpeech, sendAudioToBot, store, logger } = setup()
    await run()

    expect(synthesizeSpeech).toHaveBeenCalledWith({ apiKey: 'ek', voiceId: 'voz1234567890', modelId: 'eleven_flash_v2_5', text: MESSAGE })
    expect(sendAudioToBot).toHaveBeenCalledWith({ apiKey: 'rk', region: 'us-west-2', botId: 'bot-1', mp3Base64: 'QUJD' })
    expect(store.setDeliveredTo).toHaveBeenCalledTimes(1) // un solo registro para los dos canales
    expect(store.setDeliveredTo.mock.calls[0][2]).toEqual(['app', 'meet_chat', 'meet_voice'])
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ chat: 'sent', voice: 'sent', voiceStatus: 200 }))
  })

  it('works with the voice alone (chat off) and records meet_voice only', async () => {
    const { run, store, sendChat } = setup({ chat: { ...chatOn, enabled: false } })
    await run()
    expect(sendChat).not.toHaveBeenCalled()
    expect(store.setDeliveredTo.mock.calls[0][2]).toEqual(['app', 'meet_voice'])
  })

  it('sends chat and voice in parallel: a slow voice does not delay the chat message', async () => {
    const order = []
    const sendChat = vi.fn(async () => {
      order.push('chat')
      return { ok: true, status: 200 }
    })
    const synthesizeSpeech = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
      order.push('tts')
      return { ok: true, status: 200, mp3Base64: 'QUJD' }
    })
    const { run } = setup({ sendChat, synthesizeSpeech })
    await run()
    expect(order).toEqual(['chat', 'tts'])
  })

  describe('a failure of the voice never breaks the tutor', () => {
    it.each([
      ['ElevenLabs fails', { synthesizeSpeech: vi.fn().mockResolvedValue({ ok: false, status: 401 }) }, 'tts-failed', 401],
      ['Recall refuses the audio', { sendAudioToBot: vi.fn().mockResolvedValue({ ok: false, status: 400 }) }, 'failed', 400],
    ])('%s: the chat still goes and only meet_chat is recorded', async (_name, deps, voiceState, status) => {
      const { run, store, logger } = setup(deps)
      await expect(run()).resolves.toBeUndefined()
      expect(store.setDeliveredTo.mock.calls[0][2]).toEqual(['app', 'meet_chat'])
      expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ chat: 'sent', voice: voiceState, voiceStatus: status }))
    })

    it('survives the TTS or the audio call throwing', async () => {
      const a = setup({ synthesizeSpeech: vi.fn().mockRejectedValue(new Error('boom')) })
      await expect(a.run()).resolves.toBeUndefined()
      const b = setup({ sendAudioToBot: vi.fn().mockRejectedValue(new Error('boom')) })
      await expect(b.run()).resolves.toBeUndefined()
      expect(b.store.createIntervention).toHaveBeenCalledTimes(1)
    })

    it('records nothing extra when both channels fail, and the intervention stays in the app', async () => {
      const { run, store, logger } = setup({
        sendChat: vi.fn().mockResolvedValue({ ok: false, status: 404 }),
        synthesizeSpeech: vi.fn().mockResolvedValue({ ok: false, status: 0 }),
      })
      await run()
      expect(store.createIntervention).toHaveBeenCalledTimes(1)
      expect(store.setDeliveredTo).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ chat: 'failed', voice: 'tts-failed' }))
    })

    it('says "sent-not-recorded" for each channel when the delivery cannot be saved', async () => {
      const { run, logger } = setup({ store: { setDeliveredTo: vi.fn().mockRejectedValue(new Error('firestore')) } })
      await expect(run()).resolves.toBeUndefined()
      expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ chat: 'sent-not-recorded', voice: 'sent-not-recorded' }))
    })
  })

  it('does not speak without a bot id (the bot was not created, or the session cannot be read)', async () => {
    const noBot = setup({ session: { createdBy: 'docente-1' } })
    await noBot.run()
    expect(noBot.synthesizeSpeech).not.toHaveBeenCalled()

    const unreadable = setup({ store: { getSession: vi.fn().mockRejectedValue(new Error('firestore')) } })
    await unreadable.run()
    expect(unreadable.synthesizeSpeech).not.toHaveBeenCalled()
  })

  it('does not speak a duplicate intervention', async () => {
    const { run, synthesizeSpeech, sendAudioToBot, logger } = setup({ store: { createIntervention: vi.fn().mockResolvedValue({ created: false }) } })
    await run()
    expect(synthesizeSpeech).not.toHaveBeenCalled()
    expect(sendAudioToBot).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ created: false, voice: 'duplicate' }))
  })

  it('reads the session once even though chat, voice and memory could all need it', async () => {
    const { run, store } = setup()
    await run()
    expect(store.getSession).toHaveBeenCalledTimes(1)
  })

  it('never logs the spoken text, the keys or the audio', async () => {
    const { run, logger } = setup()
    await run()
    const logged = JSON.stringify(logger.info.mock.calls)
    expect(logged).not.toMatch(/explicarías|QUJD|ek|rk|voz1234567890/)
  })
})

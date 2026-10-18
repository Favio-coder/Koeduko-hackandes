import { describe, expect, it } from 'vitest'
import { readMeetVoiceConfig, readRecallConfig } from './config.js'

const recall = {
  RECALL_API_KEY: 'fake-api-key',
  RECALL_REGION: 'us-west-2',
  RECALL_WEBHOOK_URL: 'https://koeduko-sessions.vercel.app/api/recall-webhook',
  RECALL_WEBHOOK_TOKEN: 'fake-token',
}

describe('readMeetVoiceConfig', () => {
  it('is OFF by default, even with every key present', () => {
    expect(readMeetVoiceConfig({ ...recall, ELEVENLABS_API_KEY: 'el' }).enabled).toBe(false)
    expect(readMeetVoiceConfig({}).enabled).toBe(false)
  })

  it.each(['true', 'TRUE', ' 1 ', 'on', 'yes'])('turns on with MEET_VOICE_ENABLED=%s when the keys are there', (value) => {
    expect(readMeetVoiceConfig({ ...recall, ELEVENLABS_API_KEY: 'el', MEET_VOICE_ENABLED: value }).enabled).toBe(true)
  })

  it.each(['false', '0', 'off', 'no', '', 'maybe'])('stays off with MEET_VOICE_ENABLED=%s', (value) => {
    expect(readMeetVoiceConfig({ ...recall, ELEVENLABS_API_KEY: 'el', MEET_VOICE_ENABLED: value }).enabled).toBe(false)
  })

  it('needs both the ElevenLabs key and the Recall key', () => {
    expect(readMeetVoiceConfig({ ...recall, MEET_VOICE_ENABLED: 'true' }).enabled).toBe(false)
    expect(readMeetVoiceConfig({ ELEVENLABS_API_KEY: 'el', MEET_VOICE_ENABLED: 'true' }).enabled).toBe(false)
    expect(readMeetVoiceConfig({ ...recall, ELEVENLABS_API_KEY: '  ', MEET_VOICE_ENABLED: 'true' }).enabled).toBe(false)
  })

  it('passes the optional voice and model through, trimmed, and leaves them undefined otherwise', () => {
    const on = readMeetVoiceConfig({ ...recall, ELEVENLABS_API_KEY: 'el', MEET_VOICE_ENABLED: 'true', ELEVENLABS_VOICE_ID: ' voz123 ', ELEVENLABS_MODEL_ID: 'eleven_flash_v2_5' })
    expect(on).toMatchObject({ voiceId: 'voz123', modelId: 'eleven_flash_v2_5', elevenKey: 'el', apiKey: 'fake-api-key', region: 'us-west-2' })
    expect(readMeetVoiceConfig({ ...recall, ELEVENLABS_API_KEY: 'el', MEET_VOICE_ENABLED: 'true' })).toMatchObject({ voiceId: undefined, modelId: undefined })
  })
})

describe('readRecallConfig: the bot is created with audio output only when the voice is on', () => {
  it('speak is false by default', () => {
    expect(readRecallConfig(recall).speak).toBe(false)
  })

  it('speak is true only with the voice fully configured', () => {
    expect(readRecallConfig({ ...recall, ELEVENLABS_API_KEY: 'el', MEET_VOICE_ENABLED: 'true' }).speak).toBe(true)
    expect(readRecallConfig({ ...recall, MEET_VOICE_ENABLED: 'true' }).speak).toBe(false)
  })
})

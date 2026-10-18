import { describe, expect, it } from 'vitest'
import { readMeetChatConfig, readRecallConfig } from './config.js'
import { ConfigError } from './errors.js'

const env = {
  RECALL_API_KEY: 'fake-api-key',
  RECALL_REGION: 'us-west-2',
  RECALL_WEBHOOK_URL: 'https://koeduko-sessions.vercel.app/api/recall-webhook',
  RECALL_WEBHOOK_TOKEN: 'fake-token',
}

describe('readRecallConfig', () => {
  it('reads the four required variables and defaults the language to es', () => {
    expect(readRecallConfig(env)).toEqual({
      apiKey: 'fake-api-key',
      region: 'us-west-2',
      webhookUrl: 'https://koeduko-sessions.vercel.app/api/recall-webhook',
      webhookToken: 'fake-token',
      language: 'es',
      speak: false,
    })
  })

  it('allows overriding the language', () => {
    expect(readRecallConfig({ ...env, RECALL_TRANSCRIPT_LANGUAGE: 'multi' }).language).toBe('multi')
  })

  it('lists every missing variable by name only', () => {
    const error = (() => {
      try {
        readRecallConfig({ RECALL_REGION: 'us-west-2' })
      } catch (e) {
        return e
      }
    })()

    expect(error).toBeInstanceOf(ConfigError)
    expect(error.problems).toEqual([
      'RECALL_API_KEY (falta)',
      'RECALL_WEBHOOK_URL (falta)',
      'RECALL_WEBHOOK_TOKEN (falta)',
    ])
  })

  it('treats blank values as missing', () => {
    expect(() => readRecallConfig({ ...env, RECALL_API_KEY: '   ' })).toThrow(ConfigError)
  })

  it.each([
    'not a url',
    'http://koeduko-sessions.vercel.app/api/recall-webhook',
    'https://localhost:3000/api/recall-webhook',
    'https://127.0.0.1/api/recall-webhook',
    'https://192.168.1.5/api/recall-webhook',
  ])('rejects the webhook url %s', (url) => {
    expect(() => readRecallConfig({ ...env, RECALL_WEBHOOK_URL: url })).toThrow(ConfigError)
  })

  it('never puts secret values in the error', () => {
    try {
      readRecallConfig({ ...env, RECALL_WEBHOOK_URL: 'http://x.test' })
    } catch (error) {
      expect(error.message).not.toContain('fake-api-key')
      expect(error.message).not.toContain('fake-token')
    }
  })
})

describe('readMeetChatConfig', () => {
  it('is on by default when there is a Recall key', () => {
    expect(readMeetChatConfig({ RECALL_API_KEY: 'k', RECALL_REGION: 'us-west-2' })).toEqual({ enabled: true, apiKey: 'k', region: 'us-west-2' })
    expect(readMeetChatConfig({ RECALL_API_KEY: 'k', MEET_CHAT_ENABLED: 'true' }).enabled).toBe(true)
  })

  it.each(['false', 'FALSE', ' 0 ', 'off', 'no'])('turns off with MEET_CHAT_ENABLED=%s', (value) => {
    expect(readMeetChatConfig({ RECALL_API_KEY: 'k', MEET_CHAT_ENABLED: value }).enabled).toBe(false)
  })

  it('is off without a Recall key', () => {
    expect(readMeetChatConfig({}).enabled).toBe(false)
    expect(readMeetChatConfig({ RECALL_API_KEY: '  ' }).enabled).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { STALE_REQUEST_MS, canRequestBot } from './botRequest.js'

const NOW = 1_000_000

describe('canRequestBot', () => {
  it('allows the first invitation', () => {
    expect(canRequestBot(undefined, NOW)).toBe(true)
    expect(canRequestBot(null, NOW)).toBe(true)
    expect(canRequestBot({}, NOW)).toBe(true)
  })

  it('allows a new invitation after failure or completion', () => {
    expect(canRequestBot({ id: 'b', status: 'failed' }, NOW)).toBe(true)
    expect(canRequestBot({ id: 'b', status: 'done' }, NOW)).toBe(true)
  })

  it('blocks while the bot is requested with an id or in the call', () => {
    expect(canRequestBot({ id: 'b', status: 'requested', requestedAtMs: NOW }, NOW)).toBe(false)
    expect(canRequestBot({ id: 'b', status: 'in_call' }, NOW)).toBe(false)
  })

  it('blocks a fresh pending request without id (double click)', () => {
    expect(canRequestBot({ id: null, status: 'requested', requestedAtMs: NOW - 1000 }, NOW)).toBe(false)
  })

  it('allows retrying an abandoned pending request', () => {
    const old = NOW - STALE_REQUEST_MS - 1
    expect(canRequestBot({ id: null, status: 'requested', requestedAtMs: old }, NOW)).toBe(true)
    expect(canRequestBot({ id: null, status: 'requested' }, NOW)).toBe(true)
  })
})

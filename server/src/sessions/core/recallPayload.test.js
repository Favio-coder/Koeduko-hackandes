import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { arrivalTime, inArrivalOrder, nameFromKey, toRecallPayload } from './recallPayload.js'
import { normalizeRecallEvent } from './recallEvents.js'
import { normalizeName } from './participants.js'

const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/smoke-001.json', import.meta.url), 'utf8'))
const options = { sessionId: 'smoke-replay-001' }

describe('toRecallPayload is the inverse of normalizeRecallEvent', () => {
  it('turns every one of the fixture events back into itself (265 round trips)', () => {
    expect(fixture.events.length).toBe(265)
    for (const original of fixture.events) {
      const normalized = normalizeRecallEvent(toRecallPayload(original, options))
      const { id, ...expected } = original
      expect(normalized, `${original.type} ${original.participantKey} t=${original.t}`).not.toBeNull()
      expect(normalized.sessionId).toBe('smoke-replay-001')
      expect(normalized.eventId).toBe(id)
      expect(normalized.event).toEqual(expected)
    }
  })

  it('writes the session id where the webhook reads it', () => {
    const payload = toRecallPayload(fixture.events[0], options)
    expect(payload.data.bot.metadata.sessionId).toBe('smoke-replay-001')
  })

  it('splits a transcript into words that start at t and end at tEnd', () => {
    const transcript = fixture.events.find((e) => e.type === 'transcript')
    const { words } = toRecallPayload(transcript, options).data.data
    expect(words.length).toBeGreaterThan(1)
    expect(words[0].start_timestamp.relative).toBe(transcript.t)
    expect(words.at(-1).end_timestamp.relative).toBe(transcript.tEnd)
    expect(words.map((w) => w.text).join(' ')).toBe(transcript.text)
  })

  it('names participants so that normalizeName gives back the same key', () => {
    expect(nameFromKey('estudiante b')).toBe('Estudiante B')
    for (const { participantKey } of fixture.participants) expect(normalizeName(nameFromKey(participantKey))).toBe(participantKey)
  })

  it('rejects an event type it cannot send', () => {
    expect(() => toRecallPayload({ type: 'weird', participantKey: 'a', participantId: 1, t: 1 }, options)).toThrow(TypeError)
  })
})

describe('arrival order', () => {
  it('delivers transcripts later than the speech events that follow them, like the real service', () => {
    const arrival = inArrivalOrder(fixture.events)
    const firstTranscript = arrival.findIndex((e) => e.type === 'transcript')
    const sameTime = arrival.slice(0, firstTranscript).filter((e) => e.type !== 'transcript' && e.t > arrival[firstTranscript].t)
    expect(sameTime.length).toBeGreaterThan(0) // hay habla posterior al inicio del transcript que llega antes que el
  })

  it('is monotonic by arrival time and keeps all events', () => {
    const arrival = inArrivalOrder(fixture.events)
    expect(arrival).toHaveLength(fixture.events.length)
    for (let i = 1; i < arrival.length; i += 1) expect(arrivalTime(arrival[i])).toBeGreaterThanOrEqual(arrivalTime(arrival[i - 1]))
  })

  it('does not mutate the input', () => {
    const copy = structuredClone(fixture.events)
    inArrivalOrder(fixture.events)
    expect(fixture.events).toEqual(copy)
  })
})

import { describe, expect, it } from 'vitest'
import { normalizeRecallEvent } from './recallEvents.js'

const participant = { id: 100, name: 'Ana Tórres', is_host: false }
const bot = { id: 'bot-1', metadata: { sessionId: 'session-001' } }

const speech = (event, relative, extra = {}) => ({
  event,
  data: { data: { participant, timestamp: { absolute: '2026-10-17T20:00:00Z', relative }, data: null }, bot, ...extra },
})

const transcript = (words, p = participant) => ({
  event: 'transcript.data',
  data: { data: { words, language_code: 'es', participant: p }, bot },
})

describe('normalizeRecallEvent', () => {
  it('maps speech_on to an internal event with the relative time', () => {
    const result = normalizeRecallEvent(speech('participant_events.speech_on', 132.4))

    expect(result.sessionId).toBe('session-001')
    expect(result.event).toEqual({
      type: 'speech_on',
      participantKey: 'ana torres',
      participantId: 100,
      studentId: null,
      t: 132.4,
      tEnd: null,
      text: null,
      occurredAt: '2026-10-17T20:00:00Z',
    })
  })

  it('stores join and leave so participants can be mapped and reconnections detected', () => {
    const join = normalizeRecallEvent(speech('participant_events.join', 0.5))
    const leave = normalizeRecallEvent(speech('participant_events.leave', 16.2))

    expect(join.event).toMatchObject({ type: 'join', participantKey: 'ana torres', participantId: 100, t: 0.5, text: null })
    expect(leave.event).toMatchObject({ type: 'leave', participantKey: 'ana torres', participantId: 100, t: 16.2 })
    expect(join.eventId).toMatch(/^evt-join/)
    expect(leave.eventId).toMatch(/^evt-leave/)
  })

  it('tells a reconnection apart: same name, new Recall participant id', () => {
    const make = (id, relative) =>
      normalizeRecallEvent({
        event: 'participant_events.join',
        data: { data: { participant: { id, name: 'Luis' }, timestamp: { relative } }, bot },
      })
    const first = make(5, 3)
    const again = make(9, 40)

    expect(first.event.participantKey).toBe(again.event.participantKey)
    expect(first.event.participantId).not.toBe(again.event.participantId)
    expect(first.eventId).not.toBe(again.eventId)
  })

  it('uses a null participantId when Recall does not send a numeric id', () => {
    const result = normalizeRecallEvent({
      event: 'participant_events.join',
      data: { data: { participant: { name: 'Luis' }, timestamp: { relative: 1 } }, bot },
    })
    expect(result.event.participantId).toBeNull()
  })

  it('keeps the absolute time of the last word end for transcripts', () => {
    const result = normalizeRecallEvent(
      transcript([
        { text: 'uno', start_timestamp: { relative: 1, absolute: '2026-10-17T20:00:01Z' }, end_timestamp: { relative: 1.4, absolute: '2026-10-17T20:00:01.400Z' } },
        { text: 'dos', start_timestamp: { relative: 1.5, absolute: '2026-10-17T20:00:01.500Z' }, end_timestamp: { relative: 2, absolute: '2026-10-17T20:00:02Z' } },
      ]),
    )
    expect(result.event.occurredAt).toBe('2026-10-17T20:00:02Z')
  })

  it('falls back to the first word start, then to null, when no end time is given', () => {
    const withStart = normalizeRecallEvent(
      transcript([{ text: 'si', start_timestamp: { relative: 2, absolute: '2026-10-17T20:00:03Z' }, end_timestamp: null }]),
    )
    const withNone = normalizeRecallEvent(
      transcript([{ text: 'si', start_timestamp: { relative: 2 }, end_timestamp: null }]),
    )
    expect(withStart.event.occurredAt).toBe('2026-10-17T20:00:03Z')
    expect(withNone.event.occurredAt).toBeNull()
  })

  it('ignores an absolute time that is not a valid date', () => {
    const result = normalizeRecallEvent({
      event: 'participant_events.speech_on',
      data: { data: { participant, timestamp: { relative: 1, absolute: 'not-a-date' } }, bot },
    })
    expect(result.event.occurredAt).toBeNull()
  })

  it('maps speech_off', () => {
    const result = normalizeRecallEvent(speech('participant_events.speech_off', 140))
    expect(result.event.type).toBe('speech_off')
    expect(result.event.t).toBe(140)
  })

  it('joins transcript words and leaves tEnd null when the last word has no end', () => {
    const result = normalizeRecallEvent(
      transcript([
        { text: 'son', start_timestamp: { relative: 10.5 }, end_timestamp: { relative: 10.8 } },
        { text: 'cuarenta', start_timestamp: { relative: 10.9 }, end_timestamp: { relative: 11.4 } },
        { text: 'y ocho', start_timestamp: { relative: 11.5 }, end_timestamp: null },
      ]),
    )

    expect(result.event).toMatchObject({
      type: 'transcript',
      text: 'son cuarenta y ocho',
      t: 10.5,
      tEnd: null,
    })
  })

  it('uses the last word end time when present', () => {
    const result = normalizeRecallEvent(
      transcript([
        { text: 'hola', start_timestamp: { relative: 1 }, end_timestamp: { relative: 1.5 } },
        { text: 'mundo', start_timestamp: { relative: 1.6 }, end_timestamp: { relative: 2.2 } },
      ]),
    )
    expect(result.event.tEnd).toBe(2.2)
  })

  it('tolerates a single word object instead of an array', () => {
    const result = normalizeRecallEvent(
      transcript({ text: 'cinco', start_timestamp: { relative: 3 }, end_timestamp: { relative: 3.4 } }),
    )
    expect(result.event.text).toBe('cinco')
  })

  it('falls back to a participant id key when the name is missing', () => {
    const result = normalizeRecallEvent(
      transcript([{ text: 'si', start_timestamp: { relative: 2 }, end_timestamp: null }], { id: 7, name: null }),
    )
    expect(result.event.participantKey).toBe('participant-7')
  })

  it('produces the same event id for the same event and different ids otherwise', () => {
    const a = normalizeRecallEvent(speech('participant_events.speech_on', 5))
    const b = normalizeRecallEvent(speech('participant_events.speech_on', 5))
    const c = normalizeRecallEvent(speech('participant_events.speech_on', 6))
    const d = normalizeRecallEvent(speech('participant_events.speech_off', 5))
    expect(a.eventId).toBe(b.eventId)
    expect(new Set([a.eventId, c.eventId, d.eventId]).size).toBe(3)
  })

  it('does not collide when participant id and time digits shift', () => {
    const mk = (id, relative) =>
      normalizeRecallEvent({
        event: 'participant_events.speech_on',
        data: { data: { participant: { id }, timestamp: { relative } }, bot },
      })
    expect(mk(1, 23).eventId).not.toBe(mk(12, 3).eventId)
  })

  it.each([
    ['unused event types', { ...speech('participant_events.chat_message', 1) }],
    ['a missing sessionId', { ...speech('participant_events.speech_on', 1), data: { data: speech('x', 1).data.data, bot: { id: 'b', metadata: {} } } }],
    ['an unsafe sessionId', { ...speech('participant_events.speech_on', 1), data: { data: speech('x', 1).data.data, bot: { id: 'b', metadata: { sessionId: 'a/b' } } } }],
    ['a missing timestamp', { event: 'participant_events.speech_on', data: { data: { participant }, bot } }],
    ['an empty transcript', transcript([])],
    ['a null body', null],
    ['a string body', 'nope'],
  ])('returns null for %s', (_label, payload) => {
    expect(normalizeRecallEvent(payload)).toBeNull()
  })
})

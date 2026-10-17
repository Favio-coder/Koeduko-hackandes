import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from './signals.js'
import { applyEvent, emptyState, foldEvents, talkTimeFromState } from './liveState.js'

const cfg = DEFAULT_CONFIG
const join = (key, t) => ({ type: 'join', participantKey: key, studentId: null, t, tEnd: null, text: null })
const leave = (key, t) => ({ type: 'leave', participantKey: key, studentId: null, t, tEnd: null, text: null })
const on = (key, t) => ({ type: 'speech_on', participantKey: key, studentId: null, t, tEnd: null, text: null })
const off = (key, t) => ({ type: 'speech_off', participantKey: key, studentId: null, t, tEnd: null, text: null })
const say = (key, t, tEnd, text, id) => ({ type: 'transcript', participantKey: key, studentId: null, t, tEnd, text, ...(id ? { id } : {}) })
const apply = (events, state = emptyState()) => events.reduce((s, e) => applyEvent(s, e, cfg), state)

describe('applyEvent', () => {
  it('starts empty and does not mutate the previous state', () => {
    const before = emptyState()
    const frozen = structuredClone(before)
    applyEvent(before, join('a', 1), cfg)
    expect(before).toEqual(frozen)
  })

  it('tracks presence with join/leave and adds someone who speaks without a join', () => {
    const state = apply([join('a', 0), on('b', 5), leave('a', 9)])
    expect(state.presence).toEqual([{ k: 'b', s: 5 }])
  })

  it('never tracks the bot', () => {
    const state = apply([join('tutor koeduko', 0), join('a', 0), say('tutor koeduko', 1, 2, 'hola')])
    expect(state.presence.map((p) => p.k)).toEqual(['a'])
    expect(state.transcripts).toEqual([])
  })

  it('keeps the active speaker and closes the previous one when another starts', () => {
    const state = apply([on('a', 0), on('b', 10)])
    expect(state.speaker).toEqual({ k: 'b', s: 10 })
    expect(state.intervals).toEqual([{ k: 'a', s: 0, e: 10 }])
    expect(state.lastSpeechT).toBe(10)
  })

  it('ignores a duplicated speech_on, a stale speech_off and a speech_on older than the speaker', () => {
    const state = apply([on('a', 5), on('a', 7), off('b', 8), on('c', 4)])
    expect(state.speaker).toEqual({ k: 'a', s: 5 })
    expect(state.intervals).toEqual([])
  })

  it('closes the active speaker when they leave', () => {
    const state = apply([on('a', 0), leave('a', 6)])
    expect(state.speaker).toBeNull()
    expect(state.intervals).toEqual([{ k: 'a', s: 0, e: 6 }])
  })

  it('keeps only the last N transcripts and does not add the same transcript twice', () => {
    const small = { ...cfg, maxTranscripts: 3 }
    const many = Array.from({ length: 5 }, (_, i) => say('a', i, i + 0.5, `frase ${i}`, `id-${i}`))
    const state = many.reduce((s, e) => applyEvent(s, e, small), emptyState())
    expect(state.transcripts.map((x) => x.x)).toEqual(['frase 2', 'frase 3', 'frase 4'])

    const again = applyEvent(state, many[4], small)
    expect(again).toBe(state)
  })

  it('records the end time of a transcript as speech activity', () => {
    expect(apply([say('a', 1, 4.5, 'hola')]).lastSpeechT).toBe(4.5)
  })

  it('drops intervals that fell out of the window and caps their number', () => {
    const windowed = { ...cfg, windowSec: 20, maxIntervals: 2 }
    const events = [on('a', 0), off('a', 4), on('a', 30), off('a', 34), on('b', 40), off('b', 42), on('a', 50), off('a', 52)]
    const state = events.reduce((s, e) => applyEvent(s, e, windowed), emptyState())
    expect(state.intervals).toEqual([{ k: 'b', s: 40, e: 42 }, { k: 'a', s: 50, e: 52 }])
  })

  it('remembers student ids', () => {
    const state = apply([{ ...join('a', 0), studentId: 'student-001' }])
    expect(state.students).toEqual([{ k: 'a', id: 'student-001' }])
  })

  it('ignores events without a participant or a valid time, and unknown types', () => {
    const base = emptyState()
    expect(applyEvent(base, { type: 'speech_on', participantKey: '', t: 1 }, cfg)).toBe(base)
    expect(applyEvent(base, { type: 'speech_on', participantKey: 'a', t: Number.NaN }, cfg)).toBe(base)
    expect(applyEvent(base, { type: 'weird', participantKey: 'a', t: 1 }, cfg)).toBe(base)
  })

  it('stays serializable for Firestore: no undefined values, plain JSON', () => {
    const state = apply([join('a', 0), { ...join('b', 0), studentId: 'student-002' }, on('a', 1), on('b', 5), say('a', 1, 4, 'hola', 'e1'), say('b', 5, 6, 'adios')])
    expect(state).toStrictEqual(JSON.parse(JSON.stringify(state)))
  })
})

describe('foldEvents and talkTimeFromState', () => {
  it('produces the same state whatever the arrival order of simultaneous events', () => {
    const events = [join('a', 0), join('b', 0), on('a', 0), off('a', 10), on('b', 10), off('b', 20)]
    const first = foldEvents(events, cfg)
    const second = foldEvents([...events].reverse(), cfg)
    expect(second).toEqual(first)
  })

  it('counts the open speaker until the end of the range and clips to the window', () => {
    const state = foldEvents([on('a', 0), off('a', 10), on('b', 10)], cfg)
    expect(talkTimeFromState(state, { from: 5, to: 30 })).toEqual({ a: 5, b: 20 })
  })

  it('seeds zeros for participants who did not speak', () => {
    expect(talkTimeFromState(emptyState(), { from: 0, to: 10, participants: ['a'] })).toEqual({ a: 0 })
  })
})

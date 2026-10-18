import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emptyState, foldEvents } from './liveState.js'
import { DEFAULT_CONFIG } from './signals.js'
import { VIEW_TRANSCRIPTS, viewOf } from './liveView.js'

const join = (key, t) => ({ type: 'join', participantKey: key, studentId: null, t, tEnd: null, text: null })
const on = (key, t) => ({ type: 'speech_on', participantKey: key, studentId: null, t, tEnd: null, text: null })
const off = (key, t) => ({ type: 'speech_off', participantKey: key, studentId: null, t, tEnd: null, text: null })
const say = (key, t, tEnd, text) => ({ type: 'transcript', participantKey: key, studentId: null, t, tEnd, text })
const fold = (events) => foldEvents(events, DEFAULT_CONFIG)

describe('viewOf', () => {
  it('is empty for an empty session', () => {
    expect(viewOf(emptyState(), DEFAULT_CONFIG)).toEqual({ v: 1, t: 0, windowSec: 180, totalSpeechSec: 0, participants: [], transcripts: [] })
  })

  it('computes each participant\'s share of the speech with display names', () => {
    const state = fold([join('ana torres', 0), join('luis rojas', 0), on('ana torres', 0), off('ana torres', 30), on('luis rojas', 30), off('luis rojas', 40)])
    const view = viewOf(state, DEFAULT_CONFIG)

    expect(view.totalSpeechSec).toBe(40)
    expect(view.participants).toEqual([
      { key: 'ana torres', name: 'Ana', sharePct: 75, talkSec: 30, speaking: false, presentSec: 40 },
      { key: 'luis rojas', name: 'Luis', sharePct: 25, talkSec: 10, speaking: false, presentSec: 40 },
    ])
  })

  it('gives someone who joined and never spoke 0 %, and marks who is speaking now', () => {
    const state = fold([join('a', 0), join('b', 0), on('a', 1)])
    const view = viewOf(state, DEFAULT_CONFIG)
    expect(view.participants.find((p) => p.key === 'b')).toMatchObject({ sharePct: 0, talkSec: 0, speaking: false })
    expect(view.participants.find((p) => p.key === 'a').speaking).toBe(true)
  })

  it('only lists people who are in the room, and never the bot', () => {
    const state = fold([join('a', 0), join('tutor koeduko', 0), join('b', 0), on('b', 1), off('b', 3), { ...join('b', 5), type: 'leave' }])
    expect(viewOf(state, DEFAULT_CONFIG).participants.map((p) => p.key)).toEqual(['a'])
  })

  it('keeps the last 20 transcript lines, each with its speaker, in order', () => {
    const lines = Array.from({ length: 25 }, (_, i) => say(i % 2 ? 'b' : 'a', i * 2, i * 2 + 1, `frase ${i}`))
    const state = foldEvents(lines, { ...DEFAULT_CONFIG, maxTranscripts: 30 })
    const { transcripts } = viewOf(state, DEFAULT_CONFIG)

    expect(VIEW_TRANSCRIPTS).toBe(20)
    expect(transcripts).toHaveLength(20)
    expect(transcripts[0]).toEqual({ key: 'b', name: 'B', text: 'frase 5', t: 11 })
    expect(transcripts.at(-1).text).toBe('frase 24')
  })

  it('never contains the expected answer, the problem or any Firestore-hostile value', () => {
    const state = fold([join('a', 0), on('a', 0), off('a', 5), say('a', 1, 4, 'hola')])
    const view = viewOf(state, DEFAULT_CONFIG)
    expect(JSON.stringify(view)).not.toMatch(/expectedAnswer|problem/)
    expect(view).toStrictEqual(JSON.parse(JSON.stringify(view)))
  })

  it('is small enough to be cheap to read: well under 8 KB on the real session', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/smoke-001.json', import.meta.url), 'utf8'))
    const view = viewOf(fold(fixture.events), DEFAULT_CONFIG)
    expect(JSON.stringify(view).length).toBeLessThan(8000)
  })

  it('over the first 55 s of the real session (where the engine measured 49.9 / 0 / 50.1), shows the silent participant at 0 % and the other two near half each', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/smoke-001.json', import.meta.url), 'utf8'))
    const early = fixture.events.filter((e) => (e.type === 'transcript' ? e.tEnd : e.t) <= 55)
    const view = viewOf(fold(early), DEFAULT_CONFIG)
    const pct = Object.fromEntries(view.participants.map((p) => [p.name, p.sharePct]))

    expect(pct['Estudiante B']).toBe(0)
    expect(pct['Estudiante A'] + pct['Estudiante C']).toBeGreaterThanOrEqual(99)
    expect(Math.abs(pct['Estudiante A'] - pct['Estudiante C'])).toBeLessThan(5)
  })
})

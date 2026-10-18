import { describe, expect, it } from 'vitest'
import { botStatusMeta, canInvite, describeEvidence, formatSpan, metaOf, timeAgo } from './describeIntervention'

describe('formatSpan', () => {
  it.each([
    [55, '55 s'],
    [89, '89 s'],
    [90, '2 min'],
    [180, '3 min'],
    [0, ''],
    [-5, ''],
    [undefined, ''],
    ['x', ''],
  ])('%s -> %j', (seconds, expected) => {
    expect(formatSpan(seconds)).toBe(expected)
  })
})

describe('describeEvidence', () => {
  const silent = {
    signal: 'SILENT_PEER',
    targetName: 'Estudiante B',
    participantKey: 'estudiante b',
    evidence: { shares: { 'estudiante a': 0.5, 'estudiante b': 0, 'estudiante c': 0.5 }, windowSec: 180, presentSec: 55, skillId: null, activityId: null },
  }

  it('explains a silent peer in plain words, over the time actually observed', () => {
    expect(describeEvidence(silent)).toBe('Estudiante B habló 0% en los últimos 55 s')
  })

  it('uses the window when the person has been there longer than it', () => {
    expect(describeEvidence({ ...silent, evidence: { ...silent.evidence, presentSec: 600 } })).toBe('Estudiante B habló 0% en los últimos 3 min')
  })

  it('rounds the share and explains dominance', () => {
    const dominance = { signal: 'DOMINANCE', targetName: 'Ana', participantKey: 'ana', evidence: { shares: { ana: 0.8149, luis: 0.1851 }, windowSec: 180 } }
    expect(describeEvidence(dominance)).toBe('Ana habló 81% de la conversación en los últimos 3 min')
  })

  it('shows what a student said when the answer was wrong, without any expected value', () => {
    const wrong = { signal: 'WRONG_ANSWER', targetName: 'Luis', participantKey: 'luis', evidence: { numbers: [46, 47], skillId: 'm', activityId: 'p' } }
    expect(describeEvidence(wrong)).toBe('Luis dijo 46 o 47')
    expect(describeEvidence(wrong)).not.toMatch(/48|esperad/)
  })

  it('says a correct answer matches, never which number', () => {
    expect(describeEvidence({ signal: 'CORRECT_ANSWER', targetName: 'Ana', evidence: { numbers: [48] } })).toBe('Ana dio una respuesta que coincide con lo esperado')
  })

  it('explains confusion and group silence', () => {
    expect(describeEvidence({ signal: 'STUCK', evidence: { markers: 3, windowSec: 180 } })).toBe('Se oyeron 3 frases de confusión en los últimos 3 min')
    expect(describeEvidence({ signal: 'GROUP_SILENCE', evidence: { silenceSec: 41.6 } })).toBe('Llevan 42 s sin hablar')
  })

  it('degrades gracefully when the evidence is missing or the signal is unknown', () => {
    expect(describeEvidence({ signal: 'SILENT_PEER', targetName: 'Ana' })).toBe('Ana casi no habló')
    expect(describeEvidence({ signal: 'DOMINANCE' })).toBe('Un estudiante habló la mayor parte del tiempo')
    expect(describeEvidence({ signal: 'WRONG_ANSWER', targetName: 'Ana', evidence: {} })).toBe('Ana dio una respuesta')
    expect(describeEvidence({ signal: 'STUCK', evidence: {} })).toBe('Se oyeron frases de confusión')
    expect(describeEvidence({ signal: 'NEW_THING' })).toBe('')
    expect(describeEvidence(null)).toBe('')
    expect(describeEvidence(undefined)).toBe('')
  })
})

describe('metaOf', () => {
  it('gives each known signal a label and a tone, and a neutral fallback for unknown ones', () => {
    expect(metaOf('SILENT_PEER')).toEqual({ label: 'Invitó a participar', tone: 'info' })
    expect(metaOf('WRONG_ANSWER').tone).toBe('danger')
    expect(metaOf('???')).toEqual({ label: 'Intervención', tone: 'neutral' })
  })
})

describe('timeAgo', () => {
  const NOW = 1_000_000
  it.each([
    [NOW - 1000, 'ahora'],
    [NOW - 12_000, 'hace 12 s'],
    [NOW - 180_000, 'hace 3 min'],
    [NOW - 7_200_000, 'hace 2 h'],
    [NOW + 5000, 'ahora'],
    [null, ''],
    [undefined, ''],
  ])('%s -> %j', (created, expected) => {
    expect(timeAgo(created, NOW)).toBe(expected)
  })
})

describe('tutor status in the meeting', () => {
  it('describes every bot status and falls back to "not invited"', () => {
    expect(botStatusMeta('in_call')).toMatchObject({ label: 'Tutor en la reunión', dot: true })
    expect(botStatusMeta('requested').label).toMatch(/admítelo/)
    expect(botStatusMeta('failed').tone).toBe('danger')
    expect(botStatusMeta(undefined).label).toBe('Tutor no invitado')
    expect(botStatusMeta('raro').label).toBe('Tutor no invitado')
  })

  it('lets the teacher invite again except while the tutor is requested or in the call', () => {
    expect(canInvite(undefined)).toBe(true)
    expect(canInvite('failed')).toBe(true)
    expect(canInvite('done')).toBe(true)
    expect(canInvite('requested')).toBe(false)
    expect(canInvite('in_call')).toBe(false)
  })
})

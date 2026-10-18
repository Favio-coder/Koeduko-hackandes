import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  SIGNAL_PRIORITY,
  computeTalkTime,
  countConfusionMarkers,
  detectSignals,
  extractNumbers,
  selectInterventions,
} from './signals.js'

// ---- helpers para armar sesiones ----
const join = (key, t) => ({ type: 'join', participantKey: key, studentId: null, t, tEnd: null, text: null })
const leave = (key, t) => ({ type: 'leave', participantKey: key, studentId: null, t, tEnd: null, text: null })
const on = (key, t) => ({ type: 'speech_on', participantKey: key, studentId: null, t, tEnd: null, text: null })
const off = (key, t) => ({ type: 'speech_off', participantKey: key, studentId: null, t, tEnd: null, text: null })
const say = (key, t, tEnd, text) => ({ type: 'transcript', participantKey: key, studentId: null, t, tEnd, text })

/** Habla como hablante activo: cada tramo [key, inicio, fin] genera su on/off. Todos entran en t=0. */
function conversation(turns, { joined = [...new Set(turns.map(([key]) => key))], joinAt = 0 } = {}) {
  return [
    ...joined.map((key) => join(key, joinAt)),
    ...turns.flatMap(([key, start, end]) => [on(key, start), off(key, end)]),
  ]
}

const types = (signals) => signals.map((s) => s.type)

describe('computeTalkTime', () => {
  it('pairs speech_on and speech_off per participant', () => {
    const events = [on('a', 0), off('a', 10), on('b', 10), off('b', 15)]
    expect(computeTalkTime(events, { from: 0, to: 20 })).toEqual({ a: 10, b: 5 })
  })

  it('counts an open speech_on until the end of the range', () => {
    expect(computeTalkTime([on('a', 0)], { from: 0, to: 20 })).toEqual({ a: 20 })
  })

  it('clips intervals to the window', () => {
    expect(computeTalkTime([on('a', 0), off('a', 100)], { from: 50, to: 80 })).toEqual({ a: 30 })
    expect(computeTalkTime([on('a', 0), off('a', 10)], { from: 50, to: 80 })).toEqual({})
  })

  it('treats speech as the active speaker: another speech_on closes the previous interval', () => {
    // a nunca manda su speech_off a tiempo; el speech_on de b lo cierra
    const events = [on('a', 0), on('b', 10), off('a', 10.2), off('b', 20)]
    expect(computeTalkTime(events, { from: 0, to: 30 })).toEqual({ a: 10, b: 10 })
  })

  it.each([
    ['off before on', [on('a', 0), off('a', 10), on('b', 10), off('b', 20)]],
    ['on before off', [on('a', 0), on('b', 10), off('a', 10), off('b', 20)]],
  ])('gives the same result when two speakers swap at the same instant (%s)', (_label, events) => {
    expect(computeTalkTime(events, { from: 0, to: 30 })).toEqual({ a: 10, b: 10 })
  })

  it('ignores a duplicated speech_on and a speech_off nobody is waiting for', () => {
    const events = [off('a', 1), on('a', 5), on('a', 8), off('a', 15)]
    expect(computeTalkTime(events, { from: 0, to: 30 })).toEqual({ a: 10 })
  })

  it('closes the open interval when the speaker leaves', () => {
    expect(computeTalkTime([on('a', 0), leave('a', 12)], { from: 0, to: 30 })).toEqual({ a: 12 })
  })

  it('ignores events after the end of the range', () => {
    expect(computeTalkTime([on('a', 0), off('a', 10), on('b', 40), off('b', 50)], { from: 0, to: 20 })).toEqual({ a: 10 })
  })

  it('seeds zeros for participants who never spoke', () => {
    expect(computeTalkTime([on('a', 0), off('a', 4)], { from: 0, to: 10, participants: ['a', 'b'] })).toEqual({ a: 4, b: 0 })
  })
})

describe('DOMINANCE and SILENT_PEER', () => {
  const now = 100

  it('flags the dominant speaker at 80/20 and nobody at 60/40', () => {
    const dominated = conversation([['a', 0, 40], ['b', 40, 50], ['a', 50, 90], ['b', 90, 100]])
    const balanced = conversation([['a', 0, 30], ['b', 30, 50], ['a', 50, 80], ['b', 80, 100]])

    const signals = detectSignals(dominated, now)
    expect(signals.filter((s) => s.type === 'DOMINANCE').map((s) => s.participantKey)).toEqual(['a'])
    expect(detectSignals(balanced, now)).toEqual([])
  })

  it('does not evaluate with less than 45 s of total speech', () => {
    const little = conversation([['a', 0, 36], ['b', 36, 40]])
    expect(detectSignals(little, 60)).toEqual([])
  })

  it('flags a participant who joined and never spoke (0 % of the speech) as SILENT_PEER', () => {
    const events = conversation([['a', 0, 50], ['c', 50, 100]], { joined: ['a', 'b', 'c'] })

    const silent = detectSignals(events, now).filter((s) => s.type === 'SILENT_PEER')

    expect(silent.map((s) => s.participantKey)).toEqual(['b'])
    expect(silent[0].evidence.shares).toEqual({ a: 0.5, b: 0, c: 0.5 })
    expect(types(detectSignals(events, now))).not.toContain('DOMINANCE')
  })

  it('does not accuse someone who has just arrived', () => {
    const events = [...conversation([['a', 0, 50], ['c', 50, 100]]), join('b', 90)]
    expect(types(detectSignals(events, now))).not.toContain('SILENT_PEER')
  })

  it('does not accuse someone who already left', () => {
    const events = [...conversation([['a', 0, 50], ['c', 50, 100]], { joined: ['a', 'b', 'c'] }), leave('b', 80)]
    expect(types(detectSignals(events, now))).not.toContain('SILENT_PEER')
  })

  it('never counts the bot as a participant', () => {
    const events = [...conversation([['a', 0, 50], ['c', 50, 100]]), join('tutor koeduko', 0)]
    expect(detectSignals(events, now)).toEqual([])
  })

  it('needs at least two participants', () => {
    expect(detectSignals(conversation([['a', 0, 100]]), now)).toEqual([])
  })

  it('reports both signals at 90/10 and selectInterventions prefers talking to the quiet one', () => {
    const events = conversation([['a', 0, 45], ['b', 45, 55], ['a', 55, 100]])
    const signals = detectSignals(events, now)

    expect(types(signals)).toEqual(['SILENT_PEER', 'DOMINANCE'])
    const [chosen] = selectInterventions(signals, [], now)
    expect(chosen).toMatchObject({ type: 'SILENT_PEER', participantKey: 'b' })
  })
})

describe('GROUP_SILENCE (off by default)', () => {
  it('is disabled by default: 40 s of silence produce no signal', () => {
    const talked = conversation([['a', 0, 30], ['b', 30, 60]])
    expect(DEFAULT_CONFIG.disabledSignals).toEqual(['GROUP_SILENCE'])
    expect(types(detectSignals(talked, 100))).not.toContain('GROUP_SILENCE')
    expect(types(detectSignals(talked, 500))).not.toContain('GROUP_SILENCE')
  })

  const talk = conversation([['a', 0, 30], ['b', 30, 60]])
  const ON = { config: { disabledSignals: [] } } // apagada por defecto: aqui se enciende para probarla

  it('fires after 40 s without speech and not before', () => {
    expect(types(detectSignals(talk, 99, ON))).not.toContain('GROUP_SILENCE')
    const signals = detectSignals(talk, 100, ON).filter((s) => s.type === 'GROUP_SILENCE')
    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({ participantKey: null, evidence: { silenceSec: 40, lastSpeechT: 60 } })
  })

  it('never fires if nobody has spoken yet', () => {
    expect(detectSignals([join('a', 0), join('b', 0)], 200, ON)).toEqual([])
  })

  it('does not fire while someone is still speaking', () => {
    expect(types(detectSignals([...talk, on('a', 70)], 200, ON))).not.toContain('GROUP_SILENCE')
  })

  it('only says they stopped talking: a silence after a confusion marker is not STUCK', () => {
    const events = [...talk, say('b', 55, 60, 'no entiendo')]
    const signals = detectSignals(events, 100, ON)

    expect(types(signals)).toContain('GROUP_SILENCE')
    expect(types(signals)).not.toContain('STUCK')
    expect(signals.find((s) => s.type === 'GROUP_SILENCE').evidence).not.toHaveProperty('markers')
  })
})

describe('disabledSignals', () => {
  const events = conversation([['a', 0, 45], ['b', 45, 55], ['a', 55, 100]])

  it('can switch off any signal by configuration without touching the others', () => {
    expect(types(detectSignals(events, 100))).toEqual(['SILENT_PEER', 'DOMINANCE'])
    expect(types(detectSignals(events, 100, { config: { disabledSignals: ['SILENT_PEER'] } }))).toEqual(['DOMINANCE'])
    expect(types(detectSignals(events, 100, { config: { disabledSignals: ['SILENT_PEER', 'DOMINANCE'] } }))).toEqual([])
  })

  it('a disabled signal is never chosen as an intervention', () => {
    const signals = detectSignals(events, 100, { config: { disabledSignals: ['SILENT_PEER'] } })
    expect(selectInterventions(signals, [], 100)[0].type).toBe('DOMINANCE')
  })
})

describe('STUCK', () => {
  const room = [join('a', 0), join('b', 0)]

  it('needs two confusion markers in the window', () => {
    const one = [...room, say('a', 10, 12, 'no entiendo')]
    const two = [...one, say('b', 20, 22, 'me perdí')]
    expect(types(detectSignals(one, 30))).not.toContain('STUCK')
    expect(detectSignals(two, 30).find((s) => s.type === 'STUCK')).toMatchObject({ evidence: { markers: 2 } })
  })

  it('ignores markers outside the window', () => {
    const old = [...room, say('a', 10, 12, 'no entiendo'), say('b', 20, 22, 'ayuda')]
    expect(types(detectSignals(old, 400))).not.toContain('STUCK')
  })

  it.each([
    ['No sé cómo se hace', 2],
    ['no se, ¿tu?', 1],
    ['No entiendo, estoy PERDIDO, me perdí', 2],
    ['esto está difícil', 1],
    ['necesito ayuda', 1],
    ['no se puede dividir', 0],
    ['no se mueve', 0],
    ['ya entendimos todo', 0],
  ])('counts confusion markers in "%s" -> %i', (text, expected) => {
    expect(countConfusionMarkers(text)).toBe(expected)
  })
})

describe('WRONG_ANSWER and CORRECT_ANSWER', () => {
  const problem = { activityId: 'act-1', skillId: 'multiplication', text: '6 x 8', expectedAnswer: 48 }
  const room = [join('a', 0), join('b', 0)]
  const answerOf = (text, extra = {}) =>
    detectSignals([...room, say('a', 10, 12, text)], 20, { problem: { ...problem, ...extra } }).filter((s) =>
      ['WRONG_ANSWER', 'CORRECT_ANSWER'].includes(s.type),
    )

  describe('a number cut in two by the transcription ("cuarenta y" | "dos")', () => {
    const run = (events, now) => detectSignals([...room, ...events], now, { problem }).filter((s) => ['WRONG_ANSWER', 'CORRECT_ANSWER'].includes(s.type))

    it('waits for the rest instead of reading "cuarenta y" as 40', () => {
      expect(run([say('a', 10, 12, 'veo que son cuarenta y')], 14)).toEqual([])
    })

    it('reads both fragments together once the rest arrives (42 is wrong, 48 is right)', () => {
      const wrong = run([say('a', 10, 12, 'veo que son cuarenta y'), say('a', 13, 15, 'dos, algo así, más o menos')], 16)
      expect(wrong).toHaveLength(1)
      expect(wrong[0]).toMatchObject({ type: 'WRONG_ANSWER', evidence: { numbers: [42] } })

      const right = run([say('a', 10, 12, 'creo que son cuarenta y'), say('a', 13, 14, 'ocho')], 16)
      expect(right[0]).toMatchObject({ type: 'CORRECT_ANSWER' })
    })

    it('does not wait forever: a phrase left hanging is read after the grace period', () => {
      const [signal] = run([say('a', 10, 12, 'veo que son cuarenta y')], 20)
      expect(signal).toMatchObject({ type: 'WRONG_ANSWER', evidence: { numbers: [40] } })
    })
  })

  it('marks a wrong number in an answer-like phrase', () => {
    const [signal] = answerOf('creo que son 46')
    expect(signal).toMatchObject({
      type: 'WRONG_ANSWER',
      participantKey: 'a',
      t: 12,
      evidence: { expectedAnswer: 48, numbers: [46], skillId: 'multiplication', activityId: 'act-1' },
    })
  })

  it.each(['son 48', 'creo que son 48', 'da 48', '6 x 8 = 48', 'son cuarenta y ocho', 'Cuarenta Y Ocho', 'sale CUARENTA Y OCHO'])(
    'accepts "%s" as correct',
    (text) => {
      expect(types(answerOf(text))).toEqual(['CORRECT_ANSWER'])
    },
  )

  it('accepts numbers in words for any expected answer from 0 to 1000', () => {
    expect(types(answerOf('ciento veinte', { expectedAnswer: 120 }))).toEqual(['CORRECT_ANSWER'])
    expect(types(answerOf('doce', { expectedAnswer: 12 }))).toEqual(['CORRECT_ANSWER'])
    expect(types(answerOf('Veintidós', { expectedAnswer: 22 }))).toEqual(['CORRECT_ANSWER'])
    expect(types(answerOf('mil', { expectedAnswer: 1000 }))).toEqual(['CORRECT_ANSWER'])
    expect(types(answerOf('3,5', { expectedAnswer: 3.5 }))).toEqual(['CORRECT_ANSWER'])
  })

  it('marks a wrong number said in words', () => {
    expect(types(answerOf('son cuarenta y seis'))).toEqual(['WRONG_ANSWER'])
  })

  it('does not take a marker far from the number as an answer (real false positive in smoke-001)', () => {
    const text = 'Bueno, sí. O sea, lo recomendable es que sea un minuto, y que las dos personas estén hablando, y luego de ahí va a ir escribiendo.'
    expect(answerOf(text, { expectedAnswer: 2 })).toEqual([])
  })

  it('reads the answer from the sentence that carries it, even inside a long turn', () => {
    const [signal] = answerOf('Dos. Ya, pero el señor, es verdad.', { expectedAnswer: 2 })
    expect(signal).toMatchObject({ type: 'CORRECT_ANSWER', evidence: { numbers: [2] } })
  })

  it('does not take reading the question aloud, or asking one, as an answer', () => {
    expect(answerOf('¿Cuánto son seis por ocho?')).toEqual([])
    expect(answerOf('¿Cinco sesiones simultáneas?', { expectedAnswer: 2 })).toEqual([])
    expect(types(answerOf('¿cuarenta y ocho?'))).toEqual(['CORRECT_ANSWER'])
  })

  it('keeps decimals in one piece when splitting sentences', () => {
    expect(types(answerOf('Son 3.5. Creo.', { expectedAnswer: 3.5 }))).toEqual(['CORRECT_ANSWER'])
  })

  it('accepts an answer only when the marker sits right before the number', () => {
    expect(types(answerOf('la respuesta es 48'))).toEqual(['CORRECT_ANSWER'])
    expect(types(answerOf('yo creo que más o menos son 46 manzanas'))).toEqual(['WRONG_ANSWER'])
  })

  it('ignores sentences that do not look like an answer', () => {
    expect(answerOf('las dos personas estén hablando', { expectedAnswer: 2 })).toEqual([])
    expect(answerOf('no sé', {})).toEqual([])
    expect(answerOf('deme un minuto', {})).toEqual([])
  })

  it('uses only the last transcript of each participant', () => {
    const events = [...room, say('a', 10, 12, 'son 46'), say('a', 14, 16, 'ah no, son 48')]
    const signals = detectSignals(events, 20, { problem })
    expect(types(signals)).toEqual(['CORRECT_ANSWER'])
  })

  it('evaluates each participant on their own', () => {
    const events = [...room, say('a', 10, 12, 'son 48'), say('b', 13, 15, 'son 50')]
    const signals = detectSignals(events, 20, { problem })
    expect(signals.map((s) => [s.type, s.participantKey])).toEqual([
      ['WRONG_ANSWER', 'b'],
      ['CORRECT_ANSWER', 'a'],
    ])
  })

  it('ignores what was said before the problem started', () => {
    const events = [...room, say('a', 10, 12, 'son 46')]
    expect(detectSignals(events, 20, { problem: { ...problem, startedAtT: 30 } })).toEqual([])
  })

  it('produces no answer signals without an expected answer', () => {
    expect(detectSignals([...room, say('a', 10, 12, 'son 48')], 20)).toEqual([])
    expect(detectSignals([...room, say('a', 10, 12, 'son 48')], 20, { problem: { ...problem, expectedAnswer: null } })).toEqual([])
  })
})

describe('evidence context', () => {
  it('puts skillId and activityId in the evidence of every signal', () => {
    const problem = { activityId: 'act-7', skillId: 'fractions', text: '1/2 + 1/2', expectedAnswer: 1 }
    const events = [
      ...conversation([['a', 0, 45], ['b', 45, 55], ['a', 55, 100]]),
      say('a', 90, 95, 'no entiendo'),
      say('b', 96, 99, 'ayuda'),
    ]
    const signals = detectSignals(events, 100, { problem })

    expect(new Set(types(signals))).toEqual(new Set(['STUCK', 'SILENT_PEER', 'DOMINANCE']))
    for (const signal of signals) {
      expect(signal.evidence).toMatchObject({ skillId: 'fractions', activityId: 'act-7' })
    }
  })

  it('uses null when there is no current problem', () => {
    const signals = detectSignals(conversation([['a', 0, 45], ['b', 45, 55], ['a', 55, 100]]), 100)
    expect(signals.length).toBeGreaterThan(0)
    for (const signal of signals) expect(signal.evidence).toMatchObject({ skillId: null, activityId: null })
  })
})

describe('selectInterventions', () => {
  const signal = (type, participantKey = null, t = 100) => ({ type, participantKey, studentId: null, t, evidence: {} })

  it('returns at most one signal, by priority', () => {
    const all = SIGNAL_PRIORITY.map((type) => signal(type, 'a')).reverse()
    expect(selectInterventions(all, [], 100)).toHaveLength(1)
    expect(selectInterventions(all, [], 100)[0].type).toBe('WRONG_ANSWER')
    expect(SIGNAL_PRIORITY).toEqual(['WRONG_ANSWER', 'STUCK', 'SILENT_PEER', 'GROUP_SILENCE', 'DOMINANCE', 'CORRECT_ANSWER'])
  })

  it('drops the same signal inside the cooldown and lets it through after', () => {
    const history = [{ type: 'SILENT_PEER', participantKey: 'b', t: 40 }]
    expect(selectInterventions([signal('SILENT_PEER', 'b')], history, 100)).toEqual([]) // 60 s despues
    expect(selectInterventions([signal('SILENT_PEER', 'b')], history, 140)).toHaveLength(1) // 100 s despues
  })

  it('does not cool down a different recipient or type', () => {
    const history = [{ type: 'SILENT_PEER', participantKey: 'b', t: 90 }]
    expect(selectInterventions([signal('SILENT_PEER', 'c')], history, 100)).toHaveLength(1)
    expect(selectInterventions([signal('DOMINANCE', 'b')], history, 100)).toHaveLength(1)
  })

  it('falls back to the next signal when the best one is cooling down', () => {
    const history = [{ type: 'WRONG_ANSWER', participantKey: 'a', t: 90 }]
    const chosen = selectInterventions([signal('WRONG_ANSWER', 'a'), signal('DOMINANCE', 'a')], history, 100)
    expect(chosen.map((s) => s.type)).toEqual(['DOMINANCE'])
  })

  it('breaks ties by participant key', () => {
    const chosen = selectInterventions([signal('SILENT_PEER', 'zeta'), signal('SILENT_PEER', 'alfa')], [], 100)
    expect(chosen[0].participantKey).toBe('alfa')
  })

  it('honours a custom cooldown', () => {
    const history = [{ type: 'STUCK', participantKey: null, t: 90 }]
    expect(selectInterventions([signal('STUCK')], history, 100, { cooldownSec: 5 })).toHaveLength(1)
  })
})

describe('determinism and inputs', () => {
  const events = [
    ...conversation([['a', 0, 45], ['b', 45, 55], ['a', 55, 100]]),
    say('a', 90, 95, 'no entiendo'),
    say('b', 96, 99, 'ayuda'),
  ]

  it('gives the same output for the same input, whatever the order of the events', () => {
    const problem = { activityId: 'act-1', skillId: 'multiplication', text: '6 x 8', expectedAnswer: 48 }
    const first = detectSignals(events, 100, { problem })
    const second = detectSignals(events, 100, { problem })
    const shuffled = detectSignals([...events].reverse(), 100, { problem })
    expect(second).toEqual(first)
    expect(shuffled).toEqual(first)
  })

  it('does not mutate its input', () => {
    const copy = structuredClone(events)
    detectSignals(events, 100)
    expect(events).toEqual(copy)
  })

  it('never reads language_code: Recall reports "en" even for Spanish speech', () => {
    const tagged = events.map((event) => ({ ...event, language_code: 'en', languageCode: 'en' }))
    expect(detectSignals(tagged, 100)).toEqual(detectSignals(events, 100))
  })

  it('exposes frozen defaults', () => {
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true)
    expect(DEFAULT_CONFIG).toMatchObject({ windowSec: 180, minSpeechInWindowSec: 45, dominanceRatio: 0.7, silentPeerRatio: 0.15, groupSilenceSec: 40, stuckMarkersMin: 2, cooldownSec: 90 })
  })

  it('re-exports extractNumbers for words and digits', () => {
    expect(extractNumbers('son cuarenta y ocho')).toEqual([48])
  })
})

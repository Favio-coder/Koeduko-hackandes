import { describe, expect, it } from 'vitest'
import {
  GROUP_ADDRESSEE,
  MAX_CHARS,
  SYSTEM_INSTRUCTION,
  addresseeOf,
  buildInterventionPrompt,
  cleanMessage,
  displayName,
  fallbackMessage,
  revealsAnswer,
  validateMessage,
} from './interventionPolicy.js'
import { SIGNAL_PRIORITY } from './signals.js'

const problem = { activityId: 'p-03', skillId: 'multiplication', text: '¿Cuánto es 6 x 8?', expectedAnswer: 48 }
const silent = { type: 'SILENT_PEER', participantKey: 'luis rojas', evidence: { shares: { 'luis rojas': 0.05, ana: 0.95 } } }
const ctx = { addressee: 'Luis', expectedAnswer: 48, problemText: problem.text }

describe('displayName and addresseeOf', () => {
  it.each([
    ['luis rojas', 'Luis'],
    ['ana', 'Ana'],
    ['estudiante b', 'Estudiante B'],
    ['  maria   jose  ', 'Maria'],
    ['', null],
    [null, null],
  ])('%j -> %j', (key, expected) => {
    expect(displayName(key)).toBe(expected)
  })

  it('addresses the group when the signal has no recipient', () => {
    expect(addresseeOf({ type: 'STUCK', participantKey: null })).toBe(GROUP_ADDRESSEE)
    expect(addresseeOf(silent)).toBe('Luis')
  })
})

describe('revealsAnswer', () => {
  it.each([
    ['son 48', true],
    ['son cuarenta y ocho', true],
    ['Cuarenta Y Ocho', true],
    ['tienen 46', false],
    ['seis por ocho', false],
    ['', false],
  ])('%j with expected 48 -> %s', (text, expected) => {
    expect(revealsAnswer(text, 48)).toBe(expected)
  })

  it('never reveals when there is no expected answer', () => {
    expect(revealsAnswer('son 48', null)).toBe(false)
    expect(revealsAnswer('son 48', undefined)).toBe(false)
  })
})

describe('cleanMessage', () => {
  it('removes formatting, quotes, labels and line breaks', () => {
    expect(cleanMessage('  **Tutor:** "Luis, ¿cómo lo explicarías tú?"\n  ')).toBe('Luis, ¿cómo lo explicarías tú?')
    expect(cleanMessage('«Luis, ¿qué datos tienes?»')).toBe('Luis, ¿qué datos tienes?')
    expect(cleanMessage('Luis,\n¿qué\n\ntienes?')).toBe('Luis, ¿qué tienes?')
  })
})

describe('validateMessage', () => {
  it('accepts a good message', () => {
    expect(validateMessage('Luis, ¿cómo explicarías tú el problema con tus palabras?', ctx)).toEqual({ ok: true })
    expect(validateMessage('Luis, ¿cómo lo harías? ¿Qué parte del problema te parece más clara?', ctx)).toEqual({ ok: true })
  })

  it('rejects text that contains the expected answer, in digits or in words', () => {
    expect(validateMessage('Luis, ¿no serán 48 en el problema?', ctx)).toEqual({ ok: false, reason: 'reveals-answer' })
    expect(validateMessage('Luis, ¿será cuarenta y ocho en el problema?', ctx)).toEqual({ ok: false, reason: 'reveals-answer' })
  })

  it('rejects more than 2 sentences', () => {
    expect(validateMessage('Luis, ¿qué piensas del problema? ¿Qué datos tienes? ¿Cómo lo harías?', ctx)).toEqual({ ok: false, reason: 'too-many-sentences' })
  })

  it('rejects more than 220 characters', () => {
    const long = `Luis, ¿cómo explicarías el problema ${'con muchísimo detalle '.repeat(12)}?`
    expect(long.length).toBeGreaterThan(MAX_CHARS)
    expect(validateMessage(long, ctx)).toEqual({ ok: false, reason: 'too-long' })
  })

  it('rejects a message without a question, empty text, or markdown', () => {
    expect(validateMessage('Luis, explica el problema.', ctx)).toEqual({ ok: false, reason: 'no-question' })
    expect(validateMessage('   ', ctx)).toEqual({ ok: false, reason: 'empty' })
    expect(validateMessage(null, ctx)).toEqual({ ok: false, reason: 'empty' })
    expect(validateMessage('**Luis**, ¿cómo va el problema?', ctx)).toEqual({ ok: false, reason: 'format' })
  })

  it('requires naming the recipient, ignoring accents and capitals', () => {
    expect(validateMessage('¿Cómo explicarías el problema con tus palabras?', ctx)).toEqual({ ok: false, reason: 'missing-addressee' })
    expect(validateMessage('LUIS, ¿cómo ves el problema?', ctx)).toEqual({ ok: true })
    expect(validateMessage('Josè, ¿cómo ves el problema?', { ...ctx, addressee: 'José' })).toEqual({ ok: true })
  })

  it('accepts a group word when the message goes to everybody', () => {
    const group = { ...ctx, addressee: GROUP_ADDRESSEE }
    expect(validateMessage('Chicos, ¿qué dato del problema revisamos?', group)).toEqual({ ok: true })
    expect(validateMessage('Equipo, ¿qué dato del problema revisamos?', group)).toEqual({ ok: true })
    expect(validateMessage('¿Qué dato del problema revisamos?', group)).toEqual({ ok: false, reason: 'missing-addressee' })
  })

  it('requires asking about the current problem when there is one', () => {
    expect(validateMessage('Luis, ¿qué tal tu fin de semana?', ctx)).toEqual({ ok: false, reason: 'off-topic' })
    expect(validateMessage('Luis, ¿cómo resolverías 6 x 8 con dibujos?', ctx)).toEqual({ ok: true })
    expect(validateMessage('Luis, ¿qué tal tu fin de semana?', { ...ctx, problemText: null })).toEqual({ ok: true })
  })
})

describe('fallbackMessage: the demo is never mute', () => {
  const names = ['luis rojas', 'ana', 'estudiante b', null]
  const problems = [problem, null, { ...problem, text: '6 x 8 = 48' }, { ...problem, text: 'x'.repeat(200) }]

  it('has a message for every signal type', () => {
    expect(SIGNAL_PRIORITY.length).toBe(6)
    for (const type of SIGNAL_PRIORITY) {
      expect(fallbackMessage({ type, participantKey: 'luis rojas' }, { problem })).toMatch(/\?$/)
    }
  })

  it('always names the recipient, asks a question, fits the limits and never reveals the answer', () => {
    for (const type of SIGNAL_PRIORITY) {
      for (const participantKey of names) {
        for (const p of problems) {
          const signal = { type, participantKey }
          const message = fallbackMessage(signal, { problem: p })
          const check = validateMessage(message, {
            addressee: addresseeOf(signal),
            expectedAnswer: p?.expectedAnswer ?? null,
            problemText: p?.text ?? null,
          })
          expect(check, `${type} / ${participantKey} / ${p?.text?.slice(0, 12)} -> "${message}"`).toEqual({ ok: true })
        }
      }
    }
  })

  it('quotes a short problem and does not quote one that carries the answer', () => {
    expect(fallbackMessage(silent, { problem })).toContain('«¿Cuánto es 6 x 8?»')
    expect(fallbackMessage(silent, { problem: { ...problem, text: '6 x 8 = 48' } })).not.toContain('48')
  })

  it('names the group for signals without a recipient', () => {
    expect(fallbackMessage({ type: 'GROUP_SILENCE', participantKey: null }, { problem })).toMatch(/^Chicos,/)
  })
})

describe('buildInterventionPrompt', () => {
  const tail = [{ k: 'ana', x: 'yo creo que se multiplica' }, { k: 'luis rojas', x: 'no sé' }]
  const prompt = buildInterventionPrompt({ signal: silent, problem, transcriptTail: tail })

  it('carries the no-answer rule, the two-sentence limit and the socratic style', () => {
    expect(prompt.systemInstruction).toBe(SYSTEM_INSTRUCTION)
    expect(prompt.systemInstruction).toMatch(/NUNCA des la respuesta final/)
    expect(prompt.systemInstruction).toMatch(/Máximo 2 oraciones/)
    expect(prompt.systemInstruction).toMatch(/socrática/)
    expect(prompt.systemInstruction).toMatch(/nombrando al destinatario/)
  })

  it('names the recipient, the signal, the problem and the recent conversation', () => {
    expect(prompt.userPrompt).toContain('Destinatario: Luis')
    expect(prompt.userPrompt).toContain('Señal detectada: SILENT_PEER')
    expect(prompt.userPrompt).toContain('¿Cuánto es 6 x 8?')
    expect(prompt.userPrompt).toContain('- Ana: yo creo que se multiplica')
  })

  it('never puts the expected answer in the prompt, so the model cannot reveal it', () => {
    for (const type of SIGNAL_PRIORITY) {
      const built = buildInterventionPrompt({ signal: { type, participantKey: 'luis rojas', evidence: { numbers: [46], shares: {} } }, problem })
      expect(`${built.systemInstruction}\n${built.userPrompt}`).not.toMatch(/\b48\b/)
    }
    const leaky = buildInterventionPrompt({ signal: silent, problem: { ...problem, text: '6 x 8 = 48' } })
    expect(leaky.userPrompt).not.toContain('48')
  })

  it('tells the model what the student said when it was wrong, and not to name the right number', () => {
    const wrong = buildInterventionPrompt({ signal: { type: 'WRONG_ANSWER', participantKey: 'ana', evidence: { numbers: [46] } }, problem })
    expect(wrong.userPrompt).toContain('Su respuesta fue: 46')
    expect(wrong.userPrompt).toMatch(/No digas cuál es la correcta/)
  })

  it('handles a missing problem and a group recipient', () => {
    const group = buildInterventionPrompt({ signal: { type: 'GROUP_SILENCE', participantKey: null, evidence: { silenceSec: 40 } }, problem: null })
    expect(group.userPrompt).toContain('Destinatario: Chicos')
    expect(group.userPrompt).toContain('no hay un problema definido')
    expect(group.userPrompt).toContain('40 segundos')
  })
})

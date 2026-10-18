import { describe, expect, it } from 'vitest'
import { CAPABILITIES, EVIDENCE_STATE, FORMATIVE_NOTE } from './competencies.js'
import { buildCompetencyReport, doubtfulSentences, namesOperation, shorten } from './competencyEvidence.js'

const A = 'estudiante a'
const B = 'estudiante b'
const tr = (k, t, x, e = t + 2) => ({ k, t, e, x })

const problem = { activityId: 'p-01', skillId: 'multiplication', text: 'Hay 6 cajas con 8 lápices cada una. ¿Cuántos lápices hay en total?', expectedAnswer: 48 }

const conversation = [
  tr(B, 5, 'Hay seis cajas con ocho lápices cada una'),
  tr(A, 10, 'Entonces seis por ocho'),
  tr(A, 14, 'no entiendo cómo se hace'),
  tr(B, 20, 'son cuarenta y ocho'),
  tr(B, 24, 'porque seis veces ocho es cuarenta y ocho'),
  tr(A, 30, 'yo puse cuarenta y seis'),
]
const totals = [
  { k: A, sec: 30, turns: 4 },
  { k: B, sec: 10, turns: 2 },
]

const build = (patch = {}) => buildCompetencyReport({ transcripts: conversation, totals, participants: [A, B], problem, durationSec: 120, ...patch })
const capOf = (report, key, id) => report.estudiantes.find((s) => s.key === key).capacidades.find((c) => c.id === id)

describe('buildCompetencyReport', () => {
  it('reports the four capabilities of the competency for every student, in the curriculum order', () => {
    const report = build()
    expect(report.competencia).toEqual({ id: 'resuelve-problemas-cantidad', nombre: 'Resuelve problemas de cantidad' })
    expect(report.estudiantes.map((s) => s.name)).toEqual(['Estudiante A', 'Estudiante B'])
    for (const student of report.estudiantes) {
      expect(student.capacidades.map((c) => c.id)).toEqual(CAPABILITIES.map((c) => c.id))
    }
  })

  it('never assigns a grade, says it is formative evidence and never carries the expected answer', () => {
    const report = build()
    expect(report.nota).toBe(FORMATIVE_NOTE)
    const states = new Set(report.estudiantes.flatMap((s) => s.capacidades.map((c) => c.estado)))
    for (const state of states) expect(Object.values(EVIDENCE_STATE)).toContain(state)
    expect(JSON.stringify(report)).not.toMatch(/expectedAnswer|"nota":"(AD|A|B|C)"|"calificacion"/)
    expect(report.problema).toEqual({ activityId: 'p-01', skillId: 'multiplication', text: problem.text })
  })

  describe('Usa estrategias (CORRECT_ANSWER / WRONG_ANSWER)', () => {
    it('is "con evidencia" with a correct answer and "evidencia parcial" with only a wrong one', () => {
      const report = build()
      expect(capOf(report, B, 'usa-estrategias')).toMatchObject({ estado: 'con evidencia', señales: ['CORRECT_ANSWER'] })
      expect(capOf(report, A, 'usa-estrategias')).toMatchObject({ estado: 'evidencia parcial', señales: ['WRONG_ANSWER'] })
      expect(capOf(report, A, 'usa-estrategias').evidencias).toEqual([{ t: 30, cita: 'yo puse cuarenta y seis' }])
    })

    it('has no evidence without a problem or without answers', () => {
      expect(capOf(build({ problem: null }), B, 'usa-estrategias').estado).toBe('sin evidencia suficiente')
      expect(capOf(build({ transcripts: [tr(A, 1, 'hola a todos')] }), A, 'usa-estrategias').estado).toBe('sin evidencia suficiente')
    })

    it('ignores what was said before the problem started', () => {
      const report = build({ problem: { ...problem, startedAtT: 22 } })
      expect(capOf(report, B, 'usa-estrategias').evidencias.map((e) => e.t)).toEqual([24]) // solo lo posterior
    })
  })

  describe('Comunica (share and turns of speech)', () => {
    it('is "con evidencia" when they speak their fair share with enough turns, "parcial" when they barely do', () => {
      const report = build()
      expect(capOf(report, A, 'comunica').estado).toBe('con evidencia')
      expect(capOf(report, B, 'comunica').estado).toBe('evidencia parcial')
      expect(report.estudiantes.find((s) => s.key === A).resumen).toEqual({ talkPct: 75, talkSec: 30, turns: 4, estimated: false })
    })

    it('flags the dominant student and has no evidence for someone who never spoke', () => {
      const report = build({ participants: [A, B, 'estudiante c'] })
      expect(capOf(report, 'estudiante c', 'comunica')).toMatchObject({ estado: 'sin evidencia suficiente', señales: ['SILENT_PEER'] })
      expect(report.estudiantes.find((s) => s.key === 'estudiante c').capacidades.every((c) => c.estado === 'sin evidencia suficiente')).toBe(true)
    })

    it('estimates talk time from the transcripts when there are no totals, and says so', () => {
      const report = build({ totals: null })
      const a = report.estudiantes.find((s) => s.key === A)
      expect(a.resumen).toMatchObject({ talkSec: 6, turns: 3, estimated: true }) // 3 transcripciones de 2 s
    })

    it('quotes up to two substantial sentences, short', () => {
      const quotes = capOf(build(), A, 'comunica').evidencias
      expect(quotes.length).toBeLessThanOrEqual(2)
      for (const quote of quotes) expect(quote.cita.length).toBeLessThanOrEqual(121)
    })
  })

  describe('Traduce (operation with numbers, or stuck while framing the problem)', () => {
    it('with one operation phrase and a confusion it is only "parcial"', () => {
      const cap = capOf(build(), A, 'traduce')
      expect(cap.estado).toBe('evidencia parcial')
      expect(cap.señales).toEqual(['STUCK', 'OPERACION_CON_NUMEROS'])
      expect(cap.evidencias.map((e) => e.cita)).toContain('Entonces seis por ocho')
    })

    it('needs two operation phrases for "con evidencia"', () => {
      const report = build({ transcripts: [...conversation, tr(A, 40, 'o sumar ocho seis veces')] })
      expect(capOf(report, A, 'traduce').estado).toBe('con evidencia')
    })

    it('being stuck alone is "parcial" and says it was a difficulty, not a skill', () => {
      const report = build({ transcripts: [tr(A, 3, 'no entiendo nada de esto'), tr(B, 20, 'son cuarenta y ocho')] })
      expect(capOf(report, A, 'traduce')).toMatchObject({ estado: 'evidencia parcial', señales: ['STUCK'], nota: 'Mostró dificultad al plantear el problema.' })
    })

    it('does not count confusion that came after the first answer', () => {
      const report = build({ transcripts: [tr(B, 20, 'son cuarenta y ocho'), tr(A, 40, 'no entiendo')] })
      expect(capOf(report, A, 'traduce').estado).toBe('sin evidencia suficiente')
    })
  })

  describe('Argumenta (justifies after an answer)', () => {
    it('is "con evidencia" when the justification uses numbers or an operation', () => {
      const cap = capOf(build(), B, 'argumenta')
      expect(cap.estado).toBe('con evidencia')
      expect(cap.evidencias).toEqual([{ t: 24, cita: 'porque seis veces ocho es cuarenta y ocho' }])
    })

    it('is only "parcial" for a bare "porque" without numbers', () => {
      const report = build({ transcripts: [tr(B, 20, 'son cuarenta y ocho'), tr(B, 26, 'porque si porque me parece')] })
      expect(capOf(report, B, 'argumenta').estado).toBe('evidencia parcial')
    })

    it('does not count a justification that came well before any answer', () => {
      const report = build({ transcripts: [tr(A, 1, 'porque seis veces ocho me suena'), tr(B, 50, 'son cuarenta y ocho')] })
      expect(capOf(report, A, 'argumenta').estado).toBe('sin evidencia suficiente')
    })
  })

  describe('classifier labels (Gemini): they can only add "parcial"', () => {
    const doubt = [tr(A, 10, 'creo que primero hay que contar todas las cajas que tenemos aqui'), tr(B, 20, 'son cuarenta y ocho')]

    it('finds the doubtful sentences: long, not a question and not matched by any rule', () => {
      const found = doubtfulSentences({ transcripts: doubt, studentKeys: [A, B] })
      expect(found).toEqual([{ id: '0.0', k: A, t: 10, text: 'creo que primero hay que contar todas las cajas que tenemos aqui' }])
    })

    it('turns "sin evidencia" into "evidencia parcial" with the labeled quote, never into "con evidencia"', () => {
      const without = buildCompetencyReport({ transcripts: doubt, participants: [A, B], problem })
      expect(capOf(without, A, 'argumenta').estado).toBe('sin evidencia suficiente')

      const labeled = buildCompetencyReport({ transcripts: doubt, participants: [A, B], problem, labels: { '0.0': 'argumenta' } })
      expect(capOf(labeled, A, 'argumenta')).toMatchObject({ estado: 'evidencia parcial', señales: ['CLASIFICADOR'] })
      expect(capOf(labeled, A, 'argumenta').evidencias[0].cita).toContain('contar todas las cajas')
    })

    it('ignores labels for sentences that were not doubtful', () => {
      const report = buildCompetencyReport({ transcripts: doubt, participants: [A, B], problem, labels: { '9.9': 'traduce' } })
      expect(capOf(report, A, 'traduce').estado).toBe('sin evidencia suficiente')
    })

    it('caps how many sentences are sent', () => {
      const many = Array.from({ length: 40 }, (_, i) => tr(i % 2 ? A : B, i, `frase larga numero ${i} que nadie clasifica por reglas aqui`))
      const found = doubtfulSentences({ transcripts: many, studentKeys: [A, B] })
      expect(found.length).toBeLessThanOrEqual(12) // 6 por estudiante
    })
  })

  it('is deterministic and does not mutate its input', () => {
    const copy = structuredClone(conversation)
    expect(build()).toEqual(build())
    expect(conversation).toEqual(copy)
  })

  it('handles an empty session', () => {
    const report = buildCompetencyReport({})
    expect(report.estudiantes).toEqual([])
    expect(report.problema).toBeNull()
  })
})

describe('namesOperation', () => {
  it.each([
    ['seis por ocho', true],
    ['6 x 8', true],
    ['sumar 8 seis veces', true],
    ['6+8', true],
    ['seis cajas con ocho lapices', false],
    ['por favor', false],
    ['hay mas de uno', false],
  ])('%s -> %s', (text, expected) => {
    expect(namesOperation(text)).toBe(expected)
  })
})

describe('shorten', () => {
  it('cuts at a word boundary and adds an ellipsis', () => {
    expect(shorten('uno dos tres cuatro cinco', 14)).toBe('uno dos tres…')
    expect(shorten('corto')).toBe('corto')
  })
})

import { describe, expect, it } from 'vitest'
import { buildCompetencyReport } from './competencyEvidence.js'
import { memoryTextOf } from './memoryText.js'

const cap = (id, estado) => ({ id, estado, evidencias: [], señales: [] })
const student = (talkPct, { traduce = 'sin evidencia suficiente', estrategias = 'sin evidencia suficiente', argumenta = 'sin evidencia suficiente' } = {}) => ({
  key: 'estudiante a',
  resumen: { talkPct, talkSec: 10, turns: 3, estimated: false },
  capacidades: [cap('traduce', traduce), cap('comunica', 'con evidencia'), cap('usa-estrategias', estrategias), cap('argumenta', argumenta)],
})

describe('memoryTextOf', () => {
  it('produces the short factual sentence of the spec', () => {
    expect(memoryTextOf({ sessionId: 'accept-001', problem: { skillId: 'multiplication' }, student: student(28, { estrategias: 'con evidencia' }) })).toBe(
      'Sesión accept-001, multiplicación: comunicó 28% del tiempo; usó estrategia correcta; sin evidencia de argumentación.',
    )
  })

  it('describes partial and full evidence in every capability', () => {
    const text = memoryTextOf({
      sessionId: 's2',
      problem: { skillId: 'division' },
      student: student(60, { traduce: 'con evidencia', estrategias: 'evidencia parcial', argumenta: 'evidencia parcial' }),
    })
    expect(text).toBe('Sesión s2, división: comunicó 60% del tiempo; intentó una estrategia sin llegar al resultado; planteó la operación con números; argumentó en parte.')
  })

  it('falls back to "matemática" for an unknown or missing skill', () => {
    expect(memoryTextOf({ sessionId: 's', problem: { skillId: 'algebra' }, student: student(0) })).toMatch(/^Sesión s, matemática:/)
    expect(memoryTextOf({ sessionId: 's', student: student(0) })).toMatch(/^Sesión s, matemática:/)
  })

  it('never carries a name, a quote, a transcript or the expected answer, and stays short', () => {
    const report = buildCompetencyReport({
      transcripts: [
        { k: 'ana torres', t: 10, e: 12, x: 'son cuarenta y ocho porque seis veces ocho' },
        { k: 'luis', t: 14, e: 16, x: 'yo puse cuarenta y seis' },
      ],
      totals: [{ k: 'ana torres', sec: 20, turns: 3 }, { k: 'luis', sec: 5, turns: 1 }],
      problem: { activityId: 'p-01', skillId: 'multiplication', text: 'x', expectedAnswer: 48 },
    })
    for (const s of report.estudiantes) {
      const text = memoryTextOf({ sessionId: 'accept-001', problem: report.problema, student: s })
      expect(text).not.toMatch(/ana|torres|luis|cuarenta|48|porque|puse/i)
      expect(text.length).toBeLessThan(200)
      expect(text.endsWith('.')).toBe(true)
    }
  })
})

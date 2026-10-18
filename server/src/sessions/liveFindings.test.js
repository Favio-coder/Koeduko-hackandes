import { describe, expect, it, vi } from 'vitest'
import { closeSession } from './closeSession.js'
import { buildCompetencyReport } from './core/competencyEvidence.js'
import { SYSTEM_INSTRUCTION } from './core/interventionPolicy.js'
import { GeminiError } from './adapters/gemini.js'

// Hallazgos de la primera prueba real en Meet (accept-live-1, 18-oct-2026), convertidos en tests.

const problem = { activityId: 'p-01', skillId: 'multiplication', text: 'Hay 6 cajas con 8 lápices cada una.', expectedAnswer: 48 }

describe('el reporte no toma como "dificultad" una frase que ademas responde', () => {
  const transcripts = [
    { k: 'jayo', t: 43, e: 46, x: 'Hay seis cajas con ocho lapiceros. ¿Cuánto lapiceros?' },
    { k: 'jayo', t: 47, e: 50, x: 'No entiendo cómo se hace, de hecho, así no entiendo.' },
    { k: 'jayo', t: 91, e: 93, x: 'No sé. Es cuarenta y ocho' },
  ]
  const report = buildCompetencyReport({ transcripts, participants: ['jayo'], problem, totals: [{ k: 'jayo', sec: 20, turns: 3 }] })
  const traduce = report.estudiantes[0].capacidades.find((c) => c.id === 'traduce')

  it('cites only the real confusion, not the sentence where the student already answered', () => {
    expect(traduce.evidencias.map((e) => e.cita)).toEqual(['No entiendo cómo se hace, de hecho, así no entiendo.'])
    expect(traduce.nota).toBe('Mostró dificultad al plantear el problema.')
  })

  it('still counts that sentence as the correct answer', () => {
    const strategies = report.estudiantes[0].capacidades.find((c) => c.id === 'usa-estrategias')
    expect(strategies.estado).toBe('con evidencia')
    expect(strategies.evidencias[0].cita).toBe('No sé. Es cuarenta y ocho')
  })
})

describe('el tutor no felicita ni evalua', () => {
  it('the instruction forbids praise, because praising after an answer confirms or denies it', () => {
    expect(SYSTEM_INSTRUCTION).toMatch(/No evalúes ni felicites/)
    expect(SYSTEM_INSTRUCTION).toMatch(/buen trabajo/)
    expect(SYSTEM_INSTRUCTION).toMatch(/Solo pregunta/)
  })
})

describe('el cierre registra el codigo HTTP cuando Gemini falla (antes solo decia "http")', () => {
  const session = { createdBy: 'd', status: 'scheduled', currentProblem: { activityId: 'p-01', skillId: 'multiplication', text: 't' } }
  const state = { lastT: 100, presence: [{ k: 'jayo', s: 0 }], totals: [{ k: 'jayo', sec: 10, turns: 2 }], students: [], answer: { id: 'p-01', v: 48 } }
  const transcripts = [{ k: 'jayo', t: 10, e: 12, x: 'creo que primero hay que contar todas las cajas que tenemos aqui' }]

  async function closeWith(generate) {
    const store = {
      getSession: vi.fn().mockResolvedValue(session),
      getLiveState: vi.fn().mockResolvedValue(state),
      getTranscripts: vi.fn().mockResolvedValue(transcripts),
      getAnswer: vi.fn().mockResolvedValue(null),
      getSummary: vi.fn().mockResolvedValue(null),
      saveClosure: vi.fn().mockResolvedValue(undefined),
    }
    return closeSession({ sessionId: 's1', store, generate, memory: null, leaveBot: null, logger: { info: vi.fn() } })
  }

  it.each([
    [new GeminiError('http', 'x', { status: 400 }), 'failed:http:400'],
    [new GeminiError('http', 'x', { status: 429 }), 'failed:http:429'],
    [new GeminiError('timeout', 'x'), 'failed:timeout'],
    [Object.assign(new Error('x'), { name: 'TimeoutError' }), 'failed:timeout'],
  ])('%#: %s', async (error, expected) => {
    const result = await closeWith(vi.fn().mockRejectedValue(error))
    expect(result.steps.classifier).toBe(expected)
  })

  it('does not put the message, the prompt or the key in the step', async () => {
    const result = await closeWith(vi.fn().mockRejectedValue(new GeminiError('http', 'secreto-en-el-mensaje', { status: 400 })))
    expect(JSON.stringify(result.steps)).not.toContain('secreto')
  })
})

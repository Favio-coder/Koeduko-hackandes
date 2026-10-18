import { describe, expect, it } from 'vitest'
import { memoryQueryOf, memoryTextOf } from './memoryText.js'

const problem = { skillId: 'multiplication', text: 'Hay 6 cajas con 8 lápices cada una. ¿Cuántos lápices hay en total?', expectedAnswer: 48 }

describe('memoryQueryOf: the question speaks the same language as the note that was saved', () => {
  it('asks about performance in the skill, not about the statement of the problem', () => {
    const query = memoryQueryOf(problem)
    expect(query).toContain('multiplicación')
    expect(query).toMatch(/comunicación/i)
    expect(query).toMatch(/estrategia/i)
    expect(query).toMatch(/argumentación/i)
  })

  it('never includes the statement or the expected answer', () => {
    const query = memoryQueryOf(problem)
    expect(query).not.toMatch(/cajas|lápices|48|cuarenta/i)
  })

  it('shares its vocabulary with the saved note (it is what the semantic search matches on)', () => {
    const note = memoryTextOf({
      sessionId: 's1',
      problem,
      student: {
        resumen: { talkPct: 100 },
        capacidades: [
          { id: 'traduce', estado: 'evidencia parcial' },
          { id: 'usa-estrategias', estado: 'con evidencia' },
          { id: 'argumenta', estado: 'sin evidencia suficiente' },
        ],
      },
    }).toLowerCase()
    const query = memoryQueryOf(problem).toLowerCase()
    for (const word of ['multiplicación', 'estrategia', 'argumentación', 'operación']) {
      expect(note).toContain(word)
      expect(query).toContain(word)
    }
  })

  it('falls back to "matemática" without a problem or for an unknown skill', () => {
    expect(memoryQueryOf(null)).toContain('matemática')
    expect(memoryQueryOf()).toContain('matemática')
    expect(memoryQueryOf({ skillId: 'algebra' })).toContain('matemática')
  })

  it('is deterministic', () => {
    expect(memoryQueryOf(problem)).toBe(memoryQueryOf({ ...problem }))
  })
})

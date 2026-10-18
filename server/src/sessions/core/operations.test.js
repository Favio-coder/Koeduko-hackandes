import { describe, expect, it } from 'vitest'
import { answerNumbersOf } from './signals.js'
import { namesOperation, resultPartOf } from './operations.js'

describe('namesOperation', () => {
  it.each([
    ['seis por ocho', true],
    ['6 x 8', true],
    ['sumar 8 seis veces', true],
    ['6+8', true],
    ['seis cajas con ocho lapices', false],
    ['por favor', false],
    ['hay mas de uno', false],
    ['', false],
  ])('%s -> %s', (text, expected) => {
    expect(namesOperation(text)).toBe(expected)
  })
})

describe('resultPartOf', () => {
  it.each([
    ['seis por ocho son cuarenta y ocho', 'cuarenta y ocho'],
    ['6 x 8 = 48', '48'],
    ['seis por ocho es cuarenta y ocho metros', 'cuarenta y ocho metros'],
    ['seis por ocho', null],
    ['', null],
  ])('%s -> %s', (text, expected) => {
    expect(resultPartOf(text)).toBe(expected)
  })
})

describe('answerNumbersOf: naming an operation is not answering', () => {
  it('does not take the operands of "seis por ocho" as an answer', () => {
    expect(answerNumbersOf('Entonces seis por ocho')).toEqual([])
    expect(answerNumbersOf('hay que hacer 6 x 8')).toEqual([])
    expect(answerNumbersOf('o sumar ocho seis veces')).toEqual([])
  })

  it('still takes the result announced after the operation', () => {
    expect(answerNumbersOf('seis por ocho son cuarenta y ocho')).toEqual([48])
    expect(answerNumbersOf('6 x 8 = 48')).toEqual([48])
  })

  it('keeps answering plain numbers as before', () => {
    expect(answerNumbersOf('son cuarenta y ocho')).toEqual([48])
    expect(answerNumbersOf('Dos.')).toEqual([2])
  })
})

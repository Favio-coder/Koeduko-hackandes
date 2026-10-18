import { describe, expect, it } from 'vitest'
import { extractNumbers, scanNumbers } from './spanishNumbers.js'

describe('extractNumbers: digits', () => {
  it('reads integers, decimals with comma or dot, and thousands separators', () => {
    expect(extractNumbers('son 48')).toEqual([48])
    expect(extractNumbers('3,5')).toEqual([3.5])
    expect(extractNumbers('sale 3.5 exacto')).toEqual([3.5])
    expect(extractNumbers('1.000')).toEqual([1000])
    expect(extractNumbers('12 y 15')).toEqual([12, 15])
  })

  it('returns an empty list when there is no number', () => {
    expect(extractNumbers('no entiendo nada')).toEqual([])
    expect(extractNumbers('')).toEqual([])
    expect(extractNumbers(null)).toEqual([])
  })
})

describe('extractNumbers: Spanish words from 0 to 1000', () => {
  it.each([
    ['cero', 0], ['uno', 1], ['dos', 2], ['nueve', 9],
    ['diez', 10], ['once', 11], ['doce', 12], ['quince', 15], ['diecinueve', 19],
    ['veinte', 20], ['veintiuno', 21], ['veintiún', 21], ['veintidós', 22], ['veintinueve', 29],
    ['treinta', 30], ['cuarenta', 40], ['noventa', 90],
    ['treinta y uno', 31], ['treinta y un', 31], ['cuarenta y ocho', 48], ['noventa y nueve', 99],
    ['cien', 100], ['ciento uno', 101], ['ciento un', 101], ['ciento veinte', 120],
    ['ciento veintitrés', 123], ['ciento cuarenta y ocho', 148],
    ['doscientos', 200], ['doscientas cinco', 205], ['trescientos cincuenta', 350],
    ['quinientos', 500], ['setecientos cuarenta y cinco', 745], ['novecientos noventa y nueve', 999],
    ['mil', 1000],
  ])('%s -> %i', (words, value) => {
    expect(extractNumbers(words)).toEqual([value])
  })

  it('tolerates capitals, accents and surrounding words', () => {
    expect(extractNumbers('Creo que son CUARENTA Y OCHO.')).toEqual([48])
    expect(extractNumbers('Son Ciento Veinte, profe')).toEqual([120])
    expect(extractNumbers('dieciséis')).toEqual([16])
    expect(extractNumbers('¿Serán veintitrés?')).toEqual([23])
  })

  it('reads the same value in digits and in words', () => {
    expect(extractNumbers('son 48')).toEqual(extractNumbers('son cuarenta y ocho'))
    expect(extractNumbers('120')).toEqual(extractNumbers('ciento veinte'))
  })

  it('reads several numbers in order, mixing digits and words', () => {
    expect(extractNumbers('son 48 o cuarenta y nueve')).toEqual([48, 49])
    expect(extractNumbers('doce y quince')).toEqual([12, 15])
    expect(extractNumbers('cero cinco')).toEqual([0, 5])
  })

  it('does not treat articles as numbers', () => {
    expect(extractNumbers('deme un minuto')).toEqual([])
    expect(extractNumbers('una pregunta')).toEqual([])
  })

  it('does not break on a dangling "y" or on object property names', () => {
    expect(extractNumbers('cuarenta y')).toEqual([40])
    expect(extractNumbers('constructor toString valueOf')).toEqual([])
  })

  it('keeps a noise word that happens to be a number (documented limit)', () => {
    expect(extractNumbers('las dos personas')).toEqual([2])
  })
})

describe('scanNumbers', () => {
  it('returns the words that were not numbers', () => {
    expect(scanNumbers('creo que son cuarenta y ocho')).toMatchObject({ numbers: [48], words: ['creo', 'que', 'son'] })
  })

  it('keeps the order of numbers and words so a marker can be tied to its number', () => {
    expect(scanNumbers('son 48 pesos').items).toEqual([{ word: 'son' }, { number: 48 }, { word: 'pesos' }])
  })
})

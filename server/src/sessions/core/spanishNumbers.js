/**
 * Extrae numeros de un texto en espanol: digitos y numeros escritos con palabras (0 a 1000).
 * Puro. Tolera mayusculas y tildes ("Veintidos", "DIECISÉIS").
 *
 * Limites documentados:
 * - Solo 0 a 1000 en palabras ("dos mil" no se interpreta como 2000).
 * - "un" y "una" sueltos son articulos y no cuentan ("un minuto" -> []); si cuentan dentro de
 *   un compuesto ("treinta y un", "veintiun", "ciento un").
 * - Dos numeros pegados sin "y" son dos numeros: "cero cinco" -> [0, 5].
 * - Con digitos, "1.000" es mil (separador de miles) y "3,5" o "3.5" es 3.5.
 */

import { foldText } from './text.js'

const UNITS = { cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 }

const TEENS = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiuno: 21, veintiun: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}

const TENS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }

const HUNDREDS = {
  cien: 100, ciento: 100,
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
}

const ONE_FORMS = new Set(['un', 'una'])

// Digitos con separador de miles ("1.000"), decimales ("3,5") o enteros, y palabras.
const TOKEN = /\d{1,3}(?:\.\d{3})+(?!\d)|\d+(?:[.,]\d+)?|[a-z]+/g

function tokenize(text) {
  return [...foldText(text).matchAll(TOKEN)].map(([raw]) => {
    if (/^\d/.test(raw)) {
      const value = /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? Number(raw.replaceAll('.', '')) : Number(raw.replace(',', '.'))
      return { kind: 'num', value }
    }
    return { kind: 'word', word: raw }
  })
}

const wordAt = (tokens, i) => (tokens[i]?.kind === 'word' ? tokens[i].word : null)

/** Unidad 1-9 (o "un"/"una") en la posicion i, si existe. */
function unitAt(tokens, i) {
  const word = wordAt(tokens, i)
  if (word === null) return null
  if (ONE_FORMS.has(word)) return 1
  return UNITS[word] > 0 ? UNITS[word] : null
}

/** 0-99 empezando en i. Devuelve { value, next } o null. */
function belowHundred(tokens, i, allowZero) {
  const word = wordAt(tokens, i)
  if (word === null) return null

  if (Object.hasOwn(TENS, word)) {
    if (wordAt(tokens, i + 1) === 'y') {
      const unit = unitAt(tokens, i + 2)
      if (unit !== null) return { value: TENS[word] + unit, next: i + 3 }
    }
    return { value: TENS[word], next: i + 1 }
  }
  if (Object.hasOwn(TEENS, word)) return { value: TEENS[word], next: i + 1 }
  if (Object.hasOwn(UNITS, word)) return word === 'cero' && !allowZero ? null : { value: UNITS[word], next: i + 1 }
  return null
}

/** Numero en palabras empezando en i. Devuelve { value, next } o null. */
function wordNumberAt(tokens, i) {
  const word = wordAt(tokens, i)
  if (word === null) return null
  if (word === 'mil') return { value: 1000, next: i + 1 }

  if (Object.hasOwn(HUNDREDS, word)) {
    const hundreds = HUNDREDS[word]
    const rest = belowHundred(tokens, i + 1, false)
    if (rest) return { value: hundreds + rest.value, next: rest.next }
    if (ONE_FORMS.has(wordAt(tokens, i + 1))) return { value: hundreds + 1, next: i + 2 }
    return { value: hundreds, next: i + 1 }
  }
  return belowHundred(tokens, i, true)
}

/**
 * Recorre el texto y devuelve los numeros en orden, las palabras que no eran numeros y la
 * secuencia completa (items) para saber que palabra va pegada a cada numero.
 *
 * @returns {{ numbers: number[], words: string[], items: ({ number: number } | { word: string })[] }}
 */
export function scanNumbers(text) {
  const tokens = tokenize(text)
  const numbers = []
  const words = []
  const items = []
  let i = 0
  while (i < tokens.length) {
    if (tokens[i].kind === 'num') {
      numbers.push(tokens[i].value)
      items.push({ number: tokens[i].value })
      i += 1
      continue
    }
    const found = wordNumberAt(tokens, i)
    if (found) {
      numbers.push(found.value)
      items.push({ number: found.value })
      i = found.next
    } else {
      words.push(tokens[i].word)
      items.push({ word: tokens[i].word })
      i += 1
    }
  }
  return { numbers, words, items }
}

/** "son 48" -> [48]; "son cuarenta y ocho" -> [48]; "3,5" -> [3.5]; "un minuto" -> []. */
export function extractNumbers(text) {
  return scanNumbers(text).numbers
}

/**
 * Detecta cuando una frase NOMBRA una operacion con numeros ("seis por ocho", "6 x 8", "sumar 8 seis
 * veces") y separa el resultado de los operandos. Pura.
 *
 * Por que importa: "entonces seis por ocho" no responde nada; 6 y 8 son los datos de la operacion.
 * Sin esta distincion el motor tomaba los operandos como una respuesta equivocada.
 */

import { extractNumbers } from './spanishNumbers.js'

const OPERATION_WORDS = /\b(por|x|veces|multiplic\w*|mas|menos|entre|dividid\w*|dividir|sum\w*|rest\w*)\b/
const OPERATION_SYMBOLS = /\d\s*[x×*+\-/÷]\s*\d/
/** Lo que anuncia el resultado: "= 48", "es 48", "son 48", "da 48", "sale 48"... */
const RESULT_MARKER = /=|\b(es|son|da|sale|seria|igual|resulta|queda|dio|salio)\b/g

/** true si la frase (ya sin tildes ni mayusculas) nombra una operacion con al menos dos numeros. */
export function namesOperation(folded) {
  if (!folded || extractNumbers(folded).length < 2) return false
  return OPERATION_WORDS.test(folded) || OPERATION_SYMBOLS.test(folded)
}

/**
 * Lo que viene despues del ultimo anuncio de resultado ("seis por ocho es cuarenta y ocho" ->
 * "cuarenta y ocho"), o null si la frase no anuncia ninguno.
 */
export function resultPartOf(folded) {
  let last = null
  for (const match of String(folded ?? '').matchAll(RESULT_MARKER)) last = match
  if (!last) return null
  const rest = folded.slice(last.index + last[0].length).trim()
  return rest || null
}

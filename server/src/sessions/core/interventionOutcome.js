/**
 * Que paso despues de cada intervencion del tutor. Pura: sin reloj, sin red.
 *
 * Es la senal con la que el tutor aprende: sin saber si una intervencion sirvio, repetir lo que hizo no es aprender.
 * Se mira una ventana corta (OUTCOME_WINDOW_SEC) despues de la intervencion y solo lo que dijo la gente, nunca el bot.
 * Un resultado es una medida simple y explicable, no un juicio sobre el nino:
 *  - WRONG_ANSWER / STUCK: mejoro si el destinatario dio la respuesta esperada o planteo una operacion (STUCK tambien si
 *    hablo sin confusion); si no, no cambio.
 *  - SILENT_PEER: mejoro si el destinatario hablo (>= MIN_WORDS palabras).
 *  - DOMINANCE: mejoro si habló otra persona (>= MIN_WORDS palabras).
 *  - CORRECT_ANSWER: mejoro si hubo una explicacion (>= EXPLAIN_WORDS palabras) del destinatario u otra persona.
 *  - Senales de grupo (sin destinatario): unknown, no se aprende nada de ellas.
 */

import { namesOperation } from './operations.js'
import { answerNumbersOf, countConfusionMarkers } from './signals.js'
import { foldText } from './text.js'

export const OUTCOME_WINDOW_SEC = 60
export const MIN_WORDS = 6
export const EXPLAIN_WORDS = 8

export const OUTCOME = Object.freeze({ IMPROVED: 'improved', NO_CHANGE: 'no-change', UNKNOWN: 'unknown' })

const wordsOf = (text) => String(text ?? '').split(/\s+/).filter(Boolean).length

/**
 * @param {{
 *   interventions: { id?: string, signal?: string, participantKey?: string|null, t?: number, style?: string|null }[],
 *   transcripts: { k: string, t: number, x: string }[],
 *   problem?: { expectedAnswer?: number }|null,
 *   windowSec?: number,
 * }} input
 * @returns {{ id: string|null, signal: string, key: string|null, style: string|null, outcome: string }[]}
 */
export function outcomesOf({ interventions = [], transcripts = [], problem = null, windowSec = OUTCOME_WINDOW_SEC }) {
  const expected = Number.isFinite(problem?.expectedAnswer) ? problem.expectedAnswer : null

  return interventions.map((intervention) => {
    const key = intervention.participantKey ?? null
    const base = { id: intervention.id ?? null, signal: intervention.signal ?? '', key, style: intervention.style ?? null }
    if (!key || !Number.isFinite(intervention.t)) return { ...base, outcome: OUTCOME.UNKNOWN }

    const after = transcripts.filter((tr) => tr.t > intervention.t && tr.t <= intervention.t + windowSec)
    const mine = after.filter((tr) => tr.k === key)
    const others = after.filter((tr) => tr.k !== key)
    const mineWords = mine.reduce((sum, tr) => sum + wordsOf(tr.x), 0)
    const othersWords = others.reduce((sum, tr) => sum + wordsOf(tr.x), 0)
    const gaveAnswer = expected !== null && mine.some((tr) => answerNumbersOf(tr.x).some((n) => Math.abs(n - expected) < 1e-9))
    const planned = mine.some((tr) => namesOperation(foldText(tr.x)))

    let improved
    switch (base.signal) {
      case 'WRONG_ANSWER':
        improved = gaveAnswer || planned
        break
      case 'STUCK':
        improved = gaveAnswer || planned || (mineWords >= MIN_WORDS && mine.every((tr) => countConfusionMarkers(tr.x) === 0))
        break
      case 'SILENT_PEER':
        improved = mineWords >= MIN_WORDS
        break
      case 'DOMINANCE':
        improved = othersWords >= MIN_WORDS
        break
      case 'CORRECT_ANSWER':
        improved = mineWords + othersWords >= EXPLAIN_WORDS
        break
      default:
        return { ...base, outcome: OUTCOME.UNKNOWN }
    }
    return { ...base, outcome: improved ? OUTCOME.IMPROVED : OUTCOME.NO_CHANGE }
  })
}

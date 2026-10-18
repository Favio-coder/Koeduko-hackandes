/**
 * Evidencia por competencias a partir de lo que paso en una sesion. PURA: sin red, sin reloj, sin Firebase.
 *
 * Es evidencia FORMATIVA: dice que se observo, con citas textuales y su segundo, y NUNCA asigna una nota
 * (AD/A/B/C). La calificacion es del docente. Detecta por reglas; si una frase queda dudosa se puede
 * pedir a un clasificador (Gemini) que la etiquete, pero su etiqueta solo da "evidencia parcial":
 * nunca alcanza por si sola para "con evidencia".
 */

import { CAPABILITIES, CAPABILITY_IDS, COMPETENCY, EVIDENCE_STATE, FORMATIVE_NOTE } from './competencies.js'
import { displayName } from './interventionPolicy.js'
import { namesOperation } from './operations.js'
import { answerNumbersOf, countConfusionMarkers, sentencesOf } from './signals.js'
import { extractNumbers } from './spanishNumbers.js'

export const REPORT_VERSION = 1

export const THRESHOLDS = Object.freeze({
  /** "Comunica": con evidencia si habla al menos esta fraccion de su parte justa (1 / n) ... */
  fairShareFactor: 0.6,
  /** ... y tuvo al menos estos turnos. */
  minTurns: 3,
  maxQuotes: 2,
  quoteChars: 120,
  /** Frases dudosas que se le pueden pedir al clasificador. */
  doubtfulMinWords: 6,
  doubtfulPerStudent: 6,
  doubtfulTotal: 20,
})

const EPS = 1e-9
const round1 = (value) => Math.round(value * 10) / 10

const JUSTIFICATION = /\b(porque|ya que|puesto que|debido a|por eso|por lo tanto)\b|\bsi (hay|tengo|tiene|cada|son)\b.*\bentonces\b|\bcomo (hay|tengo|cada)\b/

export { namesOperation }

const justifies = (folded) => JUSTIFICATION.test(folded)
const hasNumbers = (folded) => extractNumbers(folded).length > 0

/** Cita corta, cortada en limite de palabra. */
export function shorten(text, max = THRESHOLDS.quoteChars) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2))}…`
}

const quoteOf = (entry) => ({ t: round1(entry.t), cita: shorten(entry.x) })

function pickQuotes(entries, max = THRESHOLDS.maxQuotes) {
  const seen = new Set()
  const unique = entries.filter((entry) => !seen.has(entry.index) && seen.add(entry.index))
  return unique.slice(0, max).map(quoteOf)
}

/** Solo transcripciones validas, en orden de tiempo: la base de TODO lo demas (ids de frase incluidos). */
const prepare = (transcripts) => [...transcripts].filter((tr) => Number.isFinite(tr?.t) && typeof tr.x === 'string').sort((a, b) => a.t - b.t)

/** Quienes aparecen en el reporte: presentes, quienes hablaron y quienes tienen habla acumulada. */
export const participantKeysOf = ({ transcripts = [], totals = null, participants = [] }) =>
  [...new Set([...participants, ...prepare(transcripts).map((tr) => tr.k), ...(totals ?? []).map((t) => t.k)])].sort()

/** Etiqueta cada frase de cada transcripcion: que nombra, si justifica, si responde, si confunde. */
function annotate(transcripts) {
  return transcripts.map((tr, index) => {
    const sentences = sentencesOf(tr.x).map((sentence, s) => ({
      id: `${index}.${s}`,
      text: sentence.text,
      question: sentence.question,
      operation: namesOperation(sentence.text),
      justification: !sentence.question && justifies(sentence.text),
      answers: answerNumbersOf(sentence.text),
    }))
    return { ...tr, index, sentences, answers: answerNumbersOf(tr.x), confusion: countConfusionMarkers(tr.x) > 0 }
  })
}

/**
 * Frases que ninguna regla pudo clasificar y que valen la pena preguntar: afirmaciones largas de un
 * estudiante. Se acota su cantidad (costo y latencia de Gemini).
 *
 * @returns {{ id: string, k: string, t: number, text: string }[]}
 */
export function doubtfulSentences({ transcripts, studentKeys }) {
  const keys = new Set(studentKeys)
  const perStudent = new Map()
  const found = []
  for (const tr of annotate(prepare(transcripts))) {
    if (!keys.has(tr.k)) continue
    for (const sentence of tr.sentences) {
      const words = sentence.text.split(/\s+/).filter(Boolean)
      const ruled = sentence.operation || sentence.justification || sentence.answers.length > 0 || countConfusionMarkers(sentence.text) > 0
      if (sentence.question || ruled || words.length < THRESHOLDS.doubtfulMinWords) continue
      if ((perStudent.get(tr.k) ?? 0) >= THRESHOLDS.doubtfulPerStudent) continue
      perStudent.set(tr.k, (perStudent.get(tr.k) ?? 0) + 1)
      found.push({ id: sentence.id, k: tr.k, t: round1(tr.t), text: shorten(tr.x) })
    }
  }
  return found.slice(0, THRESHOLDS.doubtfulTotal)
}

function stateFor({ strong = 0, weak = 0, strongNeeded = 1 }) {
  if (strong >= strongNeeded) return EVIDENCE_STATE.WITH
  if (strong > 0 || weak > 0) return EVIDENCE_STATE.PARTIAL
  return EVIDENCE_STATE.NONE
}

const capability = (id, estado, evidencias, señales, nota) => ({
  id,
  nombre: CAPABILITIES.find((c) => c.id === id).nombre,
  estado,
  evidencias,
  señales,
  ...(nota ? { nota } : {}),
})

/**
 * Arma el reporte de la sesion.
 *
 * @param {{
 *   transcripts: { k: string, t: number, e?: number, x: string }[],       // todas, de toda la sesion
 *   totals?: { k: string, sec: number, turns: number }[]|null,            // habla acumulada (live/state); si falta, se estima
 *   participants?: string[],                                             // quienes estuvieron (presencia)
 *   students?: { k: string, id: string }[],
 *   problem?: { activityId: string, skillId: string, text: string, expectedAnswer: number, startedAtT?: number }|null,
 *   durationSec?: number,
 *   labels?: Record<string, 'traduce'|'argumenta'>,                      // etiquetas del clasificador, por id de frase
 * }} input
 */
export function buildCompetencyReport({ transcripts = [], totals = null, participants = [], students = [], problem = null, durationSec = 0, labels = {} }) {
  const sorted = prepare(transcripts)
  const annotated = annotate(sorted)

  const keys = participantKeysOf({ transcripts, totals, participants })
  const estimated = !Array.isArray(totals) || totals.length === 0
  const talk = Object.fromEntries(
    keys.map((key) => {
      const known = totals?.find((t) => t.k === key)
      const mine = annotated.filter((tr) => tr.k === key)
      const sec = known ? known.sec : mine.reduce((sum, tr) => sum + Math.max(0, (tr.e ?? tr.t) - tr.t), 0)
      return [key, { sec, turns: known ? known.turns : mine.length }]
    }),
  )
  const totalSec = keys.reduce((sum, key) => sum + talk[key].sec, 0)
  const fairShare = keys.length > 0 ? 1 / keys.length : 1

  // Respuestas: las evalua igual que el tutor en vivo, pero sobre toda la sesion.
  const hasAnswer = problem && Number.isFinite(problem.expectedAnswer)
  const startedAt = Number.isFinite(problem?.startedAtT) ? problem.startedAtT : -Infinity
  const answerEntries = hasAnswer ? annotated.filter((tr) => tr.t >= startedAt && tr.answers.length > 0) : []
  const isCorrect = (tr) => tr.answers.some((n) => Math.abs(n - problem.expectedAnswer) < EPS)
  const firstAnswerT = answerEntries.length > 0 ? answerEntries[0].t : null

  const doubtful = doubtfulSentences({ transcripts: sorted, studentKeys: keys })
  const asEntries = (list) => list.map((d) => ({ index: `d${d.id}`, t: d.t, x: d.text }))

  const estudiantes = keys.map((key) => {
    const mine = annotated.filter((tr) => tr.k === key)
    const { sec, turns } = talk[key]
    const share = totalSec > 0 ? sec / totalSec : 0

    // 2. Comunica: cuanto y cuantas veces tomo la palabra.
    const communicates =
      share >= fairShare * THRESHOLDS.fairShareFactor && turns >= THRESHOLDS.minTurns
        ? EVIDENCE_STATE.WITH
        : sec > 0 || turns > 0 || mine.length > 0
          ? EVIDENCE_STATE.PARTIAL
          : EVIDENCE_STATE.NONE
    const wordy = mine
      .filter((tr) => tr.x.trim().split(/\s+/).length >= 4)
      .sort((a, b) => b.x.length - a.x.length)
      .slice(0, THRESHOLDS.maxQuotes)
      .sort((a, b) => a.t - b.t)
    const talkSignals = []
    if (keys.length >= 2 && share >= 0.75) talkSignals.push('DOMINANCE')
    if (keys.length >= 2 && communicates === EVIDENCE_STATE.NONE) talkSignals.push('SILENT_PEER')

    // 3. Usa estrategias: lo que respondio.
    const mineAnswers = answerEntries.filter((tr) => tr.k === key)
    const correct = mineAnswers.filter(isCorrect)
    const wrong = mineAnswers.filter((tr) => !isCorrect(tr))
    const strategies = correct.length > 0 ? EVIDENCE_STATE.WITH : wrong.length > 0 ? EVIDENCE_STATE.PARTIAL : EVIDENCE_STATE.NONE

    // 1. Traduce: nombra una operacion con numeros; o se confundio al plantear el problema.
    const operations = mine.filter((tr) => tr.sentences.some((s) => s.operation))
    // Una frase que ademas RESPONDE ("No se. Es cuarenta y ocho") no es evidencia de dificultad para plantear: ya respondio.
    const stuck = mine.filter((tr) => tr.confusion && tr.answers.length === 0 && (firstAnswerT === null || tr.t <= firstAnswerT))
    const labeledTranslate = doubtful.filter((d) => d.k === key && labels[d.id] === CAPABILITY_IDS.TRADUCE)
    const translates = stateFor({ strong: operations.length, weak: stuck.length + labeledTranslate.length, strongNeeded: 2 })

    // 4. Argumenta: justifica, despues de una respuesta o con numeros/operaciones.
    const justifications = mine.filter((tr) =>
      tr.sentences.some((s) => s.justification && (firstAnswerT === null ? hasNumbers(s.text) || s.operation : tr.t >= firstAnswerT - 10)),
    )
    const strongJustifications = justifications.filter((tr) => tr.sentences.some((s) => s.justification && (hasNumbers(s.text) || s.operation)))
    const labeledArgue = doubtful.filter((d) => d.k === key && labels[d.id] === CAPABILITY_IDS.ARGUMENTA)
    const argues = stateFor({ strong: strongJustifications.length, weak: justifications.length + labeledArgue.length })

    return {
      key,
      name: displayName(key) ?? key,
      studentId: students.find((s) => s.k === key)?.id ?? null,
      resumen: { talkPct: Math.round(share * 100), talkSec: round1(sec), turns, estimated },
      capacidades: [
        capability(
          CAPABILITY_IDS.TRADUCE,
          translates,
          pickQuotes([...operations, ...(operations.length === 0 ? stuck : []), ...asEntries(labeledTranslate)]),
          [...(stuck.length > 0 ? ['STUCK'] : []), ...(operations.length > 0 ? ['OPERACION_CON_NUMEROS'] : []), ...(labeledTranslate.length > 0 ? ['CLASIFICADOR'] : [])],
          operations.length === 0 && stuck.length > 0 ? 'Mostró dificultad al plantear el problema.' : undefined,
        ),
        capability(CAPABILITY_IDS.COMUNICA, communicates, pickQuotes(wordy), talkSignals),
        capability(
          CAPABILITY_IDS.ESTRATEGIAS,
          strategies,
          pickQuotes([...correct, ...wrong]),
          [...(correct.length > 0 ? ['CORRECT_ANSWER'] : []), ...(wrong.length > 0 ? ['WRONG_ANSWER'] : [])],
        ),
        capability(
          CAPABILITY_IDS.ARGUMENTA,
          argues,
          pickQuotes([...strongJustifications, ...justifications, ...asEntries(labeledArgue)]),
          [...(justifications.length > 0 ? ['JUSTIFICACION'] : []), ...(labeledArgue.length > 0 ? ['CLASIFICADOR'] : [])],
        ),
      ],
    }
  })

  return {
    v: REPORT_VERSION,
    competencia: { ...COMPETENCY },
    nota: FORMATIVE_NOTE,
    problema: problem ? { activityId: problem.activityId, skillId: problem.skillId ?? null, text: problem.text ?? '' } : null,
    duracionSeg: round1(durationSec),
    estudiantes,
  }
}

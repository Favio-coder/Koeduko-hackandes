/**
 * Motor de senales de la sesion en vivo. Codigo PURO: sin Firebase, sin red, sin Date.now(),
 * sin Math.random(). El tiempo (`now`, en segundos relativos al inicio del bot) entra por parametro.
 *
 * Hay UNA sola implementacion, sobre el estado incremental (liveState.js). La API por arrays
 * (`detectSignals(events, now)`) pliega los eventos en un estado y llama a la misma funcion.
 *
 * Lo que se aprendio en la prueba real con Recall (ver server/README.md):
 * - speech_on/off es el HABLANTE ACTIVO, no el microfono de cada uno: dos personas nunca se
 *   solapan. El tiempo de habla se calcula con intervalos consecutivos.
 * - Quien entro (join) y nunca hablo cuenta con 0 % de habla.
 * - language_code de Recall no es fiable: este modulo no lo lee.
 */

import { foldText } from './text.js'
import { extractNumbers, scanNumbers } from './spanishNumbers.js'
import { eventTime, foldEvents, talkTimeFromState } from './liveState.js'

export { extractNumbers }

export const DEFAULT_CONFIG = Object.freeze({
  windowSec: 180, // ventana de analisis
  minSpeechInWindowSec: 45, // no evaluar dominancia con poca conversacion
  dominanceRatio: 0.7, // uno habla >= 70 % del tiempo hablado
  silentPeerRatio: 0.15, // uno habla <= 15 %
  minPresenceSec: 30, // para acusar de callado, debe llevar al menos esto en la sala
  groupSilenceSec: 40, // nadie habla durante 40 s
  stuckMarkersMin: 2, // >= 2 marcadores de confusion en la ventana
  cooldownSec: 90, // la misma senal no se repite antes de 90 s
  evalEverySec: 5, // como maximo una evaluacion de senales cada 5 s por sesion
  maxTranscripts: 15, // transcripciones que se conservan en el estado
  maxIntervals: 400, // tope de intervalos de habla en el estado
  maxInterventions: 30, // intervenciones recientes que se conservan en el estado
  botKeys: Object.freeze(['tutor koeduko']), // el bot nunca cuenta como participante
  // Senales apagadas. GROUP_SILENCE esta apagada: el silencio no genera eventos y el motor solo
  // corre cuando llega uno, asi que se detectaria recien cuando alguien vuelva a hablar. Necesita un
  // disparador periodico (interfaz o cron) que no existe aun. Para encenderla: disabledSignals: [].
  disabledSignals: Object.freeze(['GROUP_SILENCE']),
})

/**
 * Frases de confusion (sin tildes). "no se" lleva una guarda extra para no contar
 * "no se puede" (ver CONFUSION_PATTERNS).
 */
export const CONFUSION_MARKERS = Object.freeze([
  'no entiendo',
  'no se',
  'como se hace',
  'me perdi',
  'esta dificil',
  'ayuda',
])

const CONFUSION_PATTERNS = [
  /\bno entiendo\b/g,
  /\bno se(?=\s*(?:$|[.,;!?])|\s+(?:como|que|cual|cuanto|donde|quien|por que|si|nada|mucho|bien|hacer|resolver)\b)/g,
  /\bcomo se hace\b/g,
  /\bme perdi\b/g,
  /\besta dificil\b/g,
  /\bayuda\b/g,
]

/** De mayor a menor prioridad. */
export const SIGNAL_PRIORITY = Object.freeze([
  'WRONG_ANSWER',
  'STUCK',
  'SILENT_PEER',
  'GROUP_SILENCE',
  'DOMINANCE',
  'CORRECT_ANSWER',
])

const ANSWER_MARKERS = new Set(['da', 'es', 'son', 'sale', 'seria', 'igual', 'resulta', 'queda', 'respuesta', 'dio', 'salio'])
const FILLERS = new Set(['creo', 'que', 'pues', 'eh', 'este', 'ya', 'bueno', 'entonces', 'mmm', 'no', 'si', 'y', 'o', 'a', 'me', 'parece', 'yo', 'pienso', 'la', 'el'])

const EPS = 1e-9
const round = (value, decimals = 3) => Math.round(value * 10 ** decimals) / 10 ** decimals
const byPriorityThenKey = (a, b) =>
  SIGNAL_PRIORITY.indexOf(a.type) - SIGNAL_PRIORITY.indexOf(b.type) ||
  String(a.participantKey ?? '').localeCompare(String(b.participantKey ?? ''))

/**
 * Segundos de habla por participante dentro de [from, to]. Un speech_on sin cierre cuenta hasta `to`.
 *
 * @param {object[]} events
 * @param {{ from: number, to: number, participants?: string[] }} range  `participants` siembra ceros
 * @returns {Record<string, number>}
 */
export function computeTalkTime(events, { from, to, participants = [] }) {
  const cfg = { ...DEFAULT_CONFIG, windowSec: Infinity, maxIntervals: Infinity }
  const visible = events.filter((event) => Number.isFinite(event?.t) && eventTime(event) <= to + EPS)
  return talkTimeFromState(foldEvents(visible, cfg), { from, to, participants })
}

const studentIdOf = (state, key) => state.students.find((s) => s.k === key)?.id ?? null

/** Cuenta marcadores de confusion en un texto (sin tildes ni mayusculas). */
export function countConfusionMarkers(text) {
  const folded = foldText(text)
  return CONFUSION_PATTERNS.reduce((total, pattern) => total + (folded.match(pattern)?.length ?? 0), 0)
}

/**
 * Parte un texto en frases sin romper decimales ("3.5"). Marca las interrogativas: leer la
 * pregunta en voz alta ("¿cuanto son seis por ocho?") no es responderla.
 */
function sentencesOf(text) {
  const protectedText = foldText(text).replace(/(?<=\d)\.(?=\d)/g, '\u0001')
  return (protectedText.match(/[^.!?;\n]+[.!?;\n]*/g) ?? []).map((raw) => ({
    text: raw.replace(/[.!?;\n]+$/, '').replaceAll('\u0001', '.'),
    question: raw.includes('?') || raw.includes('¿'),
  }))
}

/**
 * Numeros que la persona da como RESPUESTA, frase por frase. Una frase cuenta si:
 * - tiene un "=" ; o
 * - un verbo de respuesta (son, es, da, sale...) pegado al numero (hasta 2 palabras antes); o
 * - casi no dice nada mas que el numero ("Dos.", "cuarenta y ocho metros").
 * Una frase interrogativa solo cuenta por la ultima condicion.
 * Asi "lo recomendable es que las dos personas hablen" no se confunde con responder 2.
 */
export function answerNumbersOf(text) {
  const answers = []
  for (const sentence of sentencesOf(text)) {
    const { numbers, words, items } = scanNumbers(sentence.text)
    if (numbers.length === 0) continue

    const meaningful = words.filter((word) => !FILLERS.has(word) && !ANSWER_MARKERS.has(word))
    if (meaningful.length <= 1) {
      answers.push(...numbers)
    } else if (!sentence.question && sentence.text.includes('=')) {
      answers.push(...numbers)
    } else if (!sentence.question) {
      items.forEach((item, i) => {
        if (item.number === undefined) return
        const before = items.slice(Math.max(0, i - 3), i).filter((x) => x.word !== undefined).slice(-2)
        if (before.some((x) => ANSWER_MARKERS.has(x.word))) answers.push(item.number)
      })
    }
  }
  return answers
}

function answerSignals(state, keys, from, problem, context) {
  if (!problem || !Number.isFinite(problem.expectedAnswer)) return []
  const startedAt = Number.isFinite(problem.startedAtT) ? problem.startedAtT : -Infinity
  const signals = []

  for (const key of keys) {
    const last = state.transcripts.filter((x) => x.k === key && x.t >= startedAt && x.e >= from).at(-1)
    const numbers = last ? answerNumbersOf(last.x) : []
    if (numbers.length === 0) continue

    const correct = numbers.some((n) => Math.abs(n - problem.expectedAnswer) < EPS)
    signals.push({
      type: correct ? 'CORRECT_ANSWER' : 'WRONG_ANSWER',
      participantKey: key,
      studentId: studentIdOf(state, key),
      t: last.e,
      evidence: { expectedAnswer: problem.expectedAnswer, numbers, ...context },
    })
  }
  return signals
}

/**
 * Detecta senales en el instante `now` a partir del estado incremental. No aplica cooldown ni
 * prioridad (eso es selectInterventions).
 *
 * @param {import('./liveState.js').LiveState} state
 * @param {number} now  segundos relativos al inicio del bot
 * @param {{ problem?: { activityId: string, skillId: string, text: string, expectedAnswer: number, startedAtT?: number }|null, config?: object }} [options]
 * @returns {object[]} senales; cada una lleva skillId y activityId en `evidence`
 */
export function detectSignalsFromState(state, now, { problem = null, config = {} } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const from = now - cfg.windowSec
  const context = { skillId: problem?.skillId ?? null, activityId: problem?.activityId ?? null }
  const keys = state.presence.map((p) => p.k).sort()
  const since = Object.fromEntries(state.presence.map((p) => [p.k, p.s]))
  const signals = []

  const talk = talkTimeFromState(state, { from, to: now, participants: keys })
  const total = keys.reduce((sum, key) => sum + talk[key], 0)
  const shares = Object.fromEntries(keys.map((key) => [key, total > 0 ? round(talk[key] / total) : 0]))

  if (keys.length >= 2 && total >= cfg.minSpeechInWindowSec - EPS) {
    for (const key of keys) {
      const presentSec = now - since[key]
      const base = { shares, totalSpeechSec: round(total, 1), windowSec: cfg.windowSec, ...context }
      if (talk[key] / total <= cfg.silentPeerRatio + EPS) {
        if (presentSec >= cfg.minPresenceSec) {
          signals.push({ type: 'SILENT_PEER', participantKey: key, studentId: studentIdOf(state, key), t: now, evidence: { ...base, presentSec: round(presentSec, 1) } })
        }
      } else if (talk[key] / total >= cfg.dominanceRatio - EPS) {
        signals.push({ type: 'DOMINANCE', participantKey: key, studentId: studentIdOf(state, key), t: now, evidence: base })
      }
    }
  }

  // GROUP_SILENCE: solo dice que dejaron de hablar. Nunca se interpreta como "no saben".
  if (keys.length >= 2 && !state.speaker && state.lastSpeechT !== null) {
    const silenceSec = now - state.lastSpeechT
    if (silenceSec >= cfg.groupSilenceSec - EPS) {
      signals.push({ type: 'GROUP_SILENCE', participantKey: null, studentId: null, t: now, evidence: { silenceSec: round(silenceSec, 1), lastSpeechT: round(state.lastSpeechT, 1), ...context } })
    }
  }

  // STUCK: solo por marcadores de confusion en lo que dijeron (no por silencio).
  const markers = state.transcripts.filter((x) => x.e >= from).reduce((sum, x) => sum + countConfusionMarkers(x.x), 0)
  if (markers >= cfg.stuckMarkersMin) {
    signals.push({ type: 'STUCK', participantKey: null, studentId: null, t: now, evidence: { markers, windowSec: cfg.windowSec, ...context } })
  }

  signals.push(...answerSignals(state, keys, from, problem, context))

  return signals.filter((signal) => !cfg.disabledSignals.includes(signal.type)).sort(byPriorityThenKey)
}

/**
 * Lo mismo que detectSignalsFromState, pero a partir de la lista de eventos ocurridos hasta `now`.
 * Sirve para tests, el reproductor de sesiones y la demo de respaldo.
 */
export function detectSignals(events, now, { problem = null, config = {} } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const visible = events.filter((event) => Number.isFinite(event?.t) && eventTime(event) <= now + EPS)
  return detectSignalsFromState(foldEvents(visible, cfg), now, { problem, config })
}

/**
 * Aplica cooldown y prioridad. Devuelve como maximo UNA senal.
 * `history`: intervenciones ya hechas ({ type, participantKey, t }), con t en los mismos segundos que `now`.
 * Cooldown: misma senal y mismo destinatario con t > now - cooldownSec se descarta.
 *
 * @returns {object[]} lista de 0 o 1 senal
 */
export function selectInterventions(signals, history, now, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const cooling = (signal) =>
    history.some(
      (past) =>
        past.type === signal.type &&
        (past.participantKey ?? null) === (signal.participantKey ?? null) &&
        past.t > now - cfg.cooldownSec,
    )

  return signals.filter((signal) => !cooling(signal)).sort(byPriorityThenKey).slice(0, 1)
}

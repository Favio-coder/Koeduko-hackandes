/**
 * Estado incremental de una sesion en vivo. Es lo MINIMO que necesita el motor de senales,
 * para poder evaluar sin releer liveEvents (la cuota gratuita de Firestore no lo permite):
 * cada evento cuesta 1 lectura + 1 escritura de este documento.
 *
 * Todo es puro: applyEvent(state, event) devuelve un estado nuevo y no muta el anterior.
 * Se guarda en learningSessions/{id}/live/state. Las listas son arrays (no mapas) para que
 * nombres de participante raros no se conviertan en nombres de campo de Firestore.
 */

export const STATE_VERSION = 1

/** Orden estable de eventos con el mismo instante: entra, deja de hablar, empieza, texto, sale. */
export const TYPE_ORDER = Object.freeze({ join: 0, speech_off: 1, speech_on: 2, transcript: 3, leave: 4 })

/** Momento en que el evento "ya paso": el transcript termina en tEnd. */
export const eventTime = (event) => (event.type === 'transcript' ? (event.tEnd ?? event.t) : event.t)

/**
 * @typedef {{
 *   v: number,
 *   lastT: number,                       // mayor tiempo de evento visto (s)
 *   lastEvalT: number|null,              // ultima evaluacion de senales (throttle)
 *   lastJudgeT: number|null,             // ultima vez que se le pidio al observador leer la conversacion (conversationJudge)
 *   lastSpeechT: number|null,            // fin del ultimo habla (para GROUP_SILENCE)
 *   speaker: { k: string, s: number }|null,           // hablante activo
 *   presence: { k: string, s: number }[],             // quien esta en la sala y desde cuando
 *   intervals: { k: string, s: number, e: number }[], // intervalos de habla dentro de la ventana
 *   transcripts: { id?: string, k: string, t: number, e: number, x: string }[],  // ultimas N
 *   students: { k: string, id: string }[],
 *   interventions: { type: string, k: string|null, t: number }[],  // ultimas intervenciones
 *   problem: { id: string, startedT: number }|null,   // problema actual y desde cuando
 *   answer: { id: string, v: number|null }|null,      // respuesta esperada del problema `id`, leida UNA vez de private/answer
 *   totals: { k: string, sec: number, turns: number }[], // habla acumulada de TODA la sesion (para el reporte de cierre)
 * }} LiveState
 *
 * `answer` vive aqui porque el motor necesita compararla, pero live/state NO es legible desde el
 * navegador (ver firestore.rules): solo live/view lo es, y esa vista no la incluye.
 */

/** @returns {LiveState} */
export function emptyState() {
  return {
    v: STATE_VERSION,
    lastT: 0,
    lastEvalT: null,
    lastJudgeT: null,
    lastSpeechT: null,
    speaker: null,
    presence: [],
    intervals: [],
    transcripts: [],
    students: [],
    interventions: [],
    problem: null,
    answer: null,
    totals: [],
  }
}

/** Suma segundos y/o turnos de habla a un participante. */
function addTotals(totals, key, { sec = 0, turns = 0 }) {
  const current = totals.find((item) => item.k === key) ?? { k: key, sec: 0, turns: 0 }
  return upsert(totals, { k: key, sec: Math.round((current.sec + sec) * 10) / 10, turns: current.turns + turns })
}

const upsert = (list, entry) => [...list.filter((item) => item.k !== entry.k), entry]

function withPresence(presence, key, since, overwrite) {
  const exists = presence.some((p) => p.k === key)
  if (exists && !overwrite) return presence
  return upsert(presence, { k: key, s: since })
}

/** Cierra al hablante activo en `at` (solo si es `onlyKey`, cuando se indica). */
function closeSpeaker(state, at, onlyKey = null) {
  const { speaker } = state
  if (!speaker || (onlyKey !== null && speaker.k !== onlyKey) || at < speaker.s) return state
  return {
    ...state,
    speaker: null,
    totals: at > speaker.s ? addTotals(state.totals ?? [], speaker.k, { sec: at - speaker.s }) : state.totals,
    intervals: at > speaker.s ? [...state.intervals, { k: speaker.k, s: speaker.s, e: at }] : state.intervals,
    lastSpeechT: Math.max(state.lastSpeechT ?? -Infinity, at),
  }
}

/**
 * Absorbe un evento.
 * - speech_on/off es el HABLANTE ACTIVO: el speech_on de otra persona cierra el intervalo anterior;
 *   un speech_off que no es del hablante activo (atrasado) se ignora; un leave cierra el suyo.
 * - Un evento de speech que llega mas viejo que el inicio del hablante actual se ignora.
 * - Un transcript repetido (mismo id) no se agrega dos veces.
 * - El bot nunca cuenta como participante.
 *
 * @param {LiveState} state
 * @param {object} event  liveEvent ({ id?, type, participantKey, studentId, t, tEnd, text })
 * @param {{ botKeys: readonly string[], windowSec: number, maxTranscripts: number, maxIntervals: number }} cfg
 * @returns {LiveState}
 */
export function applyEvent(state, event, cfg) {
  const key = event?.participantKey
  const time = event && Number.isFinite(event.t) ? eventTime(event) : NaN
  if (!key || !Number.isFinite(time) || cfg.botKeys.includes(key)) return state

  let next = state
  switch (event.type) {
    case 'join':
      next = { ...next, presence: withPresence(next.presence, key, event.t, true) }
      break
    case 'leave':
      next = closeSpeaker({ ...next, presence: next.presence.filter((p) => p.k !== key) }, event.t, key)
      break
    case 'speech_on':
      next = { ...next, presence: withPresence(next.presence, key, event.t, false) }
      if (next.speaker?.k === key || (next.speaker && event.t < next.speaker.s)) break
      next = closeSpeaker(next, event.t)
      next = { ...next, speaker: { k: key, s: event.t }, totals: addTotals(next.totals ?? [], key, { turns: 1 }) }
      break
    case 'speech_off':
      next = closeSpeaker(next, event.t, key)
      break
    case 'transcript': {
      if (event.id && next.transcripts.some((x) => x.id === event.id)) return state
      const entry = { k: key, t: event.t, e: time, x: String(event.text ?? '') }
      if (event.id) entry.id = event.id
      next = {
        ...next,
        presence: withPresence(next.presence, key, event.t, false),
        transcripts: [...next.transcripts, entry].slice(-cfg.maxTranscripts),
        lastSpeechT: Math.max(next.lastSpeechT ?? -Infinity, time),
      }
      break
    }
    default:
      return state
  }

  if (event.studentId) next = { ...next, students: upsert(next.students, { k: key, id: event.studentId }) }

  const lastT = Math.max(next.lastT, time)
  return {
    ...next,
    lastT,
    intervals: next.intervals.filter((i) => i.e > lastT - cfg.windowSec).slice(-cfg.maxIntervals),
  }
}

/** Pliega eventos en un estado, en orden estable (tiempo y luego tipo). */
export function foldEvents(events, cfg, initial = emptyState()) {
  return events
    .filter((event) => Number.isFinite(event?.t) && Number.isFinite(eventTime(event)))
    .sort(
      (a, b) =>
        eventTime(a) - eventTime(b) ||
        (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) ||
        String(a.participantKey).localeCompare(String(b.participantKey)),
    )
    .reduce((state, event) => applyEvent(state, event, cfg), initial)
}

/**
 * Segundos de habla por participante dentro de [from, to]. Un hablante sin cierre cuenta hasta `to`.
 * `participants` siembra ceros para quien no hablo.
 */
export function talkTimeFromState(state, { from, to, participants = [] }) {
  const result = Object.fromEntries(participants.map((key) => [key, 0]))
  const add = (key, start, end) => {
    const clipped = Math.min(end, to) - Math.max(start, from)
    if (clipped > 0) result[key] = (result[key] ?? 0) + clipped
  }
  state.intervals.forEach(({ k, s, e }) => add(k, s, e))
  if (state.speaker) add(state.speaker.k, state.speaker.s, to)
  return result
}

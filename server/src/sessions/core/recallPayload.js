/**
 * Convierte un liveEvent (el formato que guardamos) en el payload de webhook que mandaria Recall.
 * Es la inversa de normalizeRecallEvent y sirve para reproducir una sesion grabada contra el
 * webhook desplegado, sin Recall. Pura: sin red ni reloj.
 *
 * Los tiempos absolutos se reconstruyen desde `occurredAt` (hora absoluta del fin del evento).
 */

const LAG_SEC = { transcript: 1.5, default: 0.2 }

const EVENT_NAMES = {
  join: 'participant_events.join',
  leave: 'participant_events.leave',
  speech_on: 'participant_events.speech_on',
  speech_off: 'participant_events.speech_off',
  transcript: 'transcript.data',
}

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1)

/** "estudiante b" -> "Estudiante B": un nombre que normalizeName devuelve a la misma clave. */
export const nameFromKey = (participantKey) => String(participantKey).split(' ').filter(Boolean).map(capitalize).join(' ')

const isoMinus = (iso, seconds) => (iso ? new Date(Date.parse(iso) - seconds * 1000).toISOString() : null)

/** Momento en que el evento termina, en segundos de sesion. */
export const endTime = (event) => (event.type === 'transcript' ? (event.tEnd ?? event.t) : event.t)

/**
 * Cuando "llegaria" el evento al webhook: su fin mas la demora tipica de Recall (los transcripts
 * llegan ~1,5 s despues, los eventos de habla ~0,2 s). Asi los transcripts llegan DESPUES de eventos
 * de habla posteriores, como en la realidad, y el motor debe tolerarlo.
 */
export const arrivalTime = (event) => endTime(event) + (LAG_SEC[event.type] ?? LAG_SEC.default)

/** Ordena eventos por hora de llegada (desempate estable por el orden original). */
export function inArrivalOrder(events) {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => arrivalTime(a.event) - arrivalTime(b.event) || a.index - b.index)
    .map(({ event }) => event)
}

/**
 * @param {object} event  liveEvent ({ type, participantKey, participantId, t, tEnd, text, occurredAt })
 * @param {{ sessionId: string, botId?: string }} options
 * @returns {object} payload con la forma que documenta Recall
 */
export function toRecallPayload(event, { sessionId, botId = 'bot-replay' }) {
  const participant = { id: event.participantId, name: nameFromKey(event.participantKey) }
  const bot = { id: botId, metadata: { sessionId } }
  const name = EVENT_NAMES[event.type]
  if (!name) throw new TypeError(`Tipo de evento no soportado: ${event.type}`)

  if (event.type !== 'transcript') {
    return {
      event: name,
      data: { data: { participant, timestamp: { relative: event.t, absolute: event.occurredAt }, data: null }, bot },
    }
  }

  // El texto se reparte en palabras; la primera empieza en t y la ultima termina en tEnd.
  const tokens = String(event.text ?? '').split(/\s+/).filter(Boolean)
  const span = (event.tEnd ?? event.t) - event.t
  const words = tokens.map((text, i) => {
    const start = event.t + (span * i) / tokens.length
    const end = i === tokens.length - 1 ? event.tEnd : event.t + (span * (i + 1)) / tokens.length
    return {
      text,
      start_timestamp: { relative: start, absolute: isoMinus(event.occurredAt, event.tEnd - start) },
      end_timestamp: { relative: end, absolute: isoMinus(event.occurredAt, event.tEnd - end) },
    }
  })
  return { event: name, data: { data: { words, language_code: 'en', participant }, bot } }
}

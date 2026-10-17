/**
 * Normaliza el payload de un webhook de Recall al evento interno de liveEvents.
 * Puro: sin Firebase, sin red, sin reloj. receivedAt lo agrega quien guarda.
 *
 * Estructura verificada en https://docs.recall.ai/docs/real-time-event-payloads:
 *   { event, data: { data: { participant, timestamp: { relative }, words? }, bot: { id, metadata } } }
 */

import { deterministicId } from './ids.js'
import { normalizeName } from './participants.js'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const EVENT_TYPES = {
  'participant_events.speech_on': 'speech_on',
  'participant_events.speech_off': 'speech_off',
  'transcript.data': 'transcript',
}

const toMillis = (seconds) => (Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0)

function participantKeyOf(participant) {
  const name = normalizeName(participant?.name)
  if (name) return name
  return `participant-${participant?.id ?? 'unknown'}`
}

function transcriptFields(inner) {
  const words = Array.isArray(inner?.words) ? inner.words : inner?.words ? [inner.words] : []
  const text = words
    .map((word) => (typeof word?.text === 'string' ? word.text.trim() : ''))
    .filter(Boolean)
    .join(' ')
  const t = words[0]?.start_timestamp?.relative
  const tEnd = words[words.length - 1]?.end_timestamp?.relative
  return { text, t, tEnd: Number.isFinite(tEnd) ? tEnd : null }
}

/**
 * @param {unknown} payload cuerpo JSON del webhook
 * @returns {{ sessionId: string, eventId: string, event: object } | null}
 *   null si el evento no se guarda (tipo no usado, sin sessionId o sin tiempo).
 */
export function normalizeRecallEvent(payload) {
  const type = EVENT_TYPES[payload?.event]
  if (!type) return null

  const sessionId = payload?.data?.bot?.metadata?.sessionId
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) return null

  const inner = payload.data.data
  const participant = inner?.participant

  let t
  let tEnd = null
  let text = null
  if (type === 'transcript') {
    const fields = transcriptFields(inner)
    if (!fields.text) return null
    ;({ t, tEnd } = fields)
    text = fields.text
  } else {
    t = inner?.timestamp?.relative
  }
  if (!Number.isFinite(t)) return null

  const eventId = deterministicId('evt', [
    type,
    `p${participant?.id ?? 0}`,
    `t${toMillis(t)}`,
    `e${toMillis(tEnd)}`,
  ])

  return {
    sessionId,
    eventId,
    event: { type, participantKey: participantKeyOf(participant), studentId: null, t, tEnd, text },
  }
}

/**
 * Decide la respuesta del webhook de Recall. Sin Firebase: el guardado y el
 * logger se inyectan, asi se prueba el contrato HTTP sin emulador.
 */

import { createHash, timingSafeEqual } from 'node:crypto'
import { normalizeRecallEvent } from './recallEvents.js'

/** Comparacion en tiempo constante; el hash iguala longitudes. */
export function tokensMatch(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false
  if (!received || !expected) return false
  const digest = (value) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(received), digest(expected))
}

/**
 * - 401 solo si el token no coincide.
 * - 200 en cualquier otro caso, incluso si guardar falla, para que Recall no
 *   reintente en bucle. Nunca se registran el token ni el cuerpo.
 *
 * @param {{ token: unknown, body: unknown }} request
 * @param {{
 *   expectedToken: string,
 *   saveEvent: (sessionId: string, eventId: string, event: object) => Promise<object|void>,
 *   onSaved?: (saved: { sessionId: string, eventId: string, event: object, result: object|undefined }) => void,
 *   logger: { info: Function, warn: Function, error: Function },
 * }} deps
 * onSaved se llama despues de guardar, sin esperar su resultado: sirve para encolar trabajo
 * posterior (senales, tutor) sin retrasar la respuesta a Recall. Si falla, no cambia el 200.
 * @returns {Promise<{ status: 200 | 401 }>}
 */
export async function handleRecallWebhook({ token, body }, { expectedToken, saveEvent, onSaved, logger }) {
  if (!tokensMatch(token, expectedToken)) {
    logger.warn('recallWebhook: token rechazado')
    return { status: 401 }
  }

  try {
    const normalized = normalizeRecallEvent(body)
    if (!normalized) {
      logger.info('recallWebhook: evento ignorado', { eventType: body?.event ?? null })
      return { status: 200 }
    }

    const { sessionId, eventId, event } = normalized
    const result = await saveEvent(sessionId, eventId, event)
    logger.info('recallWebhook: evento guardado', { sessionId, type: event.type, ...opsOf(result) })

    try {
      onSaved?.({ sessionId, eventId, event, result })
    } catch (error) {
      logger.error('recallWebhook: fallo el trabajo posterior', safeErrorInfo(error))
    }
  } catch (error) {
    logger.error('recallWebhook: no se pudo guardar el evento', safeErrorInfo(error))
  }
  return { status: 200 }
}

/** Operaciones de Firestore del evento (si el guardado las informa), para medir la cuota gratuita. */
function opsOf(result) {
  const ops = result?.ops
  if (!ops) return {}
  return {
    reads: ops.reads,
    writes: ops.writes,
    attempts: ops.attempts,
    evaluated: Boolean(result.evaluated),
    ...(Number.isFinite(result.ms) ? { ms: result.ms } : {}),
  }
}

/**
 * Datos seguros de un error para el log: nombre y codigo siempre; el mensaje solo si lo
 * escribimos nosotros (`expose`), nunca el de librerias, que puede traer datos sensibles.
 */
function safeErrorInfo(error) {
  return {
    name: error?.name ?? 'Error',
    code: error?.code ?? null,
    ...(error?.expose === true ? { detail: error.message } : {}),
  }
}

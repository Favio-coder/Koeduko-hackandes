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
 *   saveEvent: (sessionId: string, eventId: string, event: object) => Promise<void>,
 *   logger: { info: Function, warn: Function, error: Function },
 * }} deps
 * @returns {Promise<{ status: 200 | 401 }>}
 */
export async function handleRecallWebhook({ token, body }, { expectedToken, saveEvent, logger }) {
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
    await saveEvent(sessionId, eventId, event)
    logger.info('recallWebhook: evento guardado', { sessionId, type: event.type })
  } catch (error) {
    logger.error('recallWebhook: no se pudo guardar el evento', {
      name: error?.name ?? 'Error',
      code: error?.code ?? null,
    })
  }
  return { status: 200 }
}

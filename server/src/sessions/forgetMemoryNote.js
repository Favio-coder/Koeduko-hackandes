import { AuthError, SessionBotError } from './errors.js'
import { withTimeout } from './timeout.js'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const MAX_KEY_CHARS = 200

export const FORGET_TIMEOUT_MS = 5000

/** Un codigo corto de por que fallo: nunca el texto, la clave del estudiante ni el id de la nota. */
const reasonOf = (error) => (error?.name === 'TimeoutError' ? 'timeout' : (error?.name ?? 'error'))

/**
 * Olvida la nota que el cierre guardo de UN estudiante para el tutor (por ejemplo, porque la transcripcion confundio a
 * dos ninos y la nota no es cierta). Borra solo ese registro, en el proveedor donde quedo (AtomicMemory o el respaldo).
 *
 * El navegador manda solo la sesion y el participante del reporte (`key`, el nombre en Meet). La clave del estudiante y
 * el id de la nota los guardo el servidor al cerrar (private/memory): nadie puede pedir borrar la memoria de otro
 * estudiante ni de otra sala. Solo el docente que creo la sala puede hacerlo.
 *
 * Si el proveedor falla o tarda, la nota SIGUE guardada y se dice asi (503); no se marca como olvidada.
 *
 * @param {{
 *   sessionId: unknown, participantKey: unknown, uid: string,
 *   store: { getSession: Function, getMemoryRefs: Function, getSummary: Function, markMemoryForgotten: Function },
 *   memory: { forget: (studentKey: string, ref: { via: string, id: string }) => Promise<{ ok: boolean, reason?: string }> } | null,
 *   logger: { info: Function },
 *   timeoutMs?: number,
 * }} input
 * @returns {Promise<{ status: 'forgotten', key: string, alreadyForgotten: boolean }>}
 */
export async function forgetMemoryNote({ sessionId, participantKey, uid, store, memory, logger, timeoutMs = FORGET_TIMEOUT_MS }) {
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new SessionBotError('invalid-argument', 'sessionId es obligatorio.')
  }
  if (typeof participantKey !== 'string' || !participantKey.trim() || participantKey.length > MAX_KEY_CHARS) {
    throw new SessionBotError('invalid-argument', 'Falta el estudiante.')
  }

  const session = await store.getSession(sessionId)
  if (!session) throw new SessionBotError('not-found', 'La sesion no existe.')
  if (session.createdBy !== uid) throw new AuthError('permission-denied', 'Solo el docente que creó la sala puede olvidar sus notas.')

  const summary = await store.getSummary(sessionId)
  const note = (Array.isArray(summary?.memoryNotes) ? summary.memoryNotes : []).find((item) => item?.key === participantKey)
  if (note?.status === 'forgotten') return { status: 'forgotten', key: participantKey, alreadyForgotten: true }

  const ref = (await store.getMemoryRefs(sessionId)).find((item) => item?.key === participantKey)
  if (!note || !ref) throw new SessionBotError('not-found', 'No hay una nota de este estudiante que se pueda olvidar en esta sesión.')

  if (!memory) throw new SessionBotError('unavailable', 'La memoria no está configurada en el servidor: la nota sigue guardada.')

  let result
  try {
    result = await withTimeout(memory.forget(ref.studentKey, { via: ref.via, id: ref.id }), timeoutMs)
  } catch (error) {
    result = { ok: false, reason: reasonOf(error) }
  }
  if (!result?.ok) {
    logger.info('forgetMemoryNote: no se pudo olvidar', { sessionId, via: ref.via, reason: result?.reason ?? 'error' })
    throw new SessionBotError('unavailable', 'No se pudo olvidar la nota: sigue guardada. Inténtalo de nuevo en un momento.')
  }

  await store.markMemoryForgotten(sessionId, participantKey)
  logger.info('forgetMemoryNote: nota olvidada', { sessionId, via: ref.via })
  return { status: 'forgotten', key: participantKey, alreadyForgotten: false }
}

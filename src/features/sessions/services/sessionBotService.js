import { postToServer } from '@/services/serverApi'

/**
 * Invita al bot "Tutor KoEduko" a la reunion de Meet de la sesion. Solo el docente puede: lo exige
 * el servidor (rol leido de users/{uid}), esta funcion no decide nada. El enlace de Meet sale de la
 * sesion guardada, no de esta llamada.
 *
 * @param {{ sessionId: string }} params
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ botId: string, status: 'requested' }>}
 * @throws {Error} con el mensaje del servidor (por ejemplo, "El tutor ya fue invitado a esta sesion.")
 */
export async function inviteTutor({ sessionId }, { fetchImpl } = {}) {
  if (!sessionId) throw new Error('sessionId es obligatorio')

  const data = await postToServer('/api/start-session-bot', { sessionId }, { fetchImpl, subject: 'el servidor de sesiones' })
  if (!data?.botId) throw new Error('El servidor no confirmó que el tutor fue invitado.')
  return data
}

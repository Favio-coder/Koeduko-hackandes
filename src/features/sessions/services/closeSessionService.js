import { postToServer } from '@/services/serverApi'

/**
 * Cierra la sesion: el servidor saca al tutor de la reunion, arma el reporte de evidencia por
 * competencias, lo guarda, actualiza la memoria de cada estudiante y marca la sesion como realizada.
 * Solo el docente puede: lo exige el servidor. Es idempotente: cerrar dos veces devuelve el mismo reporte.
 *
 * @param {{ sessionId: string }} params
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ status: 'completed', alreadyClosed: boolean, report: object, steps: object }>}
 * @throws {Error} con el mensaje del servidor
 */
export async function closeSession({ sessionId }, { fetchImpl } = {}) {
  if (!sessionId) throw new Error('sessionId es obligatorio')

  const data = await postToServer('/api/close-session', { sessionId }, { fetchImpl, subject: 'el servidor de sesiones' })
  if (!data?.report) throw new Error('El servidor no devolvió el reporte de la sesión.')
  return data
}

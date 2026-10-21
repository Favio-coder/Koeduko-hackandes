import { postToServer } from '@/services/serverApi'

/**
 * Olvida la nota que el cierre guardo de un estudiante para el tutor. Solo se manda la sala y el participante del
 * reporte: la clave del estudiante y el id de la nota los tiene el servidor (private/memory), nunca el navegador.
 * Solo el docente que creo la sala puede hacerlo.
 *
 * @param {{ sessionId: string, key: string }} params
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ status: 'forgotten', key: string, alreadyForgotten: boolean }>}
 * @throws {Error} con el mensaje del servidor (p. ej. «No se pudo olvidar la nota: sigue guardada...»)
 */
export async function forgetMemoryNote({ sessionId, key }, { fetchImpl } = {}) {
  if (!sessionId || !key) throw new Error('Falta la sala o el estudiante.')

  const data = await postToServer('/api/forget-memory-note', { sessionId, key }, { fetchImpl, subject: 'el servidor de sesiones' })
  // Solo se muestra «olvidada» con la confirmacion del servidor, nunca por un 200 cualquiera.
  if (data?.status !== 'forgotten' || data?.key !== key) throw new Error('El servidor no confirmó que la nota se olvidó: puede seguir guardada.')
  return data
}

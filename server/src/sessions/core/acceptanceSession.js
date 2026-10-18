export const ACCEPTANCE_SESSION_PATTERN = /^accept-[a-z0-9-]{1,40}$/
const MEET_URL = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/

/**
 * Documento de una sesion de prueba de aceptacion (sesion real, sin estudiantes enlazados todavia).
 * Funcion pura: el script solo agrega la marca de tiempo del servidor y lo escribe.
 *
 * @param {{ sessionId: string, teacherUid: string, meetingUrl: string }} input
 */
export function buildAcceptanceSession({ sessionId, teacherUid, meetingUrl }) {
  if (!ACCEPTANCE_SESSION_PATTERN.test(sessionId ?? '')) throw new TypeError('sessionId debe ser accept-<nombre>.')
  if (typeof teacherUid !== 'string' || !teacherUid.trim()) throw new TypeError('teacherUid es obligatorio.')
  if (!MEET_URL.test(meetingUrl ?? '')) throw new TypeError('meetingUrl debe ser un enlace de Google Meet.')

  return {
    title: `Prueba de aceptacion ${sessionId}`,
    pairId: null,
    studentIds: [], // UIDs de Firebase Auth; vacio hasta enlazar estudiantes reales
    meetingUrl,
    meetingProvider: 'google-meet',
    status: 'scheduled',
    createdBy: teacherUid.trim(),
    currentProblem: {
      activityId: 'p-01',
      skillId: 'multiplication',
      text: 'Hay 6 cajas con 8 lápices cada una. ¿Cuántos lápices hay en total?',
      expectedAnswer: 48,
    },
  }
}

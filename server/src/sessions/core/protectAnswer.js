/**
 * Separa la respuesta esperada de un problema: el enunciado queda en el documento de la sesion
 * (que leen los estudiantes) y la respuesta va a learningSessions/{id}/private/answer, que ningun
 * cliente puede leer. Pura: el script de migracion solo lee, llama esto y escribe.
 *
 * @param {object|null} session  documento learningSessions/{id}
 * @returns {{ needed: boolean, publicProblem?: object, answer?: { activityId: string, expectedAnswer: number } }}
 */
export function splitAnswer(session) {
  const current = session?.currentProblem
  if (!current || typeof current !== 'object' || !('expectedAnswer' in current)) return { needed: false }

  const { expectedAnswer, ...publicProblem } = current
  const value = Number(expectedAnswer)
  if (!Number.isFinite(value)) return { needed: false }

  const activityId = publicProblem.activityId ?? publicProblem.id
  return { needed: true, publicProblem, answer: { activityId: activityId === undefined ? null : String(activityId), expectedAnswer: value } }
}

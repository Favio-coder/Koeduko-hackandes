import { postToServer } from '@/services/serverApi'

export { SERVER_URL } from '@/services/serverApi'

/**
 * Cliente del tutor IA. La llamada va al endpoint del servidor con el ID token de Firebase del
 * usuario; nunca a Gemini directamente: la API key vive solo en el servidor.
 *
 * @param {{ sessionId: string, prompt: string }} params
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<string>} la pista del tutor
 * @throws {Error} sin sesion iniciada, sin permiso en esa sesion o si el servidor no responde
 */
export async function askTutor({ sessionId, prompt }, { fetchImpl } = {}) {
  if (!sessionId) throw new Error('sessionId es obligatorio')
  if (!prompt || !prompt.trim()) throw new Error('prompt es obligatorio')

  const data = await postToServer('/api/ask-tutor', { sessionId, prompt: prompt.trim() }, { fetchImpl, subject: 'el tutor' })
  if (!data?.reply) throw new Error('El tutor no devolvió una respuesta válida.')
  return data.reply
}

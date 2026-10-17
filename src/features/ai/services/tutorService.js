import { httpsCallable } from 'firebase/functions'
import { functions } from '@/services/firebase'

/**
 * Cliente del tutor IA. La llamada va a la Cloud Function, nunca a Gemini
 * directamente: la API key vive en los secretos del servidor.
 *
 * @param {{ sessionId: string, prompt: string }} params
 * @returns {Promise<string>} respuesta del tutor
 * @throws {Error} si la funcion no esta desplegada o el usuario no tiene permiso
 */
export async function askTutor({ sessionId, prompt }) {
  if (!sessionId) throw new Error('sessionId es obligatorio')
  if (!prompt || !prompt.trim()) throw new Error('prompt es obligatorio')

  const call = httpsCallable(functions, 'askTutor')
  const { data } = await call({ sessionId, prompt: prompt.trim() })
  if (!data?.reply) throw new Error('La funcion no devolvio una respuesta valida.')
  return data.reply
}
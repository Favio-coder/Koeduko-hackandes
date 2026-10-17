import { auth } from '@/services/firebase'

/**
 * Servidor privilegiado (server/, en Vercel). VITE_SERVER_URL permite apuntar a otro, por ejemplo
 * una preview. Es una direccion publica, no un secreto.
 */
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || 'https://koeduko.vercel.app').replace(/\/+$/, '')

/**
 * Cliente del tutor IA. La llamada va al endpoint del servidor con el ID token de Firebase del
 * usuario; nunca a Gemini directamente: la API key vive solo en el servidor.
 *
 * @param {{ sessionId: string, prompt: string }} params
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<string>} la pista del tutor
 * @throws {Error} sin sesion iniciada, sin permiso en esa sesion o si el servidor no responde
 */
export async function askTutor({ sessionId, prompt }, { fetchImpl = globalThis.fetch } = {}) {
  if (!sessionId) throw new Error('sessionId es obligatorio')
  if (!prompt || !prompt.trim()) throw new Error('prompt es obligatorio')

  const user = auth.currentUser
  if (!user) throw new Error('Debes iniciar sesión para usar el tutor.')
  const token = await user.getIdToken()

  let response
  try {
    response = await fetchImpl(`${SERVER_URL}/api/ask-tutor`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, prompt: prompt.trim() }),
    })
  } catch {
    throw new Error('No se pudo conectar con el tutor. Revisa tu conexión e inténtalo de nuevo.')
  }

  if (!response.ok) {
    // El servidor solo manda mensajes pensados para mostrarse; si no hay, uno generico.
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || `El tutor respondió con un error (${response.status}).`)
  }

  const data = await response.json().catch(() => null)
  if (!data?.reply) throw new Error('El tutor no devolvió una respuesta válida.')
  return data.reply
}

import { auth } from '@/services/firebase'

/**
 * Servidor privilegiado (server/, en Vercel). VITE_SERVER_URL permite apuntar a otro, por ejemplo
 * una preview. Es una direccion publica, no un secreto.
 */
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || 'https://koeduko.vercel.app').replace(/\/+$/, '')

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * POST autenticado al servidor, con el ID token de Firebase del usuario. Es el unico lugar del
 * navegador que habla con server/: los features lo comparten sin importarse entre si.
 *
 * - Si el servidor rechaza la peticion, se muestra SU mensaje (solo manda textos pensados para
 *   mostrarse); si no hay uno legible, uno generico.
 * - `subject` ("el tutor", "el servidor de sesiones") personaliza los mensajes de error.
 *
 * @param {string} path  p. ej. "/api/ask-tutor"
 * @param {object} body
 * @param {{ fetchImpl?: typeof fetch, subject?: string }} [options]
 * @returns {Promise<any>} el JSON de la respuesta (o null si no es JSON)
 */
export async function postToServer(path, body, { fetchImpl = globalThis.fetch, subject = 'el servidor' } = {}) {
  const user = auth.currentUser
  if (!user) throw new Error('Debes iniciar sesión para continuar.')
  const token = await user.getIdToken()

  let response
  try {
    response = await fetchImpl(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(`No se pudo conectar con ${subject}. Revisa tu conexión e inténtalo de nuevo.`)
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message || `${capitalize(subject)} respondió con un error (${response.status}).`)
  }
  return response.json().catch(() => null)
}

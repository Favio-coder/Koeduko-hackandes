import { postToServer } from '@/services/serverApi'

/**
 * Conexion de la cuenta de Google del docente (para que el servidor cree las reuniones de Meet de sus salas).
 * El navegador nunca ve el token: solo pregunta si ya esta conectada y, si no, recibe la URL de autorizacion de Google.
 */

/** @returns {Promise<boolean>} true si el docente ya conecto su cuenta */
export async function fetchGoogleStatus({ post = postToServer } = {}) {
  const data = await post('/api/google-connect', { statusOnly: true }, { subject: 'el servidor de sesiones' })
  return data?.connected === true
}

/** @returns {Promise<string>} URL de Google a la que hay que mandar al docente */
export async function requestGoogleAuthUrl({ origin = window.location.origin, post = postToServer } = {}) {
  const data = await post('/api/google-connect', { returnTo: origin }, { subject: 'el servidor de sesiones' })
  if (typeof data?.url !== 'string' || !data.url.startsWith('https://accounts.google.com/')) {
    throw new Error('El servidor no devolvió una dirección de autorización válida.')
  }
  return data.url
}

/** Mensaje para el docente segun el resultado que el callback deja en ?google=... */
export const GOOGLE_RESULT_MESSAGES = Object.freeze({
  connected: { tone: 'success', text: 'Cuenta de Google conectada. Las salas sin enlace ya pueden crear su reunión de Meet.' },
  denied: { tone: 'error', text: 'No autorizaste el acceso a Google. Sin eso no se pueden crear reuniones automáticamente.' },
  'no-refresh': { tone: 'error', text: 'Google no entregó el permiso permanente. Quita el acceso de KoEduko en tu cuenta de Google y conéctala de nuevo.' },
  error: { tone: 'error', text: 'No se pudo conectar con Google. Inténtalo de nuevo.' },
})

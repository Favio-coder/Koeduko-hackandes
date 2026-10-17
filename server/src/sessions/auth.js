import { AuthError } from './errors.js'

/** Extrae el token de "Authorization: Bearer <token>". */
export function bearerToken(header) {
  const match = /^Bearer\s+(\S+)$/i.exec(typeof header === 'string' ? header.trim() : '')
  return match ? match[1] : null
}

/**
 * Exige un docente: verifica el ID token de Firebase y lee el rol de users/{uid}.
 * El rol nunca se toma de la peticion. El token no se registra ni se incluye en errores.
 *
 * @param {string|undefined} authorizationHeader
 * @param {{ verifyIdToken: (token: string) => Promise<{ uid: string }>, getUserRole: (uid: string) => Promise<string|null> }} deps
 * @returns {Promise<{ uid: string }>}
 */
export async function requireTeacherFromRequest(authorizationHeader, { verifyIdToken, getUserRole }) {
  const token = bearerToken(authorizationHeader)
  if (!token) throw new AuthError('unauthenticated', 'Falta el token de autenticacion.')

  let decoded
  try {
    decoded = await verifyIdToken(token)
  } catch {
    throw new AuthError('unauthenticated', 'El token es invalido o vencio.')
  }

  const role = await getUserRole(decoded.uid)
  if (role !== 'teacher') throw new AuthError('permission-denied', 'Se requiere rol docente.')
  return { uid: decoded.uid }
}

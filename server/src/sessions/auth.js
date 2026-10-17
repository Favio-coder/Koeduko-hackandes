import { AuthError, SessionBotError } from './errors.js'

/** Extrae el token de "Authorization: Bearer <token>". */
export function bearerToken(header) {
  const match = /^Bearer\s+(\S+)$/i.exec(typeof header === 'string' ? header.trim() : '')
  return match ? match[1] : null
}

/** Verifica el ID token de Firebase. El token no se registra ni se incluye en los errores. */
async function verifiedUid(authorizationHeader, verifyIdToken) {
  const token = bearerToken(authorizationHeader)
  if (!token) throw new AuthError('unauthenticated', 'Falta el token de autenticacion.')

  try {
    return (await verifyIdToken(token)).uid
  } catch {
    throw new AuthError('unauthenticated', 'El token es invalido o vencio.')
  }
}

/**
 * Exige un docente: verifica el ID token de Firebase y lee el rol de users/{uid}.
 * El rol nunca se toma de la peticion.
 *
 * @param {string|undefined} authorizationHeader
 * @param {{ verifyIdToken: (token: string) => Promise<{ uid: string }>, getUserRole: (uid: string) => Promise<string|null> }} deps
 * @returns {Promise<{ uid: string }>}
 */
export async function requireTeacherFromRequest(authorizationHeader, { verifyIdToken, getUserRole }) {
  const uid = await verifiedUid(authorizationHeader, verifyIdToken)
  const role = await getUserRole(uid)
  if (role !== 'teacher') throw new AuthError('permission-denied', 'Se requiere rol docente.')
  return { uid }
}

/**
 * Exige un usuario que pertenezca a la sesion: un docente, o un estudiante cuyo uid figure en
 * studentIds de ESA sesion. El rol sale de users/{uid}, nunca de la peticion.
 *
 * Un estudiante recibe el mismo 403 si la sesion no existe y si no es suya, para no revelar
 * que ids de sesion existen. Un docente si recibe 404.
 *
 * @param {string|undefined} authorizationHeader
 * @param {string} sessionId
 * @param {{
 *   verifyIdToken: (token: string) => Promise<{ uid: string }>,
 *   getUserRole: (uid: string) => Promise<string|null>,
 *   getSession: (sessionId: string) => Promise<object|null>,
 * }} deps
 * @returns {Promise<{ uid: string, role: 'teacher'|'student', session: object }>}
 */
export async function requireSessionMember(authorizationHeader, sessionId, { verifyIdToken, getUserRole, getSession }) {
  const uid = await verifiedUid(authorizationHeader, verifyIdToken)
  const role = await getUserRole(uid)
  if (role !== 'teacher' && role !== 'student') throw new AuthError('permission-denied', 'Tu usuario no tiene un rol valido.')

  const session = await getSession(sessionId)
  if (role === 'teacher') {
    if (!session) throw new SessionBotError('not-found', 'La sesion no existe.')
    return { uid, role, session }
  }

  const isMember = Array.isArray(session?.studentIds) && session.studentIds.includes(uid)
  if (!isMember) throw new AuthError('permission-denied', 'No perteneces a esta sesion.')
  return { uid, role, session }
}

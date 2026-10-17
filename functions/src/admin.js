import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp()

export const adminAuth = getAuth()
export const db = getFirestore()

/**
 * Verifica el token de Firebase Auth y devuelve el usuario.
 * Toda funcion privileged DEBE pasar por aqui: nunca confiar en el rol
 * enviado por el cliente.
 *
 * @param {import('firebase-functions/v1/https').CallableRequest} request
 * @returns {Promise<import('firebase-admin/auth').User>}
 */
export async function requireUser(request) {
  const token = request.auth?.token
  if (!token) {
    const error = new Error('No autenticado.')
    error.code = 'unauthenticated'
    throw error
  }
  return adminAuth.getUser(token.uid)
}

/**
 * Verifica ademas el rol docente leyendo el documento del usuario en Firestore.
 * @param {import('firebase-functions/v1/https').CallableRequest} request
 * @returns {Promise<import('firebase-admin/auth').User>}
 */
export async function requireTeacher(request) {
  const user = await requireUser(request)
  const snap = await db.doc(`users/${user.uid}`).get()
  if (!snap.exists || snap.data().role !== 'teacher') {
    const error = new Error('Se requiere rol docente.')
    error.code = 'permission-denied'
    throw error
  }
  return user
}
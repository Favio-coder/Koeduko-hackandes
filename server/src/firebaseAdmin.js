import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { ConfigError } from './sessions/errors.js'

const REQUIRED_FIELDS = ['project_id', 'client_email', 'private_key']

/**
 * Decodifica FIREBASE_SERVICE_ACCOUNT_B64 (el JSON de la cuenta de servicio en base64).
 * Los errores nombran el problema pero nunca incluyen el contenido decodificado.
 */
export function parseServiceAccount(base64) {
  if (typeof base64 !== 'string' || !base64.trim()) {
    throw new ConfigError(['FIREBASE_SERVICE_ACCOUNT_B64 (falta)'])
  }

  let account
  try {
    account = JSON.parse(Buffer.from(base64.trim(), 'base64').toString('utf8'))
  } catch {
    throw new ConfigError(['FIREBASE_SERVICE_ACCOUNT_B64 (no es un JSON valido en base64)'])
  }

  const absent = REQUIRED_FIELDS.filter((field) => typeof account?.[field] !== 'string' || !account[field])
  if (absent.length) {
    throw new ConfigError([`FIREBASE_SERVICE_ACCOUNT_B64 (al JSON le faltan: ${absent.join(', ')})`])
  }
  return account
}

let cached = null

/** Inicializa firebase-admin una sola vez por instancia. Solo aqui se lee la cuenta de servicio. */
export function getFirebase(env = process.env) {
  if (!cached) {
    const app =
      getApps()[0] ?? initializeApp({ credential: cert(parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_B64)) })
    cached = { db: getFirestore(app), auth: getAuth(app), FieldValue }
  }
  return cached
}

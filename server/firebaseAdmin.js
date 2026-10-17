import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export function adminServices() {
  if (!getApps().length) {
    const credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}')
    if (!credential.project_id || !credential.private_key || !credential.client_email) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_JSON en el servidor.')
    initializeApp({ credential: cert(credential) })
  }
  return { auth: getAuth(), db: getFirestore() }
}

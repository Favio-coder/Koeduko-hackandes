import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { parseServiceAccount } from './firebaseAdmin.js'

/**
 * Credenciales del Admin SDK para los SCRIPTS (los endpoints usan firebaseAdmin.js). Orden, de mejor a peor:
 *  1. env      la MISMA variable que usa el servidor, FIREBASE_SERVICE_ACCOUNT_B64. Un valor que no se puede
 *              decodificar (por ejemplo "[SENSITIVE]", lo que `vercel env pull` escribe para los Secret) no sirve.
 *  2. adc      Application Default Credentials: GOOGLE_APPLICATION_CREDENTIALS o `gcloud auth application-default login`.
 *  3. file     una cuenta de servicio en un archivo, SOLO si se pide explicitamente (--service-account); es el
 *              ultimo recurso porque deja una clave privada en disco.
 * No genera claves nuevas ni lee nada que el llamador no haya indicado.
 *
 * @param {{ env?: Record<string, string|undefined>, serviceAccountFile?: string|null, adcFileExists?: boolean }} input
 * @returns {'env'|'adc'|'file'|null}
 */
export function pickCredential({ env = process.env, serviceAccountFile = null, adcFileExists = false }) {
  try {
    parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_B64)
    return 'env'
  } catch {
    // no hay una cuenta de servicio usable en el entorno
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS || adcFileExists) return 'adc'
  if (serviceAccountFile) return 'file'
  return null
}

/** true si `gcloud auth application-default login` dejo su archivo (Windows: %APPDATA%\gcloud; otros: ~/.config/gcloud). */
export function adcFileExists(env = process.env, exists = existsSync) {
  const dir = env.APPDATA ? join(env.APPDATA, 'gcloud') : join(homedir(), '.config', 'gcloud')
  return exists(join(dir, 'application_default_credentials.json'))
}

/**
 * Inicializa firebase-admin con la mejor credencial disponible.
 *
 * @returns {{ db: any, FieldValue: any, source: 'env'|'adc'|'file' }}
 * @throws {Error} sin credenciales: dice que hacer, sin mostrar nada sensible
 */
export function initAdmin({ env = process.env, serviceAccountFile = null, hasAdcFile = adcFileExists(env), readFile, projectId = 'koeduko-app' } = {}) {
  const source = pickCredential({ env, serviceAccountFile, adcFileExists: hasAdcFile })
  if (!source) {
    throw new Error(
      'No hay credenciales del Admin SDK. Opciones: FIREBASE_SERVICE_ACCOUNT_B64, Application Default Credentials ' +
        '(gcloud auth application-default login) o --service-account <archivo>.',
    )
  }

  const credential =
    source === 'env'
      ? cert(parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_B64))
      : source === 'adc'
        ? applicationDefault()
        : cert(JSON.parse(readFile(serviceAccountFile)))

  const app = getApps()[0] ?? initializeApp({ credential, projectId })
  return { db: getFirestore(app), FieldValue, source }
}

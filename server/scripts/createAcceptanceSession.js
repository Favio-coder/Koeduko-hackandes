#!/usr/bin/env node
/**
 * Crea una sesion de prueba de aceptacion (accept-*) en Firestore con firebase-admin.
 *
 *   node scripts/createAcceptanceSession.js --teacher-uid <uid> | --teacher-uid-file <archivo> [--session accept-001]
 *        [--meeting-url https://meet.google.com/htp-bkeg-oeb] [--service-account <archivo.json>]
 *
 * Credenciales (ver src/adminCredentials.js): FIREBASE_SERVICE_ACCOUNT_B64 como el servidor, o Application
 * Default Credentials, o --service-account <archivo> como ultimo recurso; nada se imprime. No sobrescribe: si
 * la sesion ya existe, falla. Solo crea sesiones llamadas "accept-*".
 */

import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { initAdmin } from '../src/adminCredentials.js'
import { buildAcceptanceAnswer, buildAcceptanceSession } from '../src/sessions/core/acceptanceSession.js'

const { values } = parseArgs({
  options: {
    'teacher-uid': { type: 'string' },
    // Alternativa para no pasar el uid por el chat ni dejarlo en el historial: un archivo con el uid.
    'teacher-uid-file': { type: 'string' },
    session: { type: 'string', default: 'accept-001' },
    'meeting-url': { type: 'string', default: 'https://meet.google.com/htp-bkeg-oeb' },
    // Ultimo recurso: sin esto se usa FIREBASE_SERVICE_ACCOUNT_B64 o Application Default Credentials.
    'service-account': { type: 'string' },
  },
})

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

let teacherUid = values['teacher-uid']
if (values['teacher-uid-file']) {
  try {
    teacherUid = readFileSync(values['teacher-uid-file'], 'utf8').trim()
  } catch {
    fail(`no pude leer el uid del docente en ${values['teacher-uid-file']}.`)
  }
}

let data
try {
  data = buildAcceptanceSession({ sessionId: values.session, teacherUid, meetingUrl: values['meeting-url'] })
} catch (error) {
  fail(error.message)
}

let admin
try {
  admin = initAdmin({ serviceAccountFile: values['service-account'], readFile: (file) => readFileSync(file, 'utf8') })
} catch (error) {
  fail(error.message)
}
const { db, FieldValue } = admin
const ref = db.doc(`learningSessions/${values.session}`)

try {
  // create() falla si la sesion ya existe; la respuesta se guarda aparte, donde ningun estudiante la lee.
  await ref.create({ ...data, createdAt: FieldValue.serverTimestamp() })
  await ref.collection('private').doc('answer').set(buildAcceptanceAnswer())
} catch (error) {
  fail(error?.code === 6 ? `learningSessions/${values.session} ya existe; no se sobrescribe.` : `Firestore respondio: ${error?.message ?? 'error'}`)
}
console.log(`Creada learningSessions/${values.session} (docente ${data.createdBy}).`)
process.exit(0)

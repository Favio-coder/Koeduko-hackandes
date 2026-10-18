#!/usr/bin/env node
/**
 * Crea una sesion de prueba de aceptacion (accept-*) en Firestore con firebase-admin.
 *
 *   node scripts/createAcceptanceSession.js --teacher-uid <uid> [--session accept-001]
 *        [--meeting-url https://meet.google.com/htp-bkeg-oeb] [--service-account <archivo.json>]
 *
 * La cuenta de servicio se lee de un archivo FUERA del repo (por defecto
 * ~/Downloads/service-account.json) y nunca se imprime. No sobrescribe: si la sesion ya existe, falla.
 * Solo crea sesiones llamadas "accept-*".
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { buildAcceptanceSession } from '../src/sessions/core/acceptanceSession.js'

const { values } = parseArgs({
  options: {
    'teacher-uid': { type: 'string' },
    session: { type: 'string', default: 'accept-001' },
    'meeting-url': { type: 'string', default: 'https://meet.google.com/htp-bkeg-oeb' },
    'service-account': { type: 'string', default: join(homedir(), 'Downloads', 'service-account.json') },
  },
})

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

let data
try {
  data = buildAcceptanceSession({ sessionId: values.session, teacherUid: values['teacher-uid'], meetingUrl: values['meeting-url'] })
} catch (error) {
  fail(error.message)
}

let account
try {
  account = JSON.parse(readFileSync(values['service-account'], 'utf8'))
} catch {
  fail(`no pude leer la cuenta de servicio en ${values['service-account']}.`)
}

const db = getFirestore(initializeApp({ credential: cert(account) }))
const ref = db.doc(`learningSessions/${values.session}`)

try {
  await ref.create({ ...data, createdAt: FieldValue.serverTimestamp() })
} catch (error) {
  fail(error?.code === 6 ? `learningSessions/${values.session} ya existe; no se sobrescribe.` : `Firestore respondio: ${error?.message ?? 'error'}`)
}
console.log(`Creada learningSessions/${values.session} (docente ${data.createdBy}).`)
process.exit(0)

#!/usr/bin/env node
/**
 * Mueve la respuesta esperada de una sesion a learningSessions/{id}/private/answer y la borra de
 * currentProblem (el documento que leen los estudiantes). Idempotente: si ya esta migrada, no hace nada.
 *
 *   node scripts/protectAnswer.js --session accept-001 [--service-account <archivo.json>]
 *
 * Credenciales (ver src/adminCredentials.js): FIREBASE_SERVICE_ACCOUNT_B64 como el servidor, o Application
 * Default Credentials, o --service-account <archivo> como ultimo recurso. Nada se imprime: ni credenciales
 * ni la respuesta.
 */

import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { initAdmin } from '../src/adminCredentials.js'
import { splitAnswer } from '../src/sessions/core/protectAnswer.js'

const { values } = parseArgs({
  options: {
    session: { type: 'string' },
    // Ultimo recurso: sin esto se usa FIREBASE_SERVICE_ACCOUNT_B64 o Application Default Credentials.
    'service-account': { type: 'string' },
  },
})

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

if (!/^[A-Za-z0-9_-]{1,128}$/.test(values.session ?? '')) fail('--session es obligatorio (letras, numeros, - y _).')

let admin
try {
  admin = initAdmin({ serviceAccountFile: values['service-account'], readFile: (file) => readFileSync(file, 'utf8') })
} catch (error) {
  fail(error.message)
}
const { db, FieldValue } = admin
const sessionRef = db.doc(`learningSessions/${values.session}`)

const snap = await sessionRef.get()
if (!snap.exists) fail(`learningSessions/${values.session} no existe.`)

const split = splitAnswer(snap.data())
if (!split.needed) {
  console.log(`learningSessions/${values.session}: nada que migrar (sin respuesta dentro de currentProblem).`)
  process.exit(0)
}

const batch = db.batch()
batch.set(sessionRef.collection('private').doc('answer'), { ...split.answer, movedAt: FieldValue.serverTimestamp() })
batch.update(sessionRef, { 'currentProblem.expectedAnswer': FieldValue.delete() })
await batch.commit()
console.log(`learningSessions/${values.session}: respuesta movida a private/answer y borrada de currentProblem.`)
process.exit(0)

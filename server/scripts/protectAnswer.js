#!/usr/bin/env node
/**
 * Mueve la respuesta esperada de una sesion a learningSessions/{id}/private/answer y la borra de
 * currentProblem (el documento que leen los estudiantes). Idempotente: si ya esta migrada, no hace nada.
 *
 *   node scripts/protectAnswer.js --session accept-001 [--service-account <archivo.json>]
 *
 * La cuenta de servicio se lee de un archivo FUERA del repo (por defecto ~/Downloads/service-account.json)
 * y nunca se imprime. Tampoco se imprime la respuesta.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { splitAnswer } from '../src/sessions/core/protectAnswer.js'

const { values } = parseArgs({
  options: {
    session: { type: 'string' },
    'service-account': { type: 'string', default: join(homedir(), 'Downloads', 'service-account.json') },
  },
})

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

if (!/^[A-Za-z0-9_-]{1,128}$/.test(values.session ?? '')) fail('--session es obligatorio (letras, numeros, - y _).')

let account
try {
  account = JSON.parse(readFileSync(values['service-account'], 'utf8'))
} catch {
  fail(`no pude leer la cuenta de servicio en ${values['service-account']}.`)
}

const db = getFirestore(initializeApp({ credential: cert(account) }))
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

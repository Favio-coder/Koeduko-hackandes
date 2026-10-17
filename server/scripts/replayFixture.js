#!/usr/bin/env node
/**
 * Reproduce fixtures/smoke-001.json contra el webhook desplegado, sin Recall, como si fuera una
 * sesion en vivo. Sirve para probar el flujo completo (webhook -> estado -> senales -> tutor) y
 * medir lo que cuesta en Firestore.
 *
 *   node scripts/replayFixture.js --session smoke-replay-001 --speed 4
 *
 * Opciones: --url (por defecto el webhook de produccion), --token-file (por defecto
 * ~/Downloads/webhook-token.txt), --fixture, --limit (solo los primeros N eventos).
 *
 * Seguridad: el token se lee de un archivo y nunca se imprime; solo escribe en sesiones
 * llamadas "smoke-replay-*".
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { arrivalTime, inArrivalOrder, toRecallPayload } from '../src/sessions/core/recallPayload.js'

const DEFAULT_URL = 'https://koeduko.vercel.app/api/recall-webhook'
const SESSION_PATTERN = /^smoke-replay-[a-z0-9-]{1,40}$/

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: DEFAULT_URL },
    session: { type: 'string' },
    speed: { type: 'string', default: '4' },
    'token-file': { type: 'string', default: join(homedir(), 'Downloads', 'webhook-token.txt') },
    fixture: { type: 'string', default: new URL('../fixtures/smoke-001.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') },
    limit: { type: 'string' },
  },
})

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

if (!values.session || !SESSION_PATTERN.test(values.session)) fail('--session debe llamarse "smoke-replay-<algo>" (nunca una sesion real).')
const speed = Number(values.speed)
if (!(speed > 0)) fail('--speed debe ser un numero positivo.')
if (!values.url.startsWith('https://')) fail('--url debe ser https.')

const token = readFileSync(values['token-file'], 'utf8').replace(/\s+/g, '')
if (!token) fail('el archivo del token esta vacio.')

const fixture = JSON.parse(readFileSync(values.fixture, 'utf8'))
let events = inArrivalOrder(fixture.events)
if (values.limit) events = events.slice(0, Number(values.limit))

const endpoint = `${values.url}?token=${encodeURIComponent(token)}`
const statuses = {}
const latencies = []
const t0 = arrivalTime(events[0])
const started = performance.now()

console.log(`Reproduciendo ${events.length} eventos en "${values.session}" a x${speed} contra ${values.url}`)

for (const event of events) {
  const dueMs = ((arrivalTime(event) - t0) / speed) * 1000
  const waitMs = dueMs - (performance.now() - started)
  if (waitMs > 0) await sleep(waitMs)

  const sentAt = performance.now()
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toRecallPayload(event, { sessionId: values.session })),
    })
    statuses[response.status] = (statuses[response.status] ?? 0) + 1
  } catch {
    statuses.network = (statuses.network ?? 0) + 1
  }
  latencies.push(performance.now() - sentAt)
}

const wallSec = (performance.now() - started) / 1000
const spanSec = arrivalTime(events.at(-1)) - t0
const sorted = [...latencies].sort((a, b) => a - b)
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]

console.log('--- resumen')
console.log('respuestas HTTP:', JSON.stringify(statuses))
console.log(`sesion reproducida: ${spanSec.toFixed(1)} s en ${wallSec.toFixed(1)} s (velocidad efectiva x${(spanSec / wallSec).toFixed(1)})`)
console.log(`latencia por peticion: media ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0)} ms, p95 ${pct(0.95).toFixed(0)} ms, max ${sorted.at(-1).toFixed(0)} ms`)

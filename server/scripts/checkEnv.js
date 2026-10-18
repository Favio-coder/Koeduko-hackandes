#!/usr/bin/env node
/**
 * Compara el manifiesto de variables (src/envManifest.js) con un entorno y dice que falta. Imprime SOLO
 * NOMBRES, nunca valores.
 *
 *   npm run check:env                      entorno del proceso (process.env), solo el servidor
 *   npm run check:env -- --target all      servidor y frontend
 *   npm run check:env -- --vercel production   nombres de las variables de ese entorno en el proyecto de Vercel
 *                                              enlazado a esta carpeta (usa `vercel env ls`; los valores no se leen)
 *   npm run check:env -- --file ruta       nombres de las variables definidas en un archivo .env (sin leer valores)
 *
 * Sale con codigo 1 si falta una variable OBLIGATORIA, para poder usarlo en un chequeo previo al despliegue.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { ENV_MANIFEST, checkEnv } from '../src/envManifest.js'

const { values } = parseArgs({
  options: {
    target: { type: 'string', default: 'server' },
    vercel: { type: 'string' },
    file: { type: 'string' },
  },
})

if (!['server', 'frontend', 'all'].includes(values.target)) {
  console.error('--target debe ser server, frontend o all.')
  process.exit(2)
}

/** Nombres de la tabla de `vercel env ls`: primera columna de cada fila que parece una variable. */
function namesFromVercel(environment) {
  const output = execFileSync('vercel', ['env', 'ls', environment], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true })
  return output
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((token) => /^[A-Z][A-Z0-9_]*$/.test(token))
}

/** Nombres definidos (con algo despues del =) en un archivo; los valores se descartan al leer. */
function namesFromFile(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/))
    .filter((match) => match && match[2].trim() !== '')
    .map((match) => match[1])
}

let present
let origin
try {
  if (values.vercel) {
    present = namesFromVercel(values.vercel)
    origin = `Vercel (${values.vercel})`
  } else if (values.file) {
    present = namesFromFile(values.file)
    origin = `archivo ${values.file}`
  } else {
    present = Object.entries(process.env)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([name]) => name)
    origin = 'entorno del proceso'
  }
} catch (error) {
  console.error(`No pude leer el entorno (${error.message.split('\n')[0]}).`)
  process.exit(2)
}

const result = checkEnv({ target: values.target, present })
const total = ENV_MANIFEST.filter((e) => values.target === 'all' || e.target === values.target).length

console.log(`Entorno: ${origin} · objetivo: ${values.target} · ${result.ok.length}/${total} definidas`)
if (result.ok.length > 0) console.log(`  definidas:          ${result.ok.map((e) => e.name).join(', ')}`)
if (result.missingRequired.length > 0) console.log(`  FALTAN OBLIGATORIAS: ${result.missingRequired.map((e) => e.name).join(', ')}`)
if (result.missingOptional.length > 0) console.log(`  faltan opcionales:   ${result.missingOptional.map((e) => e.name).join(', ')}`)
if (values.vercel) console.log('  (los secretos de Vercel no se pueden leer: solo se comprueba que existan)')

process.exit(result.missingRequired.length > 0 ? 1 : 0)

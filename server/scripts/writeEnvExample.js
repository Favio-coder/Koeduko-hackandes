#!/usr/bin/env node
/**
 * Genera los .env.example a partir del manifiesto (src/envManifest.js), sin valores:
 *   server/.env.example   las variables del backend, con su proposito, donde se obtienen y si son secretas
 *   .env.example          solo las VITE_ publicas del frontend (raiz del repositorio)
 *
 *   npm --prefix server run env:example
 *
 * Sobrescribe esos dos archivos: son generados, no se editan a mano (editar el manifiesto y volver a correr esto).
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderEnvExample } from '../src/envManifest.js'

const targets = [
  { target: 'server', path: fileURLToPath(new URL('../.env.example', import.meta.url)) },
  { target: 'frontend', path: fileURLToPath(new URL('../../.env.example', import.meta.url)) },
]

for (const { target, path } of targets) {
  writeFileSync(path, renderEnvExample(target), 'utf8')
  console.log(`Escrito ${path}`)
}

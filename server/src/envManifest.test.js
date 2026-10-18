import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ENV_MANIFEST, SYSTEM_ENV, checkEnv, renderEnvExample } from './envManifest.js'

const serverRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = join(serverRoot, '..')

/** Todos los .js/.jsx de una carpeta, sin tests ni node_modules. */
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === '.vercel') return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(js|jsx)$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

const namesIn = (files, pattern) => [...new Set(files.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(pattern)].map((m) => m[1])))]
const manifestNames = (target) => ENV_MANIFEST.filter((e) => e.target === target).map((e) => e.name)

describe('the manifest covers every variable the code reads', () => {
  it('server: every process.env.X / env.X in api/, src/ and scripts/ is in the manifest', () => {
    const files = ['api', 'src', 'scripts'].flatMap((dir) => sourceFiles(join(serverRoot, dir)))
    const used = namesIn(files, /(?:process\.env|\benv)\.([A-Z][A-Z0-9_]{2,})/g).filter((name) => !SYSTEM_ENV.includes(name))
    const missing = used.filter((name) => !manifestNames('server').includes(name))
    expect(missing, `variables que el codigo del servidor usa y el manifiesto no declara: ${missing.join(', ')}`).toEqual([])
  })

  it('frontend: every import.meta.env.VITE_X in src/ is in the manifest', () => {
    const files = sourceFiles(join(repoRoot, 'src'))
    const used = namesIn(files, /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)
    const missing = used.filter((name) => !manifestNames('frontend').includes(name))
    expect(missing, `variables VITE_ que el frontend usa y el manifiesto no declara: ${missing.join(', ')}`).toEqual([])
  })

  it('the manifest does not declare variables nobody reads (dead entries)', () => {
    const serverFiles = ['api', 'src', 'scripts'].flatMap((dir) => sourceFiles(join(serverRoot, dir)))
    const frontFiles = sourceFiles(join(repoRoot, 'src'))
    const usedServer = namesIn(serverFiles, /(?:process\.env|\benv)\.([A-Z][A-Z0-9_]{2,})/g)
    const usedFront = namesIn(frontFiles, /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)
    const dead = ENV_MANIFEST.filter((e) => !(e.target === 'server' ? usedServer : usedFront).includes(e.name)).map((e) => e.name)
    expect(dead, `variables declaradas que ningun archivo lee: ${dead.join(', ')} (${relative(repoRoot, serverRoot)})`).toEqual([])
  })
})

describe('manifest rules', () => {
  it('has unique names, a purpose and a source for each, and only public variables for the frontend', () => {
    const names = ENV_MANIFEST.map((e) => e.name)
    expect(new Set(names).size).toBe(names.length)
    for (const entry of ENV_MANIFEST) {
      expect(entry.purpose.length).toBeGreaterThan(10)
      expect(entry.source.length).toBeGreaterThan(3)
    }
    for (const entry of ENV_MANIFEST.filter((e) => e.target === 'frontend')) {
      expect(entry.name).toMatch(/^VITE_/)
      expect(entry.secret).toBe(false)
    }
  })

  it('marks every credential as secret', () => {
    for (const name of ['FIREBASE_SERVICE_ACCOUNT_B64', 'RECALL_API_KEY', 'RECALL_WEBHOOK_TOKEN', 'GEMINI_API_KEY', 'ATOMICMEMORY_API_KEY']) {
      expect(ENV_MANIFEST.find((e) => e.name === name).secret).toBe(true)
    }
  })
})

describe('checkEnv', () => {
  it('reports what is missing by name only, split into required and optional', () => {
    const result = checkEnv({ target: 'server', present: ['RECALL_API_KEY', 'GEMINI_API_KEY'] })
    expect(result.ok.map((e) => e.name)).toEqual(['RECALL_API_KEY', 'GEMINI_API_KEY'])
    expect(result.missingRequired.map((e) => e.name)).toContain('FIREBASE_SERVICE_ACCOUNT_B64')
    expect(result.missingRequired.map((e) => e.name)).not.toContain('RECALL_API_KEY')
    expect(result.missingOptional.map((e) => e.name)).toContain('MEMORY_ENABLED')
    // solo devuelve entradas del manifiesto (nombre, proposito...): jamas un valor del entorno
    for (const entry of [...result.ok, ...result.missingRequired, ...result.missingOptional]) expect(ENV_MANIFEST).toContain(entry)
  })

  it('separates the targets', () => {
    expect(checkEnv({ target: 'frontend', present: [] }).missingRequired.every((e) => e.name.startsWith('VITE_'))).toBe(true)
    expect(checkEnv({ target: 'server', present: [] }).missingRequired.some((e) => e.name.startsWith('VITE_'))).toBe(false)
  })

  it('has nothing missing when every required variable is present', () => {
    const present = ENV_MANIFEST.filter((e) => e.required).map((e) => e.name)
    expect(checkEnv({ target: 'all', present }).missingRequired).toEqual([])
  })
})

describe('renderEnvExample', () => {
  it('has one empty assignment per variable, with its purpose, where to get it and whether it is secret', () => {
    const text = renderEnvExample('server')
    for (const entry of ENV_MANIFEST.filter((e) => e.target === 'server')) {
      expect(text).toContain(`\n${entry.name}=\n`)
      expect(text).toContain(`# ${entry.purpose}`)
    }
    expect(text).toContain('# SECRETA · Obligatoria')
    expect(text).toContain('# No secreta · Opcional · Por defecto: true')
  })

  it('never contains a value after an equals sign', () => {
    for (const target of ['server', 'frontend']) {
      const assignments = renderEnvExample(target).split('\n').filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      expect(assignments.length).toBeGreaterThan(0)
      for (const line of assignments) expect(line.endsWith('=')).toBe(true)
    }
  })

  it('the frontend example only has public VITE_ variables', () => {
    const names = renderEnvExample('frontend').split('\n').filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l)).map((l) => l.slice(0, -1))
    expect(names.length).toBeGreaterThan(0)
    expect(names.every((n) => n.startsWith('VITE_'))).toBe(true)
  })
})

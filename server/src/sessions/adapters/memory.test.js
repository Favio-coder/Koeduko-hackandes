import { describe, expect, it, vi } from 'vitest'
import { createAtomicMemory, notesFromSearch } from './atomicMemory.js'
import { createFirestoreMemory } from './firestoreMemory.js'
import { createMemory } from './memory.js'

/** La respuesta REAL de POST /v1/memories/search/fast, observada contra api.atomicstrata.ai (recortada). */
const realSearchResponse = {
  count: 1,
  memories: [
    {
      id: '1d548a6a-da67-426c-8787-0e4d63f62347',
      content: 'Sesión prueba-http, multiplicación: comunicó 40% del tiempo; usó estrategia correcta.',
      type: null,
      session_id: 'kdk-probe-http-1792293947065',
      source_site: 'koeduko-tutor',
      importance: 0.5,
      created_at: '2026-10-18T03:25:49.382Z',
      score: 1.0360315,
      similarity: 0.52206314,
    },
  ],
  citations: ['1d548a6a-da67-426c-8787-0e4d63f62347'],
  retrieval_mode: 'flat',
}
/** La respuesta REAL de POST /v1/memories/ingest/quick (201). */
const realIngestResponse = { episode_id: 'e08050d0', facts_extracted: 1, memories_stored: 1, stored_memory_ids: ['1d548a6a'], updated_memory_ids: [] }

const reply = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json })

/** fetch falso que enruta por ruta. */
function fakeFetch({ ingest = reply(201, realIngestResponse), search = reply(200, realSearchResponse) } = {}) {
  return vi.fn(async (url, init) => {
    if (url.endsWith('/memories/ingest/quick')) return typeof ingest === 'function' ? ingest(init) : ingest
    if (url.endsWith('/memories/search/fast')) return typeof search === 'function' ? search(init) : search
    throw new Error(`ruta inesperada ${url}`)
  })
}
const hangs = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))

const atomic = (fetchImpl, extra = {}) => createAtomicMemory({ apiUrl: 'https://api.test/', apiKey: 'secret-key', fetchImpl, logger: { info: vi.fn() }, ...extra })
const bodyOf = (fetchImpl, index = 0) => JSON.parse(fetchImpl.mock.calls[index][1].body)

describe('notesFromSearch', () => {
  it('reads the texts from the real response shape', () => {
    expect(notesFromSearch(realSearchResponse)).toEqual(['Sesión prueba-http, multiplicación: comunicó 40% del tiempo; usó estrategia correcta.'])
  })

  it('does not trust the shape: skips non-strings, duplicates and empties, and caps the count and length', () => {
    const item = (content) => ({ content })
    const notes = notesFromSearch({ memories: [item('a'), item('a'), item(5), item('  '), {}, null, item('b'), item('c'), item('d')] })
    expect(notes).toEqual(['a', 'b', 'c'])
    expect(notesFromSearch({ memories: [item('x'.repeat(500))] })[0]).toHaveLength(240)
  })

  it.each([[null], [undefined], [{}], [{ memories: 'no' }], ['texto']])('returns [] for %j', (response) => {
    expect(notesFromSearch(response)).toEqual([])
  })
})

describe('createAtomicMemory (plain HTTP, no SDK)', () => {
  it('remembers a short factual summary, declared as a summary (the deployment refuses raw content)', async () => {
    const fetchImpl = fakeFetch()
    await expect(atomic(fetchImpl).remember('u1', 'Sesión s1: comunicó 28% del tiempo.')).resolves.toEqual({ ok: true })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.test/v1/memories/ingest/quick')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer secret-key')
    expect(bodyOf(fetchImpl)).toEqual({
      user_id: 'u1',
      conversation: 'Sesión s1: comunicó 28% del tiempo.',
      source_site: 'koeduko-tutor',
      source_url: '',
      skip_extraction: true,
      content_class: 'summary',
    })
  })

  it('recalls the notes for the student with a small limit', async () => {
    const fetchImpl = fakeFetch()
    await expect(atomic(fetchImpl).recall('u1', '¿cómo le fue?')).resolves.toHaveLength(1)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/v1/memories/search/fast')
    expect(bodyOf(fetchImpl)).toEqual({ user_id: 'u1', query: '¿cómo le fue?', limit: 3 })
  })

  it('reports the server refusal of raw content as a failure, with only the HTTP status', async () => {
    const logger = { info: vi.fn() }
    const fetchImpl = fakeFetch({ ingest: reply(502, { error: { code: 'upstream_error', message: 'refuses raw/unstamped content' } }) })
    await expect(atomic(fetchImpl, { logger }).remember('u1', 'texto')).resolves.toEqual({ ok: false, reason: 'http:502' })
    expect(logger.info).toHaveBeenCalledWith('atomicMemory: remember fallo', { reason: 'http:502' })
  })

  it('recall never throws: it returns [] on an HTTP error or a dropped connection, and logs only the reason', async () => {
    const logger = { info: vi.fn() }
    await expect(atomic(fakeFetch({ search: reply(500, null) }), { logger }).recall('u1', 'q')).resolves.toEqual([])
    await expect(atomic(vi.fn().mockRejectedValue(new Error('ECONNRESET secret-key')), { logger }).recall('u1', 'q')).resolves.toEqual([])
    expect(logger.info.mock.calls.map((c) => c[1].reason)).toEqual(['http:500', 'network'])
    expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/secret-key|u1/)
  })

  it('cuts the request when it takes longer than the timeout (recall -> [], remember -> timeout)', async () => {
    const memory = atomic(vi.fn(hangs))
    const started = Date.now()
    await expect(memory.recall('u1', 'q', { timeoutMs: 30 })).resolves.toEqual([])
    await expect(memory.remember('u1', 'texto', { timeoutMs: 30 })).resolves.toEqual({ ok: false, reason: 'timeout' })
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('handles a 200 with an unreadable body as no notes', async () => {
    const broken = { ok: true, status: 200, json: async () => { throw new Error('bad json') } }
    await expect(atomic(fakeFetch({ search: broken })).recall('u1', 'q')).resolves.toEqual([])
  })

  it('rejects empty or oversized input without calling the network', async () => {
    const fetchImpl = fakeFetch()
    const memory = atomic(fetchImpl)
    await expect(memory.remember('', 'texto')).resolves.toEqual({ ok: false, reason: 'invalid' })
    await expect(memory.remember('u1', '  ')).resolves.toEqual({ ok: false, reason: 'invalid' })
    await expect(memory.remember('u1', 'x'.repeat(501))).resolves.toEqual({ ok: false, reason: 'invalid' })
    await expect(memory.recall('u1', '  ')).resolves.toEqual([])
    await expect(memory.recall('', 'q')).resolves.toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

function fakeFirestore({ docs = [], addFails = false, getFails = false } = {}) {
  const added = []
  const queries = []
  const db = {
    collection: (path) => ({
      add: vi.fn(async (data) => {
        if (addFails) throw Object.assign(new Error('x'), { code: 14 })
        added.push({ path, data })
      }),
      orderBy: (field, direction) => ({
        limit: (n) => ({
          get: async () => {
            queries.push({ path, field, direction, n })
            if (getFails) throw Object.assign(new Error('x'), { code: 14 })
            return { docs: docs.map((data) => ({ data: () => data })) }
          },
        }),
      }),
    }),
  }
  return { firebase: { db, FieldValue: { serverTimestamp: () => 'TS' }, logger: { info: vi.fn() } }, added, queries }
}

describe('createFirestoreMemory (fallback, same interface)', () => {
  it('remembers in students/{key}/memory with a server timestamp, and sanitizes the key', async () => {
    const { firebase, added } = fakeFirestore()
    const memory = createFirestoreMemory(firebase)
    await expect(memory.remember('aula/1:abc', 'texto')).resolves.toEqual({ ok: true })
    expect(added).toEqual([{ path: 'students/aula_1:abc/memory', data: { text: 'texto', createdAt: 'TS' } }])
  })

  it('recalls the most recent notes (up to 3), newest first', async () => {
    const { firebase, queries } = fakeFirestore({ docs: [{ text: 'nueva' }, { text: 'vieja' }, { nada: 1 }] })
    await expect(createFirestoreMemory(firebase).recall('u1', 'q')).resolves.toEqual(['nueva', 'vieja'])
    expect(queries).toEqual([{ path: 'students/u1/memory', field: 'createdAt', direction: 'desc', n: 3 }])
  })

  it('never throws', async () => {
    const memory = createFirestoreMemory(fakeFirestore({ addFails: true, getFails: true }).firebase)
    await expect(memory.remember('u1', 'texto')).resolves.toEqual({ ok: false, reason: 'error:14' })
    await expect(memory.recall('u1', 'q')).resolves.toEqual([])
  })
})

describe('createMemory (primary + fallback)', () => {
  const provider = (name, { remember = { ok: true }, recall = [] } = {}) => ({ name, remember: vi.fn().mockResolvedValue(remember), recall: vi.fn().mockResolvedValue(recall) })

  it('uses the primary when it works and does not touch the fallback', async () => {
    const primary = provider('atomicmemory', { recall: ['nota'] })
    const fallback = provider('firestore')
    const memory = createMemory({ primary, fallback })
    await expect(memory.remember('u1', 't')).resolves.toEqual({ ok: true, via: 'atomicmemory' })
    await expect(memory.recall('u1', 'q')).resolves.toEqual(['nota'])
    expect(fallback.remember).not.toHaveBeenCalled()
    expect(fallback.recall).not.toHaveBeenCalled()
  })

  it('saves in the fallback when the primary fails, so the memory is not lost', async () => {
    const primary = provider('atomicmemory', { remember: { ok: false, reason: 'timeout' } })
    const fallback = provider('firestore')
    await expect(createMemory({ primary, fallback }).remember('u1', 't')).resolves.toEqual({ ok: true, via: 'firestore', primaryReason: 'timeout' })
  })

  it('does not fall back for invalid input, and reports when both fail', async () => {
    const invalid = provider('atomicmemory', { remember: { ok: false, reason: 'invalid' } })
    const fallback = provider('firestore')
    await createMemory({ primary: invalid, fallback }).remember('', 't')
    expect(fallback.remember).not.toHaveBeenCalled()

    const both = createMemory({ primary: provider('a', { remember: { ok: false, reason: 'timeout' } }), fallback: provider('f', { remember: { ok: false, reason: 'error:14' } }) })
    await expect(both.remember('u1', 't')).resolves.toEqual({ ok: false, via: 'f', reason: 'error:14', primaryReason: 'timeout' })
  })

  it('recalls from the fallback when the primary has nothing (it may have been down when it was saved)', async () => {
    const memory = createMemory({ primary: provider('a', { recall: [] }), fallback: provider('f', { recall: ['guardada en respaldo'] }) })
    await expect(memory.recall('u1', 'q')).resolves.toEqual(['guardada en respaldo'])
  })

  it('works without a fallback', async () => {
    const memory = createMemory({ primary: provider('atomicmemory', { remember: { ok: false, reason: 'timeout' } }) })
    expect(memory.name).toBe('atomicmemory')
    await expect(memory.remember('u1', 't')).resolves.toEqual({ ok: false, reason: 'timeout', via: 'atomicmemory' })
    await expect(memory.recall('u1', 'q')).resolves.toEqual([])
  })
})

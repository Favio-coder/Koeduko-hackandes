import { describe, expect, it, vi } from 'vitest'
import { memoryCacheKey, studentKeyOf } from './core/studentKey.js'
import { createAfterLiveEventSaved } from './afterLiveEventSaved.js'
import { createSessionStore } from './adapters/sessionStore.js'

const signal = { type: 'SILENT_PEER', participantKey: 'estudiante b', studentId: null, t: 55, evidence: { shares: { 'estudiante a': 1, 'estudiante b': 0 } } }
const problem = { activityId: 'p-01', skillId: 'multiplication', text: '¿Cuántos lápices hay en total?', expectedAnswer: 48 }
const KEY = studentKeyOf({ participantKey: 'estudiante b', scope: 'docente-1' })

function setup({ memory, context = {}, store = {} } = {}) {
  const fakeStore = {
    createIntervention: vi.fn().mockResolvedValue({ created: true }),
    getSession: vi.fn().mockResolvedValue({ createdBy: 'docente-1' }),
    cacheMemoryNotes: vi.fn().mockResolvedValue(undefined),
    ...store,
  }
  const generate = vi.fn().mockResolvedValue('Estudiante B, ¿cómo explicarías tú el problema con tus palabras?')
  const logger = { info: vi.fn() }
  const hook = createAfterLiveEventSaved({ getStore: () => fakeStore, getGenerate: () => generate, getMemory: () => memory, logger, now: () => 1000 })
  const run = () => hook({ sessionId: 's2', result: { evaluated: true, intervention: signal, context: { problem, transcriptTail: [], ...context } } })
  return { run, store: fakeStore, generate, logger }
}

describe('memoryCacheKey', () => {
  it('turns a studentKey into a safe Firestore field name', () => {
    expect(memoryCacheKey('uid-123')).toBe('uid-123')
    expect(memoryCacheKey('docente-1:0123456789abcdef')).toBe('docente-1_0123456789abcdef')
    expect(memoryCacheKey('a.b/c d')).toBe('a_b_c_d')
  })
})

describe('recall cache (per student and per session, in live/state.memory)', () => {
  it('on a miss it recalls, caches what it recalled, and the notes reach the prompt', async () => {
    const memory = { recall: vi.fn().mockResolvedValue(['Sesión s1: usó estrategia correcta.']) }
    const { run, store, generate, logger } = setup({ memory })
    await run()

    expect(memory.recall).toHaveBeenCalledTimes(1)
    expect(store.cacheMemoryNotes).toHaveBeenCalledWith('s2', KEY, ['Sesión s1: usó estrategia correcta.'])
    expect(generate.mock.calls[0][0].userPrompt).toContain('- «Sesión s1: usó estrategia correcta.»')
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ memoryNotes: 1, memoryCache: 'miss' }))
  })

  it('on a hit it does NOT call the memory again and still gives the notes to the prompt', async () => {
    const memory = { recall: vi.fn() }
    const { run, store, generate, logger } = setup({ memory, context: { memory: { [memoryCacheKey(KEY)]: ['nota cacheada'] } } })
    await run()

    expect(memory.recall).not.toHaveBeenCalled()
    expect(store.cacheMemoryNotes).not.toHaveBeenCalled()
    expect(generate.mock.calls[0][0].userPrompt).toContain('- «nota cacheada»')
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ memoryNotes: 1, memoryCache: 'hit' }))
  })

  it('does not mix students: the cache of another student is not a hit', async () => {
    const memory = { recall: vi.fn().mockResolvedValue([]) }
    const { run } = setup({ memory, context: { memory: { [memoryCacheKey('otro:abc')]: ['de otro'] } } })
    await run()
    expect(memory.recall).toHaveBeenCalledTimes(1)
  })

  it('never caches an empty result: [] also means "it failed or was slow", and caching it would remove the memory for the whole session', async () => {
    const memory = { recall: vi.fn().mockResolvedValue([]) }
    const { run, store } = setup({ memory })
    await run()
    expect(store.cacheMemoryNotes).not.toHaveBeenCalled()
  })

  it('a cached empty array from an older state is still a hit (nothing to recall)', async () => {
    const memory = { recall: vi.fn() }
    const { run } = setup({ memory, context: { memory: { [memoryCacheKey(KEY)]: [] } } })
    await run()
    expect(memory.recall).not.toHaveBeenCalled()
  })

  it('still speaks, with the notes, when the cache cannot be written', async () => {
    const memory = { recall: vi.fn().mockResolvedValue(['nota']) }
    const { run, generate, store } = setup({ memory, store: { cacheMemoryNotes: vi.fn().mockRejectedValue(new Error('firestore')) } })
    await expect(run()).resolves.toBeUndefined()
    expect(generate.mock.calls[0][0].userPrompt).toContain('- «nota»')
    expect(store.createIntervention).toHaveBeenCalledTimes(1)
  })

  it('reports "off" in the log when there is no memory', async () => {
    const { run, logger } = setup({ memory: null })
    await run()
    expect(logger.info).toHaveBeenCalledWith('afterLiveEventSaved: intervencion', expect.objectContaining({ memoryNotes: 0, memoryCache: 'off' }))
  })
})

describe('store: the cache lives in live/state', () => {
  it('writes one field of live/state.memory with an update, without touching the rest of the state', async () => {
    const updates = []
    const db = { doc: (path) => ({ path, update: vi.fn(async (data) => updates.push({ path, data })) }) }
    await createSessionStore({ db, FieldValue: {} }).cacheMemoryNotes('s2', 'docente-1:abc', ['nota'])
    expect(updates).toEqual([{ path: 'learningSessions/s2/live/state', data: { 'memory.docente-1_abc': ['nota'] } }])
  })

  it('hands the cached notes to the hook in the context of an intervention, and keeps them in the state it writes back', async () => {
    const session = { currentProblem: { id: 'p-03', text: '6 x 8', skillId: 'm', expectedAnswer: 48 } }
    const state = {
      v: 1, lastT: 8, lastEvalT: 0, lastSpeechT: 8, speaker: null,
      presence: [{ k: 'a', s: 0 }, { k: 'b', s: 0 }], intervals: [], students: [], interventions: [],
      transcripts: [{ k: 'b', t: 3, e: 4, x: 'hola' }], problem: { id: 'p-03', startedT: 0 }, answer: { id: 'p-03', v: 48 },
      memory: { 'docente-1_abc': ['nota cacheada'] },
    }
    const docs = { 'learningSessions/s1': session, 'learningSessions/s1/live/state': state }
    const writes = []
    const db = {
      doc: (path) => ({ path }),
      runTransaction: async (fn) =>
        fn({
          get: async (ref) => ({ exists: ref.path in docs, data: () => structuredClone(docs[ref.path]) }),
          set: (ref, data) => writes.push({ path: ref.path, data }),
        }),
    }
    const result = await createSessionStore({ db, FieldValue: { serverTimestamp: () => 'TS' } }).processLiveEvent('s1', 'e9', {
      type: 'transcript', participantKey: 'a', studentId: null, t: 9, tEnd: 10, text: 'son cuarenta y ocho',
    })

    expect(result.context.memory).toEqual({ 'docente-1_abc': ['nota cacheada'] })
    expect(writes.find((w) => w.path === 'learningSessions/s1/live/state').data.memory).toEqual({ 'docente-1_abc': ['nota cacheada'] })
    // y la vista para la pantalla no lleva la memoria
    expect(JSON.stringify(writes.find((w) => w.path === 'learningSessions/s1/live/view').data)).not.toContain('nota cacheada')
  })
})

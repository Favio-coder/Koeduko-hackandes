import { describe, expect, it, vi } from 'vitest'
import { closeSession } from './closeSession.js'
import { createAtomicMemory } from './adapters/atomicMemory.js'
import { createMemory } from './adapters/memory.js'
import { forgetMemoryNote } from './forgetMemoryNote.js'
import { memoryQueryOf } from './core/memoryText.js'
import { studentKeyOf } from './core/studentKey.js'

const A = 'estudiante a'
const B = 'estudiante b'
const session = { createdBy: 'docente-1', classroomId: 'aula-1', status: 'completed' }
const keyOfA = studentKeyOf({ participantKey: A, scope: 'aula-1' })

function setup({ sess = session, notes, refs, memory, store = {} } = {}) {
  const fakeStore = {
    getSession: vi.fn().mockResolvedValue(sess),
    getSummary: vi.fn().mockResolvedValue({
      report: {},
      memoryNotes: notes ?? [
        { key: A, text: 'Sesión s1, multiplicación: comunicó 75% del tiempo.', status: 'saved', via: 'atomicmemory', forgettable: true },
        { key: B, text: 'Sesión s1, multiplicación: comunicó 25% del tiempo.', status: 'failed', forgettable: false },
      ],
    }),
    getMemoryRefs: vi.fn().mockResolvedValue(refs ?? [{ key: A, studentKey: keyOfA, via: 'atomicmemory', id: 'mem-a' }]),
    markMemoryForgotten: vi.fn().mockResolvedValue(undefined),
    ...store,
  }
  const deps = {
    store: fakeStore,
    memory: memory === undefined ? { forget: vi.fn().mockResolvedValue({ ok: true }) } : memory,
    logger: { info: vi.fn() },
  }
  return { deps, store: fakeStore, run: (input = {}) => forgetMemoryNote({ sessionId: 's1', participantKey: A, uid: 'docente-1', ...deps, ...input }) }
}

describe('forgetMemoryNote', () => {
  it('forgets the note of that student with the key and id the SERVER saved at close, and marks it forgotten', async () => {
    const { run, deps, store } = setup()
    await expect(run()).resolves.toEqual({ status: 'forgotten', key: A, alreadyForgotten: false })
    expect(deps.memory.forget).toHaveBeenCalledWith(keyOfA, { via: 'atomicmemory', id: 'mem-a' })
    expect(store.markMemoryForgotten).toHaveBeenCalledWith('s1', A)
  })

  it('only the teacher who created the room can forget: another teacher gets 403 and nothing is deleted', async () => {
    const { run, deps, store } = setup()
    await expect(run({ uid: 'docente-2' })).rejects.toMatchObject({ code: 'permission-denied' })
    expect(store.getMemoryRefs).not.toHaveBeenCalled()
    expect(deps.memory.forget).not.toHaveBeenCalled()
  })

  it('never deletes a note of a student the server has no reference for (the browser cannot name a memory key)', async () => {
    const { run, deps } = setup()
    await expect(run({ participantKey: B })).rejects.toMatchObject({ code: 'not-found' })
    await expect(run({ participantKey: keyOfA })).rejects.toMatchObject({ code: 'not-found' })
    expect(deps.memory.forget).not.toHaveBeenCalled()
  })

  it('when the memory fails or times out, says the note is STILL saved and does not mark it forgotten', async () => {
    const failing = setup({ memory: { forget: vi.fn().mockResolvedValue({ ok: false, reason: 'http:503' }) } })
    await expect(failing.run()).rejects.toMatchObject({ code: 'unavailable', message: expect.stringMatching(/sigue guardada/) })
    expect(failing.store.markMemoryForgotten).not.toHaveBeenCalled()
    expect(JSON.stringify(failing.deps.logger.info.mock.calls)).not.toMatch(/mem-a|aula-1:/)

    const hanging = setup({ memory: { forget: () => new Promise(() => {}) } })
    const started = Date.now()
    await expect(hanging.run({ timeoutMs: 30 })).rejects.toMatchObject({ code: 'unavailable' })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(hanging.store.markMemoryForgotten).not.toHaveBeenCalled()
  })

  it('without memory configured on the server, answers that the note is still saved', async () => {
    const { run } = setup({ memory: null })
    await expect(run()).rejects.toMatchObject({ code: 'unavailable', message: expect.stringMatching(/sigue guardada/) })
  })

  it('is idempotent: a note already forgotten is not deleted again', async () => {
    const { run, deps } = setup({ notes: [{ key: A, text: 't', status: 'forgotten', forgettable: false }], refs: [] })
    await expect(run()).resolves.toEqual({ status: 'forgotten', key: A, alreadyForgotten: true })
    expect(deps.memory.forget).not.toHaveBeenCalled()
  })

  it.each([[{ sessionId: '../x' }], [{ sessionId: undefined }], [{ participantKey: '' }], [{ participantKey: 'x'.repeat(201) }], [{ participantKey: 5 }]])(
    'rejects bad input %j before reading anything',
    async (input) => {
      const { run, store } = setup()
      await expect(run(input)).rejects.toMatchObject({ code: 'invalid-argument' })
      expect(store.getSession).not.toHaveBeenCalled()
    },
  )

  it('404 for a session that does not exist', async () => {
    const { run } = setup({ sess: null })
    await expect(run()).rejects.toMatchObject({ code: 'not-found' })
  })
})

/**
 * El flujo real del docente, de punta a punta en el servidor: cerrar la sala guarda una nota por estudiante en
 * AtomicMemory, la sala siguiente la recuerda, el docente la olvida y la sala siguiente ya no la ve. AtomicMemory es
 * un DOBLE EN MEMORIA de su contrato HTTP (ingest/quick, search/fast, DELETE /memories/:id), no el servicio real.
 */
describe('close -> recall -> forget -> recall (AtomicMemory HTTP double)', () => {
  function atomicMemoryDouble() {
    const rows = []
    let next = 1
    const fetchImpl = vi.fn(async (url, init) => {
      const { pathname, searchParams } = new URL(url)
      const json = (status, body) => ({ ok: status < 300, status, json: async () => body })
      if (pathname === '/v1/memories/ingest/quick') {
        const body = JSON.parse(init.body)
        const id = `mem-${next++}`
        rows.push({ id, userId: body.user_id, content: body.conversation })
        return json(201, { stored_memory_ids: [id], memories_stored: 1 })
      }
      if (pathname === '/v1/memories/search/fast') {
        const body = JSON.parse(init.body)
        return json(200, { memories: rows.filter((row) => row.userId === body.user_id).map(({ id, content }) => ({ id, content })) })
      }
      const deleted = /^\/v1\/memories\/([^/]+)$/.exec(pathname)
      if (deleted && init.method === 'DELETE') {
        const index = rows.findIndex((row) => row.id === deleted[1] && row.userId === searchParams.get('user_id'))
        if (index < 0) return json(404, { error: 'Memory not found' })
        rows.splice(index, 1)
        return json(200, { success: true })
      }
      return json(404, { error: 'route' })
    })
    return { rows, fetchImpl }
  }

  it('the forgotten note stops reaching the tutor and the other student keeps theirs', async () => {
    const double = atomicMemoryDouble()
    const memory = createMemory({ primary: createAtomicMemory({ apiUrl: 'http://fixture.local', apiKey: 'test-key', fetchImpl: double.fetchImpl }) })
    const saved = {}
    const store = {
      getSession: vi.fn().mockResolvedValue({ ...session, status: 'scheduled', currentProblem: { activityId: 'p-01', skillId: 'multiplication', text: '6 x 8' } }),
      getLiveState: vi.fn().mockResolvedValue({ lastT: 60, presence: [{ k: A, s: 0 }, { k: B, s: 0 }], totals: [{ k: A, sec: 30, turns: 4 }, { k: B, sec: 10, turns: 2 }], students: [], answer: { id: 'p-01', v: 48 } }),
      getTranscripts: vi.fn().mockResolvedValue([{ k: A, t: 5, e: 7, x: 'seis por ocho' }, { k: B, t: 9, e: 11, x: 'son cuarenta y ocho' }]),
      getAnswer: vi.fn().mockResolvedValue(null),
      getSummary: vi.fn(async () => saved.summary ?? null),
      getMemoryRefs: vi.fn(async () => saved.refs ?? []),
      saveClosure: vi.fn(async (_id, summary, { memoryRefs }) => {
        saved.summary = summary
        saved.refs = memoryRefs
      }),
      markMemoryForgotten: vi.fn(async (_id, key) => {
        saved.refs = saved.refs.filter((ref) => ref.key !== key)
        saved.summary.memoryNotes = saved.summary.memoryNotes.map((note) => (note.key === key ? { ...note, status: 'forgotten', forgettable: false } : note))
      }),
    }

    const closed = await closeSession({ sessionId: 's1', store, memory, logger: { info: vi.fn() } })
    expect(closed.memoryNotes.map(({ key, status, via, forgettable }) => ({ key, status, via, forgettable }))).toEqual([
      { key: A, status: 'saved', via: 'atomicmemory', forgettable: true },
      { key: B, status: 'saved', via: 'atomicmemory', forgettable: true },
    ])
    // El resumen que ve el docente no lleva la clave del estudiante ni el id de la nota: eso queda en private/memory.
    expect(JSON.stringify(saved.summary.memoryNotes)).not.toMatch(/mem-\d|aula-1:/)

    const keyOfB = studentKeyOf({ participantKey: B, scope: 'aula-1' })
    const query = memoryQueryOf({ skillId: 'multiplication' })
    expect(await memory.recall(keyOfA, query)).toHaveLength(1)

    await forgetMemoryNote({ sessionId: 's1', participantKey: A, uid: 'docente-1', store, memory, logger: { info: vi.fn() } })

    expect(await memory.recall(keyOfA, query)).toEqual([])
    expect(await memory.recall(keyOfB, query)).toHaveLength(1)
    expect(saved.summary.memoryNotes.find((note) => note.key === A).status).toBe('forgotten')
  })
})

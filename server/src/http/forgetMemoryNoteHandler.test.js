import { describe, expect, it, vi } from 'vitest'
import { createForgetMemoryNoteHandler } from './forgetMemoryNoteHandler.js'

const FRONT = 'https://koeduko-hackandes.vercel.app'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (data) => {
    res.body = data
    return res
  }
  res.setHeader = (name, value) => {
    res.headers[name] = value
  }
  res.end = () => res
  return res
}

function setup({ role = 'teacher', uid = 'docente-1', forget = vi.fn().mockResolvedValue({ ok: true }) } = {}) {
  const store = {
    getUserRole: vi.fn().mockResolvedValue(role),
    getSession: vi.fn().mockResolvedValue({ createdBy: 'docente-1', status: 'completed' }),
    getSummary: vi.fn().mockResolvedValue({ memoryNotes: [{ key: 'ana', status: 'saved', via: 'atomicmemory', forgettable: true }] }),
    getMemoryRefs: vi.fn().mockResolvedValue([{ key: 'ana', studentKey: 'aula-1:abc', via: 'atomicmemory', id: 'm1' }]),
    markMemoryForgotten: vi.fn().mockResolvedValue(undefined),
  }
  const memory = { forget }
  const deps = {
    getFirebase: () => ({ auth: { verifyIdToken: vi.fn().mockResolvedValue({ uid }) } }),
    createStore: () => store,
    createMemory: () => memory,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    allowedOrigins: [FRONT],
  }
  return { store, memory, deps, handler: createForgetMemoryNoteHandler(deps) }
}

const request = (body = { sessionId: 's1', key: 'ana' }, overrides = {}) => ({ method: 'POST', headers: { authorization: 'Bearer good', origin: FRONT }, body, ...overrides })

describe('forget-memory-note handler', () => {
  it('forgets the note for the teacher who created the room', async () => {
    const { handler, memory } = setup()
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ status: 'forgotten', key: 'ana', alreadyForgotten: false })
    expect(memory.forget).toHaveBeenCalledWith('aula-1:abc', { via: 'atomicmemory', id: 'm1' })
    expect(res.headers['Access-Control-Allow-Origin']).toBe(FRONT)
  })

  it('ignores a studentKey or id sent by the browser: only the server reference is used', async () => {
    const { handler, memory } = setup()
    await handler(request({ sessionId: 's1', key: 'ana', studentKey: 'otra-aula:xyz', id: 'otra-nota', via: 'firestore' }), fakeRes())
    expect(memory.forget).toHaveBeenCalledWith('aula-1:abc', { via: 'atomicmemory', id: 'm1' })
  })

  it('403 for a student and for another teacher; nothing is deleted', async () => {
    for (const options of [{ role: 'student' }, { uid: 'docente-2' }]) {
      const { handler, memory } = setup(options)
      const res = fakeRes()
      await handler(request(), res)
      expect(res.statusCode).toBe(403)
      expect(memory.forget).not.toHaveBeenCalled()
    }
  })

  it('503 with a message that says the note is still saved when the memory fails', async () => {
    const { handler, store } = setup({ forget: vi.fn().mockResolvedValue({ ok: false, reason: 'timeout' }) })
    const res = fakeRes()
    await handler(request(), res)
    expect(res.statusCode).toBe(503)
    expect(res.body.message).toMatch(/sigue guardada/)
    expect(store.markMemoryForgotten).not.toHaveBeenCalled()
  })

  it('401 without a token and 405 for other methods', async () => {
    const { handler } = setup()
    const noToken = fakeRes()
    await handler(request(undefined, { headers: { origin: FRONT } }), noToken)
    expect(noToken.statusCode).toBe(401)
    const get = fakeRes()
    await handler(request(undefined, { method: 'GET' }), get)
    expect(get.statusCode).toBe(405)
  })
})

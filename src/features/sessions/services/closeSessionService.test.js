import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'id-token' } } }))

import { closeSession } from './closeSessionService'

const reply = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json })

describe('closeSession (service)', () => {
  it('posts only the session id to /api/close-session with the ID token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { status: 'completed', alreadyClosed: false, report: { v: 1 }, steps: {} }))
    const result = await closeSession({ sessionId: 's1' }, { fetchImpl })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toMatch(/\/api\/close-session$/)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer id-token')
    expect(JSON.parse(init.body)).toEqual({ sessionId: 's1' })
    expect(result.report).toEqual({ v: 1 })
  })

  it('rejects without a session id, before any request', async () => {
    const fetchImpl = vi.fn()
    await expect(closeSession({ sessionId: '' }, { fetchImpl })).rejects.toThrow('sessionId es obligatorio')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('throws the server message when it refuses (for example, a student)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(403, { error: 'permission-denied', message: 'Solo el docente puede hacer esto.' }))
    await expect(closeSession({ sessionId: 's1' }, { fetchImpl })).rejects.toThrow('Solo el docente puede hacer esto.')
  })

  it('throws if the server answers 200 without a report', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { status: 'completed' }))
    await expect(closeSession({ sessionId: 's1' }, { fetchImpl })).rejects.toThrow('no devolvió el reporte')
  })
})

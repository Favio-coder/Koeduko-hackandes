import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'id-token' } } }))

import { forgetMemoryNote } from './memoryNotesService'

const reply = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json })

describe('forgetMemoryNote (service)', () => {
  it('posts only the session and the participant to /api/forget-memory-note with the ID token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { status: 'forgotten', key: 'estudiante a', alreadyForgotten: false }))
    await expect(forgetMemoryNote({ sessionId: 's1', key: 'estudiante a' }, { fetchImpl })).resolves.toMatchObject({ status: 'forgotten' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toMatch(/\/api\/forget-memory-note$/)
    expect(init.headers.Authorization).toBe('Bearer id-token')
    expect(JSON.parse(init.body)).toEqual({ sessionId: 's1', key: 'estudiante a' })
  })

  it.each([[null], [{}], [{ status: 'forgotten', key: 'otro' }], [{ status: 'pending', key: 'estudiante a' }]])(
    'never reports forgotten from a 200 without a matching confirmation (%j)',
    async (body) => {
      const fetchImpl = vi.fn().mockResolvedValue(reply(200, body))
      await expect(forgetMemoryNote({ sessionId: 's1', key: 'estudiante a' }, { fetchImpl })).rejects.toThrow(/puede seguir guardada/)
    },
  )

  it('shows the server message when the memory did not answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(503, { error: 'unavailable', message: 'No se pudo olvidar la nota: sigue guardada.' }))
    await expect(forgetMemoryNote({ sessionId: 's1', key: 'estudiante a' }, { fetchImpl })).rejects.toThrow('sigue guardada')
  })

  it('rejects without a session or a participant, before any request', async () => {
    const fetchImpl = vi.fn()
    await expect(forgetMemoryNote({ sessionId: 's1', key: '' }, { fetchImpl })).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

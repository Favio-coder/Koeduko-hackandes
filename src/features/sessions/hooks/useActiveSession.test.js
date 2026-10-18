import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/firebase', () => ({ db: {} }))

import { ACTIVE_LOOKUP_LIMIT, pickActiveSession, useActiveSession } from './useActiveSession'

const at = (ms) => ({ toMillis: () => ms })
const session = (id, status, ms) => ({ id, status, createdAt: at(ms) })

describe('pickActiveSession', () => {
  it('prefers the live one, then the newest scheduled, then the newest that is not cancelled', () => {
    expect(pickActiveSession([session('old-live', 'live', 1), session('new-sched', 'scheduled', 9), session('new-live', 'live', 5)])).toBe('new-live')
    expect(pickActiveSession([session('done', 'completed', 9), session('s1', 'scheduled', 2), session('s2', 'scheduled', 4)])).toBe('s2')
    expect(pickActiveSession([session('c', 'cancelled', 9), session('d1', 'completed', 1), session('d2', 'completed', 3)])).toBe('d2')
  })

  it('returns null when there is nothing, or everything is cancelled', () => {
    expect(pickActiveSession([])).toBeNull()
    expect(pickActiveSession([session('c', 'cancelled', 1)])).toBeNull()
  })

  it('does not break on a session without createdAt (just written, or old)', () => {
    expect(pickActiveSession([{ id: 'x', status: 'scheduled' }, session('y', 'scheduled', 5)])).toBe('y')
  })

  it('does not mutate its input', () => {
    const list = [session('a', 'scheduled', 1), session('b', 'scheduled', 2)]
    pickActiveSession(list)
    expect(list.map((s) => s.id)).toEqual(['a', 'b'])
  })
})

function fakeFirestore({ docs = [], error = null } = {}) {
  const calls = []
  const deps = {
    db: {},
    collection: (_db, name) => ({ name }),
    orderBy: (field, direction) => ({ orderBy: [field, direction] }),
    where: (field, op, value) => ({ where: [field, op, value] }),
    limit: (n) => ({ limit: n }),
    query: (ref, ...constraints) => ({ ref, constraints }),
    getDocs: vi.fn(async (request) => {
      calls.push(request)
      if (error) throw error
      return { docs: docs.map(({ id, ...data }) => ({ id, data: () => data })) }
    }),
  }
  return { deps, calls }
}

describe('useActiveSession', () => {
  it('for a teacher reads the newest sessions, newest first, with a limit (no per-student filter)', async () => {
    const fb = fakeFirestore({ docs: [session('s1', 'scheduled', 1)] })
    const { result } = renderHook(() => useActiveSession('uid-docente', true, fb.deps))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.sessionId).toBe('s1')
    expect(fb.calls[0].ref).toEqual({ name: 'learningSessions' })
    expect(fb.calls[0].constraints).toEqual([{ orderBy: ['createdAt', 'desc'] }, { limit: ACTIVE_LOOKUP_LIMIT }])
  })

  it('for a student only asks for the sessions where their uid is in studentIds (as the rules require)', async () => {
    const fb = fakeFirestore({ docs: [session('mine', 'live', 3)] })
    const { result } = renderHook(() => useActiveSession('uid-ana', false, fb.deps))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sessionId).toBe('mine')
    expect(fb.calls[0].constraints).toContainEqual({ where: ['studentIds', 'array-contains', 'uid-ana'] })
    expect(JSON.stringify(fb.calls[0].constraints)).not.toContain('orderBy') // evita un indice compuesto
  })

  it('has no session when there are none', async () => {
    const { result } = renderHook(() => useActiveSession('uid', true, fakeFirestore().deps))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toMatchObject({ sessionId: null, error: null })
  })

  it('turns a Firestore error into a friendly message and lets the user retry', async () => {
    const fb = fakeFirestore({ error: { code: 'permission-denied', message: 'texto tecnico' } })
    const { result } = renderHook(() => useActiveSession('uid', true, fb.deps))
    await waitFor(() => expect(result.current.error).toBe('No tienes permiso para ver tus sesiones.'))
    expect(JSON.stringify(result.current)).not.toContain('texto tecnico')

    result.current.retry()
    await waitFor(() => expect(fb.deps.getDocs).toHaveBeenCalledTimes(2))
  })

  it('does not query until there is a user', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useActiveSession(undefined, true, fb.deps))
    expect(fb.deps.getDocs).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
  })
})

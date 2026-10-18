import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { session } = vi.hoisted(() => ({ session: {} }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => session }))
vi.mock('@/services/firebase', () => ({ db: {} }))
import { useSessions } from './useSessions'

function firestore() {
  const listeners = []
  const deps = {
    db: {}, collection: (_db, path) => ({ path }), query: (ref, condition) => ({ ...ref, condition }),
    where: (...args) => args,
    onSnapshot: vi.fn((request, next, error) => { const stop = vi.fn(); listeners.push({ request, next, error, stop }); return stop }),
  }
  const emit = (index, rows) => act(() => listeners[index].next({ docs: rows.map(({ id, ...data }) => ({ id, data: () => data })) }))
  return { deps, listeners, emit }
}
beforeEach(() => Object.assign(session, { user: { uid: 'teacher' }, isTeacher: true }))
afterEach(cleanup)
describe('Salas reales por usuario', () => {
  it('consulta por docente y refleja las salas nuevas sin datos demo', () => {
    const fb = firestore()
    const { result } = renderHook(() => useSessions(fb.deps))
    expect(result.current.sessions).toEqual([])
    expect(fb.listeners[0].request.condition).toEqual(['createdBy', '==', 'teacher'])
    fb.emit(0, [{ id: 'private-1', title: 'Valeria y Mateo', createdAt: { toMillis: () => 1 } }])
    expect(result.current.sessions[0].title).toBe('Valeria y Mateo')
    fb.emit(0, [])
    expect(result.current.sessions).toEqual([])
  })
  it('el estudiante consulta únicamente salas donde figura su UID', () => {
    session.user = { uid: 'student-1' }; session.isTeacher = false
    const fb = firestore()
    renderHook(() => useSessions(fb.deps))
    expect(fb.listeners[0].request.condition).toEqual(['studentIds', 'array-contains', 'student-1'])
  })
  it('cambia de cuenta sin conservar salas anteriores ni aceptar callbacks viejos', () => {
    const fb = firestore()
    const { result, rerender } = renderHook(() => useSessions(fb.deps))
    fb.emit(0, [{ id: 'old-private' }])
    session.user = { uid: 'other-teacher' }
    rerender()
    expect(result.current.sessions).toEqual([])
    expect(fb.listeners[0].stop).toHaveBeenCalled()
    fb.emit(0, [{ id: 'leaked' }])
    expect(result.current.sessions).toEqual([])
    fb.emit(1, [{ id: 'new-private' }])
    expect(result.current.sessions[0].id).toBe('new-private')
  })
  it('muestra un error recuperable y no usa una sala ficticia como fallback', () => {
    const fb = firestore()
    const { result } = renderHook(() => useSessions(fb.deps))
    act(() => fb.listeners[0].error(new Error('secret')))
    expect(result.current.error).toContain('No se pudieron cargar')
    expect(result.current.sessions).toEqual([])
    act(() => result.current.reload())
    expect(fb.listeners[0].stop).toHaveBeenCalled()
    fb.emit(1, [])
    expect(result.current.error).toBeNull()
  })
})

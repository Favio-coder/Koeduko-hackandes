import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
// El cliente real de Firebase necesita claves; aqui se usa un Firestore falso inyectado.
vi.mock('@/services/firebase', () => ({ db: {} }))

import { INTERVENTIONS_LIMIT, friendlyError, useLiveSession } from './useLiveSession'

/** Firestore falso: registra cada suscripcion y permite emitir datos o errores a mano. */
function fakeFirestore() {
  const listeners = new Map()
  const unsubscribed = []
  const deps = {
    db: {},
    doc: (_db, ...segments) => ({ path: segments.join('/') }),
    collection: (_db, ...segments) => ({ path: segments.join('/') }),
    orderBy: (field, direction) => ({ orderBy: [field, direction] }),
    limit: (n) => ({ limit: n }),
    query: (ref, ...constraints) => ({ path: ref.path, constraints }),
    onSnapshot: vi.fn((ref, next, onError) => {
      listeners.set(ref.path, { next, onError, ref })
      return () => unsubscribed.push(ref.path)
    }),
  }
  const docSnap = (id, data) => ({ id, exists: () => data !== null, data: () => data })
  return {
    deps,
    unsubscribed,
    listeners,
    emitDoc: (path, data) => listeners.get(path).next(docSnap(path.split('/').at(-1), data)),
    emitQuery: (path, docs) => listeners.get(path).next({ docs: docs.map(({ id, ...data }) => ({ id, data: () => data })) }),
    fail: (path, code) => listeners.get(path).onError({ code, message: 'texto tecnico de firestore' }),
  }
}

const SESSION = 'learningSessions/s1'
const VIEW = `${SESSION}/live/view`
const INTERVENTIONS = `${SESSION}/agentInterventions`

describe('useLiveSession', () => {
  it('subscribes to the session, the live view and the 20 latest interventions, newest first', () => {
    const fb = fakeFirestore()
    renderHook(() => useLiveSession('s1', fb.deps))

    expect([...fb.listeners.keys()].sort()).toEqual([INTERVENTIONS, SESSION, VIEW].sort())
    expect(fb.listeners.get(INTERVENTIONS).ref.constraints).toEqual([{ orderBy: ['createdAt', 'desc'] }, { limit: INTERVENTIONS_LIMIT }])
    expect(INTERVENTIONS_LIMIT).toBe(20)
  })

  it('is loading until the view and the interventions have answered, even if the session doc does not exist', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useLiveSession('s1', fb.deps))
    expect(result.current.loading).toBe(true)

    act(() => fb.emitDoc(SESSION, null))
    expect(result.current.loading).toBe(true)
    act(() => fb.emitDoc(VIEW, null))
    expect(result.current.loading).toBe(true)
    act(() => fb.emitQuery(INTERVENTIONS, []))

    expect(result.current).toMatchObject({ loading: false, error: null, session: null, view: null, interventions: [] })
  })

  it('exposes the session, the view and the interventions with their creation time', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useLiveSession('s1', fb.deps))
    const view = { participants: [{ key: 'a', name: 'A', sharePct: 100 }], transcripts: [] }

    act(() => {
      fb.emitDoc(SESSION, { title: 'Pareja 1', bot: { status: 'in_call' } })
      fb.emitDoc(VIEW, view)
      fb.emitQuery(INTERVENTIONS, [
        { id: 'int-2', signal: 'SILENT_PEER', message: 'Hola', createdAt: { toMillis: () => 2000 } },
        { id: 'int-1', signal: 'DOMINANCE', message: 'Chau', createdAt: null }, // aun sin hora del servidor
      ])
    })

    expect(result.current.session).toEqual({ id: 's1', title: 'Pareja 1', bot: { status: 'in_call' } })
    expect(result.current.view).toEqual(view)
    expect(result.current.interventions.map((i) => [i.id, i.createdMs])).toEqual([['int-2', 2000], ['int-1', null]])
  })

  it('follows live updates of the view', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useLiveSession('s1', fb.deps))
    act(() => {
      fb.emitDoc(VIEW, { t: 5 })
      fb.emitQuery(INTERVENTIONS, [])
    })
    act(() => fb.emitDoc(VIEW, { t: 10 }))
    expect(result.current.view).toEqual({ t: 10 })
  })

  it('turns a Firestore error into a friendly message and stops loading', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useLiveSession('s1', fb.deps))

    act(() => fb.fail(VIEW, 'permission-denied'))

    expect(result.current.error).toBe('No tienes permiso para ver esta sesión.')
    expect(result.current.loading).toBe(false)
    expect(JSON.stringify(result.current)).not.toContain('texto tecnico')
  })

  it.each([
    ['permission-denied', 'No tienes permiso para ver esta sesión.'],
    ['unavailable', 'No hay conexión con los datos de la sesión. Revisa tu internet.'],
    ['unauthenticated', 'Tu sesión venció. Vuelve a iniciar sesión.'],
    ['something-new', 'No se pudieron cargar los datos de la sesión. Inténtalo de nuevo.'],
    [undefined, 'No se pudieron cargar los datos de la sesión. Inténtalo de nuevo.'],
  ])('friendlyError(%s)', (code, message) => {
    expect(friendlyError({ code })).toBe(message)
  })

  it('retry re-subscribes and clears the error', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useLiveSession('s1', fb.deps))
    act(() => fb.fail(VIEW, 'unavailable'))
    expect(result.current.error).not.toBeNull()
    const callsBefore = fb.deps.onSnapshot.mock.calls.length

    act(() => result.current.retry())

    expect(fb.deps.onSnapshot.mock.calls.length).toBe(callsBefore + 3)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('stops listening on unmount and never mixes data between sessions', () => {
    const fb = fakeFirestore()
    const { result, rerender, unmount } = renderHook(({ id }) => useLiveSession(id, fb.deps), { initialProps: { id: 's1' } })
    act(() => {
      fb.emitDoc(VIEW, { t: 99 })
      fb.emitQuery(INTERVENTIONS, [])
    })
    expect(result.current.view).toEqual({ t: 99 })

    rerender({ id: 's2' })
    expect(fb.unsubscribed).toHaveLength(3) // se cerraron las tres de s1
    expect(result.current.view).toBeNull() // nada de s1 en s2
    expect(result.current.loading).toBe(true)

    unmount()
    expect(fb.unsubscribed).toHaveLength(6)
  })

  it('does not subscribe without a session id', () => {
    const fb = fakeFirestore()
    renderHook(() => useLiveSession('', fb.deps))
    expect(fb.deps.onSnapshot).not.toHaveBeenCalled()
  })
})

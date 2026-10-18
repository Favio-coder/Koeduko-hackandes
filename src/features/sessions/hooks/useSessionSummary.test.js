import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/firebase', () => ({ db: {} }))

import { useSessionSummary } from './useSessionSummary'

function fakeFirestore() {
  const listeners = new Map()
  const unsubscribed = []
  const deps = {
    db: {},
    doc: (_db, ...segments) => ({ path: segments.join('/') }),
    onSnapshot: vi.fn((ref, next, onError) => {
      listeners.set(ref.path, { next, onError })
      return () => unsubscribed.push(ref.path)
    }),
  }
  return { deps, listeners, unsubscribed }
}

const PATH = 'learningSessions/s1/summary/final'

describe('useSessionSummary', () => {
  it('listens to summary/final and exposes the saved report', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useSessionSummary('s1', {}, fb.deps))
    expect(result.current).toEqual({ summary: null, ready: false })

    act(() => fb.listeners.get(PATH).next({ exists: () => true, data: () => ({ report: { v: 1 }, steps: {} }) }))
    expect(result.current).toEqual({ summary: { report: { v: 1 }, steps: {} }, ready: true })
  })

  it('is ready with no summary when the session was not closed yet', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useSessionSummary('s1', {}, fb.deps))
    act(() => fb.listeners.get(PATH).next({ exists: () => false, data: () => null }))
    expect(result.current).toEqual({ summary: null, ready: true })
  })

  it('treats a Firestore error (no permission, offline) as "no summary" without breaking the page', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useSessionSummary('s1', {}, fb.deps))
    act(() => fb.listeners.get(PATH).onError({ code: 'permission-denied' }))
    expect(result.current).toEqual({ summary: null, ready: true })
  })

  it('does not subscribe when disabled (a student cannot read it) and costs nothing', () => {
    const fb = fakeFirestore()
    const { result } = renderHook(() => useSessionSummary('s1', { enabled: false }, fb.deps))
    expect(fb.deps.onSnapshot).not.toHaveBeenCalled()
    expect(result.current).toEqual({ summary: null, ready: true })
  })

  it('does not subscribe without a session id', () => {
    const fb = fakeFirestore()
    renderHook(() => useSessionSummary('', {}, fb.deps))
    expect(fb.deps.onSnapshot).not.toHaveBeenCalled()
  })

  it('stops listening on unmount and never shows the summary of another session', () => {
    const fb = fakeFirestore()
    const { result, rerender, unmount } = renderHook(({ id }) => useSessionSummary(id, {}, fb.deps), { initialProps: { id: 's1' } })
    act(() => fb.listeners.get(PATH).next({ exists: () => true, data: () => ({ report: { v: 1 } }) }))
    expect(result.current.summary).not.toBeNull()

    rerender({ id: 's2' })
    expect(fb.unsubscribed).toEqual([PATH])
    expect(result.current).toEqual({ summary: null, ready: false })

    unmount()
    expect(fb.unsubscribed).toHaveLength(2)
  })
})

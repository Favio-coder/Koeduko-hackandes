import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HEARTBEAT_EVERY_MS, useSessionHeartbeat } from './useSessionHeartbeat'

describe('useSessionHeartbeat', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('pings the server every 20 s while enabled, with only the session id', () => {
    const send = vi.fn().mockResolvedValue({})
    renderHook(() => useSessionHeartbeat('s1', { enabled: true, send }))
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(HEARTBEAT_EVERY_MS)
    expect(send).toHaveBeenCalledWith({ sessionId: 's1' })
    vi.advanceTimersByTime(HEARTBEAT_EVERY_MS * 2)
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('does nothing when disabled or without a session, and stops when it unmounts', () => {
    const send = vi.fn().mockResolvedValue({})
    renderHook(() => useSessionHeartbeat('s1', { enabled: false, send }))
    renderHook(() => useSessionHeartbeat(undefined, { enabled: true, send }))
    vi.advanceTimersByTime(HEARTBEAT_EVERY_MS * 3)
    expect(send).not.toHaveBeenCalled()

    const { unmount } = renderHook(() => useSessionHeartbeat('s1', { enabled: true, send }))
    unmount()
    vi.advanceTimersByTime(HEARTBEAT_EVERY_MS * 3)
    expect(send).not.toHaveBeenCalled()
  })

  it('pauses with the tab hidden and resumes when it is visible again', () => {
    const send = vi.fn().mockResolvedValue({})
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    renderHook(() => useSessionHeartbeat('s1', { enabled: true, send }))

    visibility.mockReturnValue('hidden')
    vi.advanceTimersByTime(HEARTBEAT_EVERY_MS)
    expect(send).not.toHaveBeenCalled()

    visibility.mockReturnValue('visible')
    vi.advanceTimersByTime(HEARTBEAT_EVERY_MS)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('ignores a failing ping: it never throws into the page', () => {
    const send = vi.fn().mockRejectedValue(new Error('offline'))
    renderHook(() => useSessionHeartbeat('s1', { enabled: true, send }))
    expect(() => vi.advanceTimersByTime(HEARTBEAT_EVERY_MS * 2)).not.toThrow()
    expect(send).toHaveBeenCalledTimes(2)
  })
})

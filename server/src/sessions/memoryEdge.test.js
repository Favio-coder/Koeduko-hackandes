import { describe, expect, it, vi } from 'vitest'
import { createMemoryFromEnv } from './memoryEdge.js'

const deps = () => ({ getFirebase: vi.fn(() => ({ db: { collection: vi.fn() }, FieldValue: { serverTimestamp: () => 'TS' } })), logger: { info: vi.fn() } })

describe('createMemoryFromEnv', () => {
  it('uses AtomicMemory with the Firestore fallback when the URL and the key are set', () => {
    expect(createMemoryFromEnv({ ATOMICMEMORY_API_URL: 'https://api.test', ATOMICMEMORY_API_KEY: 'k' }, deps()).name).toBe('atomicmemory+firestore')
  })

  it('uses only the Firestore fallback when AtomicMemory is not configured', () => {
    expect(createMemoryFromEnv({}, deps()).name).toBe('firestore')
    expect(createMemoryFromEnv({ ATOMICMEMORY_API_URL: 'https://api.test' }, deps()).name).toBe('firestore')
    expect(createMemoryFromEnv({ ATOMICMEMORY_API_URL: ' ', ATOMICMEMORY_API_KEY: ' ' }, deps()).name).toBe('firestore')
  })

  it.each(['false', 'FALSE', ' 0 ', 'off', 'no'])('is off with MEMORY_ENABLED=%s, without touching Firebase', (value) => {
    const d = deps()
    expect(createMemoryFromEnv({ MEMORY_ENABLED: value, ATOMICMEMORY_API_URL: 'u', ATOMICMEMORY_API_KEY: 'k' }, d)).toBeNull()
    expect(d.getFirebase).not.toHaveBeenCalled()
  })

  it('is on by default', () => {
    expect(createMemoryFromEnv({ MEMORY_ENABLED: 'true' }, deps())).not.toBeNull()
  })
})

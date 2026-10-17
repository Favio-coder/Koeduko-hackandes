import { describe, expect, it, vi } from 'vitest'
import { createSessionStore } from './sessionStore.js'

function fakeFirebase(docs = {}) {
  const added = []
  const db = {
    doc: (path) => ({ path, get: async () => ({ exists: path in docs, data: () => structuredClone(docs[path]) }) }),
    collection: (path) => ({ add: vi.fn(async (data) => added.push({ path, data })) }),
  }
  return { firebase: { db, FieldValue: { serverTimestamp: () => 'SERVER_TS' } }, added }
}

describe('getSession', () => {
  it('returns the stored session', async () => {
    const { firebase } = fakeFirebase({ 'learningSessions/s1': { studentIds: ['u1'] } })
    expect(await createSessionStore(firebase).getSession('s1')).toEqual({ studentIds: ['u1'] })
  })

  it('returns null when the session does not exist', async () => {
    const { firebase } = fakeFirebase()
    expect(await createSessionStore(firebase).getSession('nope')).toBeNull()
  })
})

describe('addTutorInteraction', () => {
  it('stores the question and the hint in the session with a server timestamp', async () => {
    const { firebase, added } = fakeFirebase()
    await createSessionStore(firebase).addTutorInteraction('s1', { studentId: 'u1', prompt: 'ayuda', response: 'pista?', hintLevel: 1 })
    expect(added).toEqual([
      { path: 'learningSessions/s1/tutorInteractions', data: { studentId: 'u1', prompt: 'ayuda', response: 'pista?', hintLevel: 1, createdAt: 'SERVER_TS' } },
    ])
  })
})

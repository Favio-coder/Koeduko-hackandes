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

describe('close-session reads and writes', () => {
  function closeFirebase({ docs = {}, collections = {} } = {}) {
    const calls = { queries: [], batches: [] }
    const db = {
      doc: (path) => ({ path, get: async () => ({ exists: path in docs, data: () => structuredClone(docs[path]) }) }),
      collection: (path) => ({
        where: (field, op, value) => ({
          limit: (n) => ({
            get: async () => {
              calls.queries.push({ path, field, op, value, n })
              return { docs: (collections[path] ?? []).map((data) => ({ data: () => data })) }
            },
          }),
        }),
      }),
      batch: () => {
        const ops = []
        calls.batches.push(ops)
        return { set: (ref, data) => ops.push({ op: 'set', path: ref.path, data }), update: (ref, data) => ops.push({ op: 'update', path: ref.path, data }), commit: vi.fn(async () => {}) }
      },
    }
    return { firebase: { db, FieldValue: { serverTimestamp: () => 'SERVER_TS' } }, calls }
  }

  it('reads the state, the answer and the summary of a session, or null', async () => {
    const { firebase } = closeFirebase({ docs: { 'learningSessions/s1/live/state': { lastT: 5 }, 'learningSessions/s1/private/answer': { expectedAnswer: 48 } } })
    const store = createSessionStore(firebase)
    expect(await store.getLiveState('s1')).toEqual({ lastT: 5 })
    expect(await store.getAnswer('s1')).toEqual({ expectedAnswer: 48 })
    expect(await store.getSummary('s1')).toBeNull()
    expect(await store.getLiveState('nope')).toBeNull()
  })

  it('reads only the transcripts, with a cap, and maps them to the shape of the report', async () => {
    const { firebase, calls } = closeFirebase({
      collections: {
        'learningSessions/s1/liveEvents': [
          { type: 'transcript', participantKey: 'ana', t: 4, tEnd: 6, text: 'hola' },
          { type: 'transcript', participantKey: 'luis', t: 8, tEnd: null, text: 'chau' },
          { type: 'transcript', participantKey: 'rota', t: 'x', text: 'no vale' },
          { type: 'transcript', t: 9, text: 'sin hablante' },
        ],
      },
    })
    const transcripts = await createSessionStore(firebase).getTranscripts('s1')
    expect(transcripts).toEqual([{ k: 'ana', t: 4, e: 6, x: 'hola' }, { k: 'luis', t: 8, e: 8, x: 'chau' }])
    expect(calls.queries).toEqual([{ path: 'learningSessions/s1/liveEvents', field: 'type', op: '==', value: 'transcript', n: 2000 }])
  })

  it('saves the summary and completes the session in ONE batch (2 writes)', async () => {
    const { firebase, calls } = closeFirebase()
    await createSessionStore(firebase).saveClosure('s1', { v: 1, sessionId: 's1', report: { v: 1 }, steps: {} })
    expect(calls.batches).toHaveLength(1)
    expect(calls.batches[0]).toEqual([
      { op: 'set', path: 'learningSessions/s1/summary/final', data: { v: 1, sessionId: 's1', report: { v: 1 }, steps: {}, closedAt: 'SERVER_TS' } },
      { op: 'update', path: 'learningSessions/s1', data: { status: 'completed', endedAt: 'SERVER_TS', 'bot.status': 'done' } },
    ])
  })
})

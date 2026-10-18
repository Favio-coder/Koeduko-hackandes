import { describe, expect, it, vi } from 'vitest'
import { SessionBotError } from '../errors.js'
import { createSessionStore } from './sessionStore.js'

const NOW = 5_000_000
const MEET = 'https://meet.google.com/abc-defg-hij'

/** Doble minimo de Firestore: documentos en memoria y una transaccion que aplica los update. */
function fakeFirebase(docs = {}) {
  const writes = []
  const refFor = (path) => ({
    path,
    get: async () => ({ exists: path in docs, data: () => docs[path] }),
    set: vi.fn(async (data) => writes.push({ op: 'set', path, data })),
    update: vi.fn(async (data) => writes.push({ op: 'update', path, data })),
  })
  const db = {
    doc: refFor,
    runTransaction: async (fn) =>
      fn({
        get: (ref) => ref.get(),
        update: (ref, data) => writes.push({ op: 'tx.update', path: ref.path, data }),
      }),
  }
  return { firebase: { db, FieldValue: { serverTimestamp: () => 'SERVER_TS' } }, writes }
}

describe('saveLiveEvent', () => {
  it('writes to liveEvents with the event id and a server timestamp', async () => {
    const { firebase, writes } = fakeFirebase()
    await createSessionStore(firebase).saveLiveEvent('smoke-001', 'evt-1', { type: 'speech_on', t: 1 })

    expect(writes).toEqual([
      {
        op: 'set',
        path: 'learningSessions/smoke-001/liveEvents/evt-1',
        data: { type: 'speech_on', t: 1, receivedAt: 'SERVER_TS' },
      },
    ])
  })
})

describe('getUserRole', () => {
  it('returns the stored role', async () => {
    const { firebase } = fakeFirebase({ 'users/u1': { role: 'teacher' } })
    expect(await createSessionStore(firebase).getUserRole('u1')).toBe('teacher')
  })

  it('returns null when the user or the role is missing', async () => {
    const { firebase } = fakeFirebase({ 'users/u2': {} })
    const store = createSessionStore(firebase)
    expect(await store.getUserRole('u2')).toBeNull()
    expect(await store.getUserRole('nobody')).toBeNull()
  })
})

describe('claimBot', () => {
  const claim = (docs) => {
    const { firebase, writes } = fakeFirebase(docs)
    return { run: () => createSessionStore(firebase).claimBot('s1', { region: 'us-west-2', nowMs: NOW }), writes }
  }

  it('reserves the bot and returns the stored meeting url', async () => {
    const { run, writes } = claim({ 'learningSessions/s1': { meetingUrl: ` ${MEET} ` } })

    await expect(run()).resolves.toEqual({ meetingUrl: MEET })
    expect(writes).toEqual([
      {
        op: 'tx.update',
        path: 'learningSessions/s1',
        data: { bot: { id: null, status: 'requested', region: 'us-west-2', requestedAtMs: NOW } },
      },
    ])
  })

  it('fails with not-found when the session does not exist', async () => {
    await expect(claim({}).run()).rejects.toMatchObject({ code: 'not-found' })
  })

  it('fails with failed-precondition for a missing or invalid Meet link', async () => {
    const { run, writes } = claim({ 'learningSessions/s1': { meetingUrl: 'https://zoom.us/j/1' } })
    await expect(run()).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(writes).toEqual([])
  })

  it('blocks a second invitation while the first is in flight', async () => {
    const { run, writes } = claim({
      'learningSessions/s1': { meetingUrl: MEET, bot: { id: null, status: 'requested', requestedAtMs: NOW - 1000 } },
    })
    const error = await run().catch((e) => e)
    expect(error).toBeInstanceOf(SessionBotError)
    expect(error.code).toBe('failed-precondition')
    expect(writes).toEqual([])
  })

  it('allows retrying after a failed bot', async () => {
    const { run } = claim({ 'learningSessions/s1': { meetingUrl: MEET, bot: { id: 'old', status: 'failed' } } })
    await expect(run()).resolves.toEqual({ meetingUrl: MEET })
  })
})

describe('setDeliveredTo', () => {
  it('updates only deliveredTo on the intervention', async () => {
    const { firebase, writes } = fakeFirebase()
    await createSessionStore(firebase).setDeliveredTo('s1', 'int-1', ['app', 'meet_chat'])
    expect(writes).toEqual([
      { op: 'update', path: 'learningSessions/s1/agentInterventions/int-1', data: { deliveredTo: ['app', 'meet_chat'] } },
    ])
  })
})

describe('setBotId / markBotFailed', () => {
  it('updates only the bot fields', async () => {
    const { firebase, writes } = fakeFirebase()
    const store = createSessionStore(firebase)
    await store.setBotId('s1', 'bot-9')
    await store.markBotFailed('s1')

    expect(writes).toEqual([
      { op: 'update', path: 'learningSessions/s1', data: { 'bot.id': 'bot-9' } },
      { op: 'update', path: 'learningSessions/s1', data: { 'bot.status': 'failed' } },
    ])
  })
})

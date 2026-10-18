import { describe, expect, it, vi } from 'vitest'
import { closeSession } from './closeSession.js'
import { studentKeyOf } from './core/studentKey.js'

const A = 'estudiante a'
const B = 'estudiante b'

const session = {
  createdBy: 'docente-1',
  status: 'scheduled',
  bot: { id: 'bot-1', region: 'us-west-2', status: 'requested' },
  currentProblem: { activityId: 'p-01', skillId: 'multiplication', text: 'Hay 6 cajas con 8 lápices cada una. ¿Cuántos lápices hay en total?' },
}
const state = {
  lastT: 120,
  presence: [{ k: A, s: 0 }, { k: B, s: 0 }, { k: 'tutor koeduko', s: 1 }],
  totals: [{ k: A, sec: 30, turns: 4 }, { k: B, sec: 10, turns: 2 }, { k: 'tutor koeduko', sec: 3, turns: 1 }],
  students: [],
  problem: { id: 'p-01', startedT: 0 },
  answer: { id: 'p-01', v: 48 },
}
const transcripts = [
  { k: B, t: 5, e: 7, x: 'Hay seis cajas con ocho lápices cada una' },
  { k: A, t: 10, e: 12, x: 'Entonces seis por ocho' },
  { k: B, t: 20, e: 22, x: 'son cuarenta y ocho' },
  { k: B, t: 24, e: 26, x: 'porque seis veces ocho es cuarenta y ocho' },
  { k: 'tutor koeduko', t: 30, e: 32, x: 'Estudiante B, ¿cómo lo explicarías?' },
  { k: A, t: 40, e: 42, x: 'creo que primero hay que contar todas las cajas que tenemos aqui' },
]

function setup({ sess = session, st = state, trs = transcripts, memory, leaveBot, generate, store = {}, timeouts } = {}) {
  const fakeStore = {
    getSession: vi.fn().mockResolvedValue(sess),
    getLiveState: vi.fn().mockResolvedValue(st),
    getTranscripts: vi.fn().mockResolvedValue(trs),
    getAnswer: vi.fn().mockResolvedValue({ expectedAnswer: 48 }),
    getSummary: vi.fn().mockResolvedValue(null),
    saveClosure: vi.fn().mockResolvedValue(undefined),
    ...store,
  }
  const deps = {
    store: fakeStore,
    memory: memory === undefined ? { remember: vi.fn().mockResolvedValue({ ok: true, via: 'atomicmemory' }) } : memory,
    leaveBot: leaveBot === undefined ? vi.fn().mockResolvedValue({}) : leaveBot,
    generate: generate === undefined ? vi.fn().mockResolvedValue('[{"id":"4.0","capacidad":"argumenta"}]') : generate,
    logger: { info: vi.fn() },
    timeouts,
  }
  return { deps, store: fakeStore, run: (sessionId = 's1') => closeSession({ sessionId, ...deps }) }
}

describe('closeSession', () => {
  it('lets the bot leave, builds the report, remembers every student and closes the session', async () => {
    const { run, store, deps } = setup()
    const result = await run()

    expect(result).toMatchObject({ status: 'completed', alreadyClosed: false })
    expect(deps.leaveBot).toHaveBeenCalledWith(session.bot)
    expect(result.report.estudiantes.map((s) => s.name)).toEqual(['Estudiante A', 'Estudiante B']) // sin el bot
    expect(result.report.nota).toMatch(/calificación la decide el docente/)

    expect(store.saveClosure).toHaveBeenCalledTimes(1)
    const [id, summary] = store.saveClosure.mock.calls[0]
    expect(id).toBe('s1')
    expect(summary).toMatchObject({ v: 1, sessionId: 's1', report: result.report, steps: result.steps })

    expect(deps.memory.remember).toHaveBeenCalledTimes(2)
    expect(result.steps).toMatchObject({ leaveCall: 'ok', memory: { enabled: true, saved: 2, failed: 0, skipped: 0 } })
  })

  it('remembers a short factual text per student under their studentKey, never a name or a transcript', async () => {
    const { run, deps } = setup()
    const result = await run()

    const keyOfB = studentKeyOf({ participantKey: B, scope: 'docente-1' })
    const call = deps.memory.remember.mock.calls.find(([key]) => key === keyOfB)
    expect(call[1]).toBe('Sesión s1, multiplicación: comunicó 25% del tiempo; usó estrategia correcta; planteó la operación solo en parte; argumentó con razones.')
    for (const [key, text] of deps.memory.remember.mock.calls) {
      expect(key).toMatch(/^docente-1:[0-9a-f]{16}$/)
      expect(`${key} ${text}`).not.toMatch(/estudiante|cuarenta|porque|cajas/i)
    }
    expect(result.memory.map((m) => m.name)).toEqual(expect.arrayContaining(['Estudiante A', 'Estudiante B']))
  })

  it('reads the answer from the state cache, and only goes to private/answer when the cache is for another problem', async () => {
    const cached = setup()
    await cached.run()
    expect(cached.store.getAnswer).not.toHaveBeenCalled()

    const stale = setup({ st: { ...state, answer: { id: 'otro', v: 7 } } })
    const result = await stale.run()
    expect(stale.store.getAnswer).toHaveBeenCalledTimes(1)
    expect(result.report.estudiantes.find((s) => s.key === B).capacidades.find((c) => c.id === 'usa-estrategias').estado).toBe('con evidencia')
  })

  it('works with a session that was not migrated (answer inside the problem) and with no answer at all', async () => {
    const legacy = setup({ sess: { ...session, currentProblem: { ...session.currentProblem, expectedAnswer: 48 } }, st: { ...state, answer: null }, store: { getAnswer: vi.fn().mockResolvedValue(null) } })
    const r1 = await legacy.run()
    expect(r1.report.estudiantes.find((s) => s.key === B).capacidades.find((c) => c.id === 'usa-estrategias').estado).toBe('con evidencia')

    const none = setup({ st: { ...state, answer: null }, store: { getAnswer: vi.fn().mockResolvedValue(null) } })
    const r2 = await none.run()
    expect(r2.report.problema.text).toMatch(/lápices/)
    expect(r2.report.estudiantes.every((s) => s.capacidades.find((c) => c.id === 'usa-estrategias').estado === 'sin evidencia suficiente')).toBe(true)
  })

  it('never puts the expected answer in the saved summary', async () => {
    const { run, store } = setup()
    await run()
    expect(JSON.stringify(store.saveClosure.mock.calls[0][1])).not.toMatch(/expectedAnswer|"v":48/)
  })

  describe('no external service can break the close', () => {
    it('keeps closing when the bot cannot leave (error or timeout) and records it', async () => {
      const failing = setup({ leaveBot: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 404 })) })
      expect((await failing.run()).steps.leaveCall).toBe('failed:404')

      const slow = setup({ leaveBot: vi.fn(() => new Promise(() => {})), timeouts: { leave: 20 } })
      const result = await slow.run()
      expect(result.steps.leaveCall).toBe('failed:timeout')
      expect(slow.store.saveClosure).toHaveBeenCalledTimes(1)
    })

    it('falls back to the rules when Gemini fails, is slow or answers garbage, and records it', async () => {
      const down = setup({ generate: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { reason: 'http' })) })
      expect((await down.run()).steps.classifier).toBe('failed:http')

      const slow = setup({ generate: vi.fn(() => new Promise(() => {})), timeouts: { classify: 20 } })
      expect((await slow.run()).steps.classifier).toBe('failed:timeout')

      const garbage = setup({ generate: vi.fn().mockResolvedValue('no soy json') })
      const result = await garbage.run()
      expect(result.steps.classifier).toBe('no-labels')
      expect(result.report.estudiantes).toHaveLength(2)
    })

    it('uses the classifier labels but they only give "evidencia parcial"', async () => {
      const { run } = setup()
      const result = await run()
      const a = result.report.estudiantes.find((s) => s.key === A).capacidades.find((c) => c.id === 'argumenta')
      expect(result.steps.classifier).toBe('ok')
      expect(a.estado).toBe('evidencia parcial')
      expect(a.señales).toContain('CLASIFICADOR')
    })

    it('asks Gemini for JSON, with the children text quoted as data', async () => {
      const { run, deps } = setup()
      await run()
      const input = deps.generate.mock.calls[0][0]
      expect(input.generationConfig).toMatchObject({ responseMimeType: 'application/json' })
      expect(input.userPrompt).toContain('«creo que primero hay que contar todas las cajas que tenemos aqui»')
    })

    it('records memory failures (by reason only) and still closes', async () => {
      const memory = { remember: vi.fn().mockResolvedValueOnce({ ok: false, reason: 'timeout' }).mockRejectedValueOnce(new Error('boom con datos')) }
      const { run, store } = setup({ memory })
      const result = await run()
      expect(result.steps.memory).toMatchObject({ enabled: true, saved: 0, failed: 2 })
      expect(result.steps.memory.failures.sort()).toEqual(['Error', 'timeout'])
      expect(JSON.stringify(result.steps)).not.toMatch(/boom|datos/)
      expect(store.saveClosure).toHaveBeenCalledTimes(1)
    })

    it('closes with no memory, no Gemini and no bot at all', async () => {
      const { run, store } = setup({ memory: null, generate: null, leaveBot: null, sess: { ...session, bot: undefined } })
      const result = await run()
      expect(result.steps).toMatchObject({ leaveCall: 'skipped', classifier: 'no-generator', memory: { enabled: false, saved: 0 } })
      expect(store.saveClosure).toHaveBeenCalledTimes(1)
    })

    it('skips the memory for a student with no key (no scope), instead of guessing one', async () => {
      const { run, deps } = setup({ sess: { ...session, createdBy: undefined } })
      const result = await run()
      expect(deps.memory.remember).not.toHaveBeenCalled()
      expect(result.steps.memory).toMatchObject({ saved: 0, skipped: 2 })
    })
  })

  describe('what must stop the close', () => {
    it('rejects a bad session id, and a session that does not exist', async () => {
      await expect(setup().run('../x')).rejects.toMatchObject({ code: 'invalid-argument' })
      await expect(setup({ sess: null }).run()).rejects.toMatchObject({ code: 'not-found' })
    })

    it('fails when Firestore cannot be read or the summary cannot be saved (nothing to deliver)', async () => {
      await expect(setup({ store: { getTranscripts: vi.fn().mockRejectedValue(new Error('firestore')) } }).run()).rejects.toThrow('firestore')
      await expect(setup({ store: { saveClosure: vi.fn().mockRejectedValue(new Error('firestore')) } }).run()).rejects.toThrow('firestore')
    })
  })

  describe('closing twice', () => {
    it('returns the saved report and touches nothing else', async () => {
      const saved = { report: { v: 1, estudiantes: [] }, steps: { leaveCall: 'ok' } }
      const { run, store, deps } = setup({ sess: { ...session, status: 'completed' }, store: { getSummary: vi.fn().mockResolvedValue(saved) } })
      const result = await run()

      expect(result).toEqual({ status: 'completed', alreadyClosed: true, report: saved.report, steps: saved.steps, memory: [] })
      expect(deps.leaveBot).not.toHaveBeenCalled()
      expect(deps.generate).not.toHaveBeenCalled()
      expect(deps.memory.remember).not.toHaveBeenCalled()
      expect(store.saveClosure).not.toHaveBeenCalled()
      expect(store.getTranscripts).not.toHaveBeenCalled()
    })

    it('builds the report anyway if the session is completed but has no summary', async () => {
      const { run, store } = setup({ sess: { ...session, status: 'completed' } })
      expect((await run()).alreadyClosed).toBe(false)
      expect(store.saveClosure).toHaveBeenCalledTimes(1)
    })
  })

  it('does not log texts, names or keys', async () => {
    const { run, deps } = setup()
    await run()
    const logged = JSON.stringify(deps.logger.info.mock.calls)
    expect(logged).not.toMatch(/estudiante|cuarenta|docente-1|lápices/i)
    expect(deps.logger.info).toHaveBeenCalledWith('closeSession: sesion cerrada', expect.objectContaining({ students: 2, memorySaved: 2 }))
  })
})

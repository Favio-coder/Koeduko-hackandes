import { describe, expect, it, vi } from 'vitest'
import { createAfterLiveEventSaved } from './afterLiveEventSaved.js'
import { buildJudgePrompt } from './core/conversationJudge.js'
import { SYSTEM_INSTRUCTION, buildInterventionPrompt } from './core/interventionPolicy.js'
import { MIN_GAP, ROLE, describeRoles, roleEntryFor, rolesOf } from './core/roles.js'
import { startSessionBot } from './startSessionBot.js'

const members = [
  { studentId: 'u1', displayName: 'Ana Torres' },
  { studentId: 'u2', displayName: 'Luis Pérez' },
]

describe('rolesOf', () => {
  it('the student who masters the topic guides and the one who is learning it learns; the key is the normalized name', () => {
    const context = rolesOf({ members, mastery: { u1: 0.9, u2: 0.4 }, skillId: 'multiplication' })
    expect(context).toEqual({
      topic: 'multiplication',
      roles: { 'ana torres': { role: ROLE.GUIDE, mastery: 0.9 }, 'luis perez': { role: ROLE.LEARNER, mastery: 0.4 } },
    })
  })

  it('a similar level is a peer pair: nobody is labelled', () => {
    const context = rolesOf({ members, mastery: { u1: 0.6, u2: 0.6 - MIN_GAP / 2 }, skillId: 'division' })
    expect(Object.values(context.roles).map((r) => r.role)).toEqual([ROLE.PEER, ROLE.PEER])
  })

  it('in a trio: top guides, bottom learns, the middle is a peer', () => {
    const trio = [...members, { studentId: 'u3', displayName: 'Rosa Díaz' }]
    const context = rolesOf({ members: trio, mastery: { u1: 0.9, u2: 0.2, u3: 0.55 }, skillId: 'addition' })
    expect(context.roles['ana torres'].role).toBe(ROLE.GUIDE)
    expect(context.roles['luis perez'].role).toBe(ROLE.LEARNER)
    expect(context.roles['rosa diaz'].role).toBe(ROLE.PEER)
  })

  it('returns null without enough information: no skill, one person, or unknown mastery', () => {
    expect(rolesOf({ members, mastery: { u1: 0.9, u2: 0.4 }, skillId: null })).toBeNull()
    expect(rolesOf({ members: [members[0]], mastery: { u1: 0.9 }, skillId: 'addition' })).toBeNull()
    expect(rolesOf({ members, mastery: { u1: 0.9 }, skillId: 'addition' })).toBeNull()
    expect(rolesOf({ members, mastery: { u1: 'alto', u2: 7 }, skillId: 'addition' })).toBeNull()
    expect(rolesOf({})).toBeNull()
  })
})

describe('describeRoles: one line for the prompt, no numbers', () => {
  const context = rolesOf({ members, mastery: { u1: 0.9, u2: 0.4 }, skillId: 'multiplication' })

  it('names who handles the topic better and who is learning it, using only people who are in the room', () => {
    const line = describeRoles(context, ['ana torres', 'luis perez'])
    expect(line).toBe('Según el diagnóstico, Ana maneja mejor multiplicación y Luis lo está aprendiendo.')
    expect(line).not.toMatch(/\d/)
    expect(describeRoles(context, ['ana torres'])).toBe('')
    expect(describeRoles(context, ['ana torres', 'otro nombre'])).toBe('')
  })

  it('says the level is similar for a peer pair, and nothing without data', () => {
    const peers = rolesOf({ members, mastery: { u1: 0.6, u2: 0.58 }, skillId: 'division' })
    expect(describeRoles(peers, ['ana torres', 'luis perez'])).toContain('nivel parecido en división')
    expect(describeRoles(null, ['ana torres'])).toBe('')
  })

  it('finds a person whose Meet name differs a little by first name, but never guesses among several', () => {
    expect(roleEntryFor(context, 'ana')).toMatchObject({ role: ROLE.GUIDE })
    const twins = { roles: { 'ana a': { role: ROLE.GUIDE }, 'ana b': { role: ROLE.LEARNER } } }
    expect(roleEntryFor(twins, 'ana')).toBeNull()
    expect(roleEntryFor(context, null)).toBeNull()
  })
})

describe('the tutor uses the roles to ask better, but is forbidden to reveal levels', () => {
  const signal = { type: 'STUCK', participantKey: 'luis perez', t: 5, evidence: {} }
  const line = 'Según el diagnóstico, Ana maneja mejor multiplicación y Luis lo está aprendiendo.'

  it('puts the line in the intervention prompt and in the observer prompt', () => {
    expect(buildInterventionPrompt({ signal, rolesLine: line }).userPrompt).toContain(line)
    expect(buildJudgePrompt({ transcriptTail: [], humans: ['ana torres', 'luis perez'], rolesLine: line }).userPrompt).toContain(line)
    expect(buildInterventionPrompt({ signal }).userPrompt).not.toContain('Según el diagnóstico')
  })

  it('both system instructions forbid saying anyone’s level', () => {
    expect(SYSTEM_INSTRUCTION).toMatch(/NUNCA digas el nivel de nadie/)
    expect(buildJudgePrompt({ transcriptTail: [], humans: [] }).systemInstruction).toMatch(/NUNCA digas el nivel de nadie/)
  })

  it('afterLiveEventSaved reads the room context and passes the line to the model', async () => {
    const context = rolesOf({ members, mastery: { u1: 0.9, u2: 0.4 }, skillId: 'multiplication' })
    const store = {
      createIntervention: vi.fn().mockResolvedValue({ created: true }),
      getContext: vi.fn().mockResolvedValue(context),
    }
    const generate = vi.fn().mockResolvedValue('Luis, ¿qué parte de la multiplicación te cuesta más?')
    const hook = createAfterLiveEventSaved({ getStore: () => store, getGenerate: () => generate, logger: { info: vi.fn() }, now: () => 1 })
    await hook({ sessionId: 's1', result: { intervention: signal, context: { problem: null, transcriptTail: [], present: ['ana torres', 'luis perez', 'tutor koeduko'] } } })
    expect(store.getContext).toHaveBeenCalledWith('s1')
    expect(generate.mock.calls[0][0].userPrompt).toContain('Ana maneja mejor multiplicación y Luis lo está aprendiendo')
  })

  it('still speaks when the context cannot be read', async () => {
    const store = { createIntervention: vi.fn().mockResolvedValue({ created: true }), getContext: vi.fn().mockRejectedValue(new Error('firestore')) }
    const hook = createAfterLiveEventSaved({ getStore: () => store, getGenerate: () => null, logger: { info: vi.fn() }, now: () => 1 })
    await hook({ sessionId: 's1', result: { intervention: signal, context: { problem: null, transcriptTail: [], present: ['ana torres', 'luis perez'] } } })
    expect(store.createIntervention).toHaveBeenCalledTimes(1)
  })
})

describe('startSessionBot assigns the roles without blocking the bot', () => {
  const config = { apiKey: 'k', region: 'us-west-2', webhookUrl: 'https://x.test/api/recall-webhook', webhookToken: 't', language: 'es' }
  const base = () => ({
    claimBot: vi.fn().mockResolvedValue({ meetingUrl: 'https://meet.google.com/abc-defg-hij' }),
    setBotId: vi.fn().mockResolvedValue(undefined),
    markBotFailed: vi.fn().mockResolvedValue(undefined),
  })

  it('reports it, and swallows a failure', async () => {
    const ok = await startSessionBot({ sessionId: 's1', nowMs: 1, config, store: { ...base(), ensureContext: vi.fn().mockResolvedValue({ created: true }) }, createBot: vi.fn().mockResolvedValue({ botId: 'b' }) })
    expect(ok.rolesAssigned).toBe(true)
    const failed = await startSessionBot({ sessionId: 's1', nowMs: 1, config, store: { ...base(), ensureContext: vi.fn().mockRejectedValue(new Error('x')) }, createBot: vi.fn().mockResolvedValue({ botId: 'b' }) })
    expect(failed).toMatchObject({ botId: 'b', rolesAssigned: false })
  })
})

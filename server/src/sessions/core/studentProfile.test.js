import { describe, expect, it } from 'vitest'
import { adjustConfig, describeProfile, emptyProfile, profileFromReport } from './studentProfile.js'

const student = (extra = {}) => ({
  key: 'estudiante a',
  name: 'Luis Rojas',
  resumen: { talkPct: 12, turns: 1 },
  capacidades: [
    { id: 'traduce', estado: 'sin evidencia suficiente', señales: ['STUCK'], nota: 'Mostró dificultad al plantear el problema.', evidencias: [{ cita: 'no entiendo el cuarenta y ocho' }] },
    { id: 'comunica', estado: 'sin evidencia suficiente', señales: ['SILENT_PEER'] },
    { id: 'usa-estrategias', estado: 'evidencia parcial', señales: ['WRONG_ANSWER'] },
    { id: 'argumenta', estado: 'con evidencia', señales: ['CLASIFICADOR'] },
  ],
  ...extra,
})

describe('studentProfile', () => {
  it('emptyProfile devuelve la estructura base', () => {
    expect(emptyProfile()).toEqual({ v: 1, sessions: 0, skills: {}, signals: {} })
  })

  it('suma una sesion sin mutar el perfil anterior ni sus conteos anidados', () => {
    const prev = profileFromReport(emptyProfile(), { ...student(), skillId: 'multiplication' })
    const next = profileFromReport(prev, { ...student(), skillId: 'multiplication' })

    expect(next).not.toBe(prev)
    expect(prev.sessions).toBe(1)
    expect(next.sessions).toBe(2)
    expect(prev.skills.multiplication.sessions).toBe(1)
    expect(next.skills.multiplication.sessions).toBe(2)
    expect(prev.signals.STUCK).toBe(1)
    expect(next.signals.STUCK).toBe(2)
  })

  it('acumula sesiones de la habilidad y veces de cada senal, nunca texto', () => {
    const profile = profileFromReport(emptyProfile(), { ...student(), skillId: 'multiplication' })

    expect(profile.skills.multiplication).toEqual({ sessions: 1, conEvidencia: 1, parcial: 1, sinEvidencia: 2 })
    expect(profile.signals).toEqual({ STUCK: 1, SILENT_PEER: 1, WRONG_ANSWER: 1 })
    expect(JSON.stringify(profile)).not.toContain('Luis')
    expect(JSON.stringify(profile)).not.toContain('cuarenta')
    expect(JSON.stringify(profile)).not.toContain('CLASIFICADOR')
  })

  it('lee senales y habilidad del reporte completo de un solo estudiante', () => {
    const report = {
      problema: { skillId: 'addition', text: 'Luis compro 48 lapices' },
      estudiantes: [student({ capacidades: [{ id: 'comunica', estado: 'con evidencia', senales: ['DOMINANCE'] }] })],
    }
    const profile = profileFromReport(emptyProfile(), report)

    expect(profile.skills.addition.sessions).toBe(1)
    expect(profile.skills.addition.conEvidencia).toBe(1)
    expect(profile.signals.DOMINANCE).toBe(1)
    expect(JSON.stringify(profile)).not.toContain('Luis')
    expect(JSON.stringify(profile)).not.toContain('48')
  })

  it('no mezcla una pareja en un solo perfil', () => {
    const report = { problema: { skillId: 'addition' }, estudiantes: [student(), student()] }
    expect(profileFromReport(emptyProfile(), report)).toEqual(emptyProfile())
  })

  it('un perfil vacio devuelve un config identico y no lo muta', () => {
    const base = { silentPeerRatio: 0.15, minPresenceSec: 30, dominanceRatio: 0.7, windowSec: 180, cooldownSec: 90, disabledSignals: ['GROUP_SILENCE'] }
    const adjusted = adjustConfig(base, emptyProfile(), { skillId: 'multiplication' })

    expect(adjusted).toEqual(base)
    expect(base.disabledSignals).toEqual(['GROUP_SILENCE'])
    adjusted.silentPeerRatio = 0
    expect(base.silentPeerRatio).toBe(0.15)
  })

  it('SILENT_PEER baja ratio y presencia un paso, nunca mas del 20 %', () => {
    const base = { silentPeerRatio: 0.15, minPresenceSec: 30, cooldownSec: 90 }
    const adjusted = adjustConfig(base, { signals: { SILENT_PEER: 9 } }, {})

    expect(adjusted.silentPeerRatio).toBeCloseTo(0.12)
    expect(adjusted.minPresenceSec).toBeCloseTo(24)
    expect(adjusted.silentPeerRatio).toBeGreaterThanOrEqual(0.15 * 0.8)
    expect(adjusted.minPresenceSec).toBeGreaterThanOrEqual(30 * 0.8)
    expect(adjusted.cooldownSec).toBe(90)
  })

  it('DOMINANCE baja dominanceRatio un paso, con el mismo tope', () => {
    const base = { dominanceRatio: 0.7 }
    const once = adjustConfig(base, { signals: { DOMINANCE: 1 } }, {})
    const many = adjustConfig(base, { signals: { DOMINANCE: 100 } }, {})

    expect(once.dominanceRatio).toBeCloseTo(0.56)
    expect(many.dominanceRatio).toBeCloseTo(0.56)
    expect(once.dominanceRatio).toBeGreaterThanOrEqual(0.7 * 0.8)
  })

  it('STUCK en la habilidad pedida achica la ventana, y no toca disabledSignals', () => {
    const base = { windowSec: 180, cooldownSec: 90, disabledSignals: ['GROUP_SILENCE'] }
    const profile = {
      signals: { STUCK: 4 },
      skills: { multiplication: { sessions: 2, conEvidencia: 0, parcial: 0, sinEvidencia: 3 } },
    }
    const adjusted = adjustConfig(base, profile, { skillId: 'multiplication' })
    const otherSkill = adjustConfig(base, profile, { skillId: 'addition' })

    expect(adjusted.windowSec).toBeCloseTo(144)
    expect(adjusted.windowSec).toBeGreaterThanOrEqual(180 * 0.8)
    expect(otherSkill.windowSec).toBe(180)
    expect(adjusted.cooldownSec).toBe(90)
    expect(adjusted.disabledSignals).toEqual(['GROUP_SILENCE'])
  })

  it('un conteo enorme no rompe el tope del ajuste', () => {
    const base = { silentPeerRatio: 0.15, dominanceRatio: 0.7, minPresenceSec: 30 }
    const adjusted = adjustConfig(base, { signals: { SILENT_PEER: 1e15, DOMINANCE: 1e15 } }, {})

    expect(adjusted.silentPeerRatio).toBeGreaterThanOrEqual(0.15 * 0.8)
    expect(adjusted.dominanceRatio).toBeGreaterThanOrEqual(0.7 * 0.8)
  })

  it('entrada malformada o enorme no lanza ni guarda texto', () => {
    expect(() => profileFromReport(null, null)).not.toThrow()
    expect(profileFromReport(emptyProfile(), null)).toEqual(emptyProfile())
    expect(profileFromReport(emptyProfile(), 'basura')).toEqual(emptyProfile())
    expect(profileFromReport(emptyProfile(), { capacidades: null, senales: 'no-array', name: 'Ana' }).sessions).toBe(0)

    const huge = { skillId: 'multiplication', capacidades: [{ id: 'traduce', estado: 'con evidencia', señales: Array(5000).fill('STUCK') }] }
    const profile = profileFromReport({ sessions: -3, skills: { multiplication: { sessions: 1e9 } }, signals: { STUCK: 1e9, NOTA: 'texto' } }, huge)
    expect(profile.sessions).toBeLessThanOrEqual(10000)
    expect(profile.signals.STUCK).toBeLessThanOrEqual(10000)
    expect(profile.signals.NOTA).toBeUndefined()
    expect(JSON.stringify(profile)).not.toContain('Ana')
  })

  it('describeProfile arma una a tres frases sin cifras ni nombres', () => {
    const profile = profileFromReport(emptyProfile(), { ...student(), skillId: 'multiplication' })
    const text = describeProfile(profile, { skillId: 'multiplication' })
    const sentences = text.split(/(?<=\.)\s+/).filter(Boolean)

    expect(describeProfile(emptyProfile(), {})).toBe('Sin patrones claros aun.')
    expect(sentences.length).toBeGreaterThanOrEqual(1)
    expect(sentences.length).toBeLessThanOrEqual(3)
    expect(text).not.toMatch(/\d/)
    expect(text).not.toContain('Luis')
    expect(text).not.toContain('cuarenta')
  })
})

import { describe, expect, it } from 'vitest'
import { EVIDENCE_STATE } from '@/shared/constants/contracts'
import { clock, closeNotes, stateMeta } from './competency'

describe('stateMeta', () => {
  it('labels the three states as evidence, never as a grade', () => {
    expect(stateMeta(EVIDENCE_STATE.WITH)).toEqual({ label: 'Con evidencia', tone: 'success' })
    expect(stateMeta(EVIDENCE_STATE.PARTIAL)).toEqual({ label: 'Evidencia parcial', tone: 'warning' })
    expect(stateMeta(EVIDENCE_STATE.NONE)).toEqual({ label: 'Sin evidencia suficiente', tone: 'neutral' })
    for (const state of Object.values(EVIDENCE_STATE)) expect(stateMeta(state).label).not.toMatch(/\b(AD|A|B|C)\b|nota|logro/i)
  })

  it('falls back to "sin evidencia" for an unknown state', () => {
    expect(stateMeta('algo raro').label).toBe('Sin evidencia suficiente')
    expect(stateMeta(undefined).tone).toBe('neutral')
  })
})

describe('clock', () => {
  it.each([[0, '0:00'], [24, '0:24'], [24.9, '0:24'], [65, '1:05'], [725, '12:05']])('%s -> %s', (seconds, expected) => {
    expect(clock(seconds)).toBe(expected)
  })

  it.each([[-1], [NaN], [undefined], [null]])('is empty for %s', (seconds) => {
    expect(clock(seconds)).toBe('')
  })
})

describe('closeNotes', () => {
  it('is empty when everything went well, or there are no steps', () => {
    expect(closeNotes({ leaveCall: 'ok', classifier: 'ok', memory: { enabled: true, saved: 2, failed: 0, skipped: 0 } })).toEqual([])
    expect(closeNotes({ leaveCall: 'skipped', classifier: 'nothing-to-classify', memory: { enabled: false } })).toEqual([])
    expect(closeNotes(null)).toEqual([])
    expect(closeNotes(undefined)).toEqual([])
  })

  it('tells the teacher the tutor is still in the meeting when it could not leave', () => {
    expect(closeNotes({ leaveCall: 'failed:404' })).toEqual(['No se pudo sacar al tutor de la reunión. Sácalo desde Meet.'])
  })

  it('warns when the AI could not classify and when the memory was not saved (counting failed and skipped)', () => {
    const notes = closeNotes({ classifier: 'failed:timeout', memory: { enabled: true, failed: 1, skipped: 1 } })
    expect(notes).toEqual([
      'La IA no pudo clasificar algunas frases: este reporte usa solo reglas.',
      'No se pudo guardar la memoria de 2 estudiantes: el tutor no lo recordará en la próxima sesión.',
    ])
    expect(closeNotes({ memory: { enabled: true, failed: 1 } })[0]).toContain('1 estudiante:')
  })

  it('does not complain about memory when it is turned off', () => {
    expect(closeNotes({ memory: { enabled: false, failed: 3 } })).toEqual([])
  })
})

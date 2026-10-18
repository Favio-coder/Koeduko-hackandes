import { describe, expect, it } from 'vitest'
import { memoryScopeOf, studentKeyOf } from './studentKey.js'

describe('studentKeyOf', () => {
  it('is the uid when the participant is linked to a student', () => {
    expect(studentKeyOf({ studentId: 'uid-123', participantKey: 'ana torres', scope: 'aula-1' })).toBe('uid-123')
  })

  it('is "<scope>:<hash>" otherwise, never containing the name', () => {
    const key = studentKeyOf({ participantKey: 'ana torres', scope: 'docente-1' })
    expect(key).toMatch(/^docente-1:[0-9a-f]{16}$/)
    expect(key).not.toMatch(/ana|torres/)
  })

  it('is deterministic and ignores case, accents and spacing in the name', () => {
    const a = studentKeyOf({ participantKey: 'José  Núñez', scope: 's' })
    expect(studentKeyOf({ participantKey: 'jose nunez', scope: 's' })).toBe(a)
    expect(studentKeyOf({ participantKey: 'Jose Nunez', scope: 's' })).toBe(a)
  })

  it('differs between people and between classrooms', () => {
    const base = studentKeyOf({ participantKey: 'ana', scope: 'aula-1' })
    expect(studentKeyOf({ participantKey: 'luis', scope: 'aula-1' })).not.toBe(base)
    expect(studentKeyOf({ participantKey: 'ana', scope: 'aula-2' })).not.toBe(base)
  })

  it('is null when there is nothing to build it from', () => {
    expect(studentKeyOf({ participantKey: 'ana' })).toBeNull()
    expect(studentKeyOf({ scope: 'aula-1' })).toBeNull()
    expect(studentKeyOf({ participantKey: '  ', scope: 'aula-1' })).toBeNull()
    expect(studentKeyOf({ studentId: '  ', participantKey: null, scope: 'a' })).toBeNull()
  })

  it('never puts an email-looking value in the key', () => {
    const key = studentKeyOf({ participantKey: 'ana@colegio.pe', scope: 'aula-1' })
    expect(key).not.toMatch(/@|colegio/)
  })
})

describe('memoryScopeOf', () => {
  it('prefers the classroom and falls back to the teacher who created the session', () => {
    expect(memoryScopeOf({ classroomId: 'aula-1', createdBy: 'doc-1' })).toBe('aula-1')
    expect(memoryScopeOf({ createdBy: 'doc-1' })).toBe('doc-1')
    expect(memoryScopeOf({})).toBeNull()
    expect(memoryScopeOf(null)).toBeNull()
  })
})

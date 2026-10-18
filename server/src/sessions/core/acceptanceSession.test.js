import { describe, expect, it } from 'vitest'
import { buildAcceptanceSession } from './acceptanceSession.js'
import { problemFromSession } from './liveEngine.js'

const input = { sessionId: 'accept-001', teacherUid: 'uid-docente', meetingUrl: 'https://meet.google.com/htp-bkeg-oeb' }

describe('buildAcceptanceSession', () => {
  it('builds a scheduled session the teacher owns, with no students and the multiplication problem', () => {
    const session = buildAcceptanceSession(input)
    expect(session).toMatchObject({
      meetingUrl: input.meetingUrl,
      meetingProvider: 'google-meet',
      createdBy: 'uid-docente',
      studentIds: [],
      status: 'scheduled',
      currentProblem: { activityId: 'p-01', skillId: 'multiplication', expectedAnswer: 48 },
    })
    expect(session.currentProblem.text).toBe('Hay 6 cajas con 8 lápices cada una. ¿Cuántos lápices hay en total?')
  })

  it('has a bot slot free, so claimBot can invite the tutor', () => {
    expect(buildAcceptanceSession(input).bot).toBeUndefined()
  })

  it('gives the live engine a problem it understands', () => {
    expect(problemFromSession(buildAcceptanceSession(input))).toEqual({
      activityId: 'p-01',
      skillId: 'multiplication',
      text: 'Hay 6 cajas con 8 lápices cada una. ¿Cuántos lápices hay en total?',
      expectedAnswer: 48,
    })
  })

  it.each([
    [{ sessionId: 'smoke-001' }, /accept-/],
    [{ sessionId: 'accept-../x' }, /accept-/],
    [{ teacherUid: ' ' }, /teacherUid/],
    [{ meetingUrl: 'https://evil.example/abc-defg-hij' }, /Meet/],
  ])('rejects %o', (patch, message) => {
    expect(() => buildAcceptanceSession({ ...input, ...patch })).toThrow(message)
  })
})

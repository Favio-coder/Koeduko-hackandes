import { describe, expect, it, vi } from 'vitest'
import { AuthError } from './errors.js'
import { bearerToken, requireSessionMember, requireTeacherFromRequest } from './auth.js'

describe('bearerToken', () => {
  it('extracts the token', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
    expect(bearerToken('bearer   abc')).toBe('abc')
  })

  it.each([undefined, null, '', 'abc', 'Basic abc', 'Bearer', 'Bearer a b'])('rejects %s', (header) => {
    expect(bearerToken(header)).toBeNull()
  })
})

describe('requireTeacherFromRequest', () => {
  const deps = (overrides = {}) => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'u1' }),
    getUserRole: vi.fn().mockResolvedValue('teacher'),
    ...overrides,
  })

  it('returns the uid of a verified teacher', async () => {
    const d = deps()
    await expect(requireTeacherFromRequest('Bearer tok', d)).resolves.toEqual({ uid: 'u1' })
    expect(d.verifyIdToken).toHaveBeenCalledWith('tok')
    expect(d.getUserRole).toHaveBeenCalledWith('u1')
  })

  it('answers unauthenticated without a token and does not verify anything', async () => {
    const d = deps()
    await expect(requireTeacherFromRequest(undefined, d)).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(d.verifyIdToken).not.toHaveBeenCalled()
  })

  it('answers unauthenticated when the token does not verify', async () => {
    const d = deps({ verifyIdToken: vi.fn().mockRejectedValue(new Error('auth/argument-error with details')) })
    const error = await requireTeacherFromRequest('Bearer bad-token', d).catch((e) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.code).toBe('unauthenticated')
    expect(error.message).not.toContain('bad-token')
    expect(error.message).not.toContain('details')
  })

  it.each(['student', null, 'admin'])('answers permission-denied for role %s', async (role) => {
    const d = deps({ getUserRole: vi.fn().mockResolvedValue(role) })
    await expect(requireTeacherFromRequest('Bearer tok', d)).rejects.toMatchObject({ code: 'permission-denied' })
  })
})

describe('requireSessionMember', () => {
  const session = { studentIds: ['u-student', 'u-other'] }
  const deps = (role, stored = session, extra = {}) => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: role === 'teacher' ? 'u-teacher' : 'u-student' }),
    getUserRole: vi.fn().mockResolvedValue(role),
    getSession: vi.fn().mockResolvedValue(stored),
    ...extra,
  })

  it('accepts a student whose uid is in studentIds, and returns the session', async () => {
    await expect(requireSessionMember('Bearer tok', 's1', deps('student'))).resolves.toEqual({ uid: 'u-student', role: 'student', session })
  })

  it('accepts a teacher for any existing session', async () => {
    await expect(requireSessionMember('Bearer tok', 's1', deps('teacher'))).resolves.toMatchObject({ uid: 'u-teacher', role: 'teacher' })
  })

  it('rejects a student who is not in studentIds, or a session without studentIds', async () => {
    const stranger = deps('student', { studentIds: ['u-someone-else'] })
    await expect(requireSessionMember('Bearer tok', 's1', stranger)).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(requireSessionMember('Bearer tok', 's1', deps('student', {}))).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(requireSessionMember('Bearer tok', 's1', deps('student', { studentIds: 'u-student' }))).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('gives a student the same error for a missing session as for someone else\'s, and a teacher a 404', async () => {
    const asStudent = await requireSessionMember('Bearer tok', 's1', deps('student', null)).catch((e) => e)
    expect(asStudent).toMatchObject({ code: 'permission-denied', message: 'No perteneces a esta sesion.' })
    await expect(requireSessionMember('Bearer tok', 's1', deps('teacher', null))).rejects.toMatchObject({ code: 'not-found' })
  })

  it('rejects users without a valid role before reading the session', async () => {
    const d = deps(null)
    await expect(requireSessionMember('Bearer tok', 's1', d)).rejects.toMatchObject({ code: 'permission-denied' })
    expect(d.getSession).not.toHaveBeenCalled()
  })

  it('answers unauthenticated for a missing or invalid token without any further reads', async () => {
    const d = deps('student')
    await expect(requireSessionMember(undefined, 's1', d)).rejects.toMatchObject({ code: 'unauthenticated' })
    const bad = deps('student', session, { verifyIdToken: vi.fn().mockRejectedValue(new Error('expired token-detail')) })
    const error = await requireSessionMember('Bearer secret-token', 's1', bad).catch((e) => e)
    expect(error.code).toBe('unauthenticated')
    expect(error.message).not.toContain('secret-token')
    expect(error.message).not.toContain('token-detail')
    expect(bad.getUserRole).not.toHaveBeenCalled()
  })
})

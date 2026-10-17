import { describe, expect, it, vi } from 'vitest'
import { AuthError } from './errors.js'
import { bearerToken, requireTeacherFromRequest } from './auth.js'

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

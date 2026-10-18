import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { adminServices, publish, meeting } = vi.hoisted(() => ({ adminServices: vi.fn(), publish: vi.fn(), meeting: vi.fn() }))
vi.mock('../../../../server/firebaseAdmin.js', () => ({ adminServices }))
vi.mock('../../../../server/assessments/groupSessions.js', () => ({ publishGroupSessions: publish, registerMeeting: meeting }))
import handler from '../../../../api/group-sessions'
import { AssessmentError } from '../../../../server/assessments/domain'

const response = () => ({ setHeader: vi.fn(), status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
const request = (body = { action: 'publish' }) => ({ method: 'POST', headers: { authorization: 'Bearer token' }, body })
beforeEach(() => {
  vi.clearAllMocks()
  adminServices.mockReturnValue({ auth: { verifyIdToken: async () => ({ uid: 'teacher' }) }, db: {} })
  publish.mockResolvedValue({ sessionIds: ['s1'] })
})
afterEach(() => vi.restoreAllMocks())
describe('API de confirmación de salas', () => {
  it('exige POST y token', async () => {
    let res = response()
    await handler({ method: 'GET' }, res)
    expect(res.code).toBe(405)
    res = response()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.code).toBe(401)
    expect(publish).not.toHaveBeenCalled()
  })
  it('rechaza un token vencido antes de publicar', async () => {
    adminServices.mockReturnValue({ auth: { verifyIdToken: async () => { throw new Error('expired') } } })
    const res = response()
    await handler(request(), res)
    expect(res.code).toBe(401)
    expect(publish).not.toHaveBeenCalled()
  })
  it('usa la identidad verificada y no el dueño enviado en el cuerpo', async () => {
    const res = response()
    await handler(request({ action: 'publish', createdBy: 'impostor' }), res)
    expect(res.code).toBe(200)
    expect(publish.mock.calls[0][1]).toBe('teacher')
    expect(res.body.sessionIds).toEqual(['s1'])
  })
  it('preserva los errores de autorización y rechaza JSON malformado', async () => {
    let res = response()
    await handler(request('{'), res)
    expect(res.code).toBe(400)
    publish.mockRejectedValue(new AssessmentError(403, 'No tienes acceso'))
    res = response()
    await handler(request(), res)
    expect(res.code).toBe(403)
    expect(res.body.error).toBe('No tienes acceso')
  })
})

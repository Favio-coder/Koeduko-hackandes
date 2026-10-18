import { afterEach, describe, expect, it, vi } from 'vitest'
const { auth } = vi.hoisted(() => ({ auth: { currentUser: null } }))
vi.mock('@/services/firebase', () => ({ auth }))
import { createRoomsFromMatching, saveMeetingUrl } from './groupSessionService'
afterEach(() => { vi.unstubAllGlobals(); auth.currentUser = null })
const result = () => ({
  status: 'optimal', source: { containsSimulatedData: false }, courseId: 'course', assessmentId: 'exam',
  groups: [{ studentIds: ['a', 'b'], focusSkillIds: ['addition'] }],
  assessmentEvidence: [{ studentId: 'a', skills: [] }],
})
describe('puente autenticado Resultados y Salas', () => {
  it('envía integrantes y evidencia con token, sin nombres ni permisos del cliente', async () => {
    auth.currentUser = { getIdToken: async () => 'token' }
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionIds: ['session'] }) })
    vi.stubGlobal('fetch', fetch)
    await createRoomsFromMatching(result())
    const [url, request] = fetch.mock.calls[0]
    expect(url).toBe('/api/group-sessions')
    expect(request.headers.Authorization).toBe('Bearer token')
    expect(JSON.parse(request.body)).toEqual({ action: 'publish', courseId: 'course', assessmentId: 'exam', groups: result().groups, assessmentEvidence: result().assessmentEvidence })
  })
  it('rechaza la demo y no publica sin iniciar sesión', async () => {
    expect(() => createRoomsFromMatching({ ...result(), source: { containsSimulatedData: true } })).toThrow()
    await expect(createRoomsFromMatching(result())).rejects.toThrow('Inicia sesión')
  })
  it('propaga errores del servidor al registrar un enlace', async () => {
    auth.currentUser = { getIdToken: async () => 'token' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'No tienes acceso' }) }))
    await expect(saveMeetingUrl('session', 'https://meet.google.com/abc-defg-hij')).rejects.toThrow('No tienes acceso')
  })
})

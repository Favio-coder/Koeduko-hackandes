import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ currentUser: null }))
vi.mock('@/services/firebase', () => ({ auth: authState }))

import { inviteTutor } from './sessionBotService'

const signedIn = () => {
  authState.currentUser = { getIdToken: vi.fn().mockResolvedValue('id-token-abc') }
}

beforeEach(() => {
  authState.currentUser = null
})

describe('inviteTutor', () => {
  it('calls POST /api/start-session-bot with the user\'s ID token and only the session id', async () => {
    signedIn()
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ botId: 'bot-1', status: 'requested' }) })

    const result = await inviteTutor({ sessionId: 'session-001' }, { fetchImpl })

    expect(result).toEqual({ botId: 'bot-1', status: 'requested' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://koeduko.vercel.app/api/start-session-bot')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer id-token-abc')
    // el enlace de Meet NUNCA viaja desde el navegador: el servidor lo lee de la sesion
    expect(JSON.parse(init.body)).toEqual({ sessionId: 'session-001' })
  })

  it('requires a session id and a signed-in user before touching the network', async () => {
    const fetchImpl = vi.fn()
    await expect(inviteTutor({ sessionId: '' }, { fetchImpl })).rejects.toThrow('sessionId es obligatorio')
    await expect(inviteTutor({ sessionId: 's1' }, { fetchImpl })).rejects.toThrow('Debes iniciar sesión')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    [409, 'El tutor ya fue invitado a esta sesion.'],
    [403, 'Se requiere rol docente.'],
    [404, 'La sesion no existe.'],
  ])('shows the server\'s own message for a %i', async (status, message) => {
    signedIn()
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ error: 'x', message }) })
    await expect(inviteTutor({ sessionId: 's1' }, { fetchImpl })).rejects.toThrow(message)
  })

  it('explains a network failure and a body-less error in plain words', async () => {
    signedIn()
    await expect(inviteTutor({ sessionId: 's1' }, { fetchImpl: vi.fn().mockRejectedValue(new TypeError('x')) })).rejects.toThrow('No se pudo conectar con el servidor de sesiones')
    const noBody = vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => Promise.reject(new Error('html')) })
    await expect(inviteTutor({ sessionId: 's1' }, { fetchImpl: noBody })).rejects.toThrow('El servidor de sesiones respondió con un error (502).')
  })

  it('does not report success when the server does not confirm the bot', async () => {
    signedIn()
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    await expect(inviteTutor({ sessionId: 's1' }, { fetchImpl })).rejects.toThrow('no confirmó')
  })
})

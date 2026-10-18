import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ currentUser: null }))
vi.mock('@/services/firebase', () => ({ auth: authState }))

import { SERVER_URL, askTutor } from './tutorService'

const signedIn = () => {
  authState.currentUser = { getIdToken: vi.fn().mockResolvedValue('id-token-123') }
}
const reply = (body, init = {}) => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body, ...init })

beforeEach(() => {
  authState.currentUser = null
})

describe('askTutor (server endpoint)', () => {
  it('calls POST /api/ask-tutor with the user\'s ID token and returns the hint', async () => {
    signedIn()
    const fetchImpl = reply({ reply: 'Piensa en grupos de 8. ¿Cuántos grupos tienes?', source: 'gemini' })

    const hint = await askTutor({ sessionId: 's1', prompt: '  no sé cómo empezar  ' }, { fetchImpl })

    expect(hint).toBe('Piensa en grupos de 8. ¿Cuántos grupos tienes?')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${SERVER_URL}/api/ask-tutor`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer id-token-123')
    expect(JSON.parse(init.body)).toEqual({ sessionId: 's1', prompt: 'no sé cómo empezar' })
  })

  it('points at the production server by default and never at Gemini or a callable function', () => {
    expect(SERVER_URL).toBe('https://koeduko.vercel.app')
    expect(SERVER_URL).not.toMatch(/googleapis|cloudfunctions/)
  })

  it('validates the input before touching the network', async () => {
    signedIn()
    const fetchImpl = reply({ reply: 'x' })
    await expect(askTutor({ sessionId: '', prompt: 'hola' }, { fetchImpl })).rejects.toThrow('sessionId es obligatorio')
    await expect(askTutor({ sessionId: 's1', prompt: '   ' }, { fetchImpl })).rejects.toThrow('prompt es obligatorio')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('asks to sign in when there is no user, without calling the server', async () => {
    const fetchImpl = reply({ reply: 'x' })
    await expect(askTutor({ sessionId: 's1', prompt: 'hola' }, { fetchImpl })).rejects.toThrow('Debes iniciar sesión')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('shows the server\'s message for a rejected request (for example, not in that session)', async () => {
    signedIn()
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'permission-denied', message: 'No perteneces a esta sesion.' }) })
    await expect(askTutor({ sessionId: 's1', prompt: 'hola' }, { fetchImpl })).rejects.toThrow('No perteneces a esta sesion.')
  })

  it('uses a generic message when the error has no readable body', async () => {
    signedIn()
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => Promise.reject(new Error('html')) })
    await expect(askTutor({ sessionId: 's1', prompt: 'hola' }, { fetchImpl })).rejects.toThrow('El tutor respondió con un error (502).')
  })

  it('explains a network failure in plain words', async () => {
    signedIn()
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(askTutor({ sessionId: 's1', prompt: 'hola' }, { fetchImpl })).rejects.toThrow('No se pudo conectar con el tutor')
  })

  it('rejects an answer without a reply', async () => {
    signedIn()
    await expect(askTutor({ sessionId: 's1', prompt: 'hola' }, { fetchImpl: reply({}) })).rejects.toThrow('no devolvió una respuesta válida')
    await expect(askTutor({ sessionId: 's1', prompt: 'hola' }, { fetchImpl: reply(null) })).rejects.toThrow('no devolvió una respuesta válida')
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = { isTeacher: true }
const live = { current: null }

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../hooks/useLiveSession', () => ({ useLiveSession: () => live.current }))
vi.mock('../hooks/useSessionSummary', () => ({ useSessionSummary: () => ({ summary: null, ready: true }) }))
vi.mock('../services/sessionBotService', () => ({ inviteTutor: vi.fn() }))

import { inviteTutor } from '../services/sessionBotService'
import SessionDetailPage from './SessionDetailPage'

const NOW = Date.now()

const VIEW = {
  windowSec: 180,
  totalSpeechSec: 40,
  participants: [
    { key: 'a', name: 'Estudiante A', sharePct: 60, speaking: true },
    { key: 'b', name: 'Estudiante B', sharePct: 0, speaking: false },
  ],
  transcripts: [
    { key: 'a', name: 'Estudiante A', text: 'cuanto es tres por cuatro', t: 1 },
    { key: 'c', name: 'Estudiante C', text: 'creo que doce', t: 2 },
  ],
}

const INTERVENTIONS = [
  {
    id: 'i2',
    signal: 'SILENT_PEER',
    message: 'Estudiante B, que opinas?',
    targetName: 'Estudiante B',
    participantKey: 'estudiante b',
    evidence: { shares: { 'estudiante a': 1, 'estudiante b': 0 }, windowSec: 180, presentSec: 55 },
    createdMs: NOW - 5000,
  },
  { id: 'i1', signal: 'DOMINANCE', message: 'Dejen hablar a todos.', evidence: {}, createdMs: NOW - 120000 },
]

const state = (patch) => ({ loading: false, error: null, session: null, view: null, interventions: [], retry: vi.fn(), ...patch })

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/sessions/smoke-replay-003']}>
      <Routes>
        <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SessionDetailPage', () => {
  beforeEach(() => {
    auth.isTeacher = true
    inviteTutor.mockReset()
    live.current = state({})
  })

  describe('Entrar al Meet trae al tutor solo', () => {
    const room = (bot) => state({ session: { title: 'Pareja', status: 'scheduled', meetingUrl: 'https://meet.google.com/abc-defg-hij', ...(bot ? { bot } : {}) } })

    it('opens the Meet and invites the tutor when nobody has invited it yet (teacher or student of the room)', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      inviteTutor.mockResolvedValue({ botId: 'b1' })
      for (const isTeacher of [true, false]) {
        auth.isTeacher = isTeacher
        inviteTutor.mockClear()
        live.current = room()
        const { unmount } = renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
        expect(open).toHaveBeenCalledWith('https://meet.google.com/abc-defg-hij', '_blank', 'noreferrer')
        await waitFor(() => expect(inviteTutor).toHaveBeenCalledWith({ sessionId: 'smoke-replay-003' }))
        unmount()
      }
      open.mockRestore()
    })

    it('does not invite again when the tutor is already requested, in the call, or the room is closed', () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      for (const bot of [{ status: 'requested' }, { status: 'in_call' }]) {
        live.current = room(bot)
        const { unmount } = renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
        unmount()
      }
      live.current = state({ session: { title: 'Pareja', status: 'completed', meetingUrl: 'https://meet.google.com/abc-defg-hij' } })
      const { unmount } = renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
      unmount()
      expect(inviteTutor).not.toHaveBeenCalled()
      expect(open).toHaveBeenCalledTimes(3)
      open.mockRestore()
    })

    it('still opens the Meet if the invitation fails (the teacher keeps the manual button)', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      inviteTutor.mockRejectedValue(new Error('El tutor ya fue invitado a esta sesion.'))
      live.current = room()
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
      expect(open).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(inviteTutor).toHaveBeenCalled())
      open.mockRestore()
    })
  })

  it('shows loading', () => {
    live.current = state({ loading: true })
    renderPage()
    expect(screen.getByText('Cargando sesión...')).toBeInTheDocument()
  })

  it('shows the error and retries', () => {
    const retry = vi.fn()
    live.current = state({ error: 'No tienes permiso para ver esta sesión.', retry })
    renderPage()
    expect(screen.getByText('No tienes permiso para ver esta sesión.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(retry).toHaveBeenCalled()
  })

  it('keeps the invite button and the problem visible when the live data fails to load', () => {
    live.current = state({
      error: 'No tienes permiso para ver esta sesión.',
      session: { title: 'Pareja 1', currentProblem: { text: 'Hay 6 cajas con 8 lápices cada una.', expectedAnswer: 48 } },
    })
    renderPage()
    expect(screen.getByText('No tienes permiso para ver esta sesión.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invitar tutor' })).toBeInTheDocument()
    expect(screen.getByText('Hay 6 cajas con 8 lápices cada una.')).toBeInTheDocument()
  })

  it('shows the problem statement but never its expected answer', () => {
    live.current = state({ session: { currentProblem: { text: '¿Cuántos lápices hay en total?', expectedAnswer: 48 } } })
    const { container } = renderPage()
    expect(screen.getByText('¿Cuántos lápices hay en total?')).toBeInTheDocument()
    expect(container.textContent).not.toContain('48')
  })

  it('shows "Esperando al tutor…" when there is no activity, with a fallback title', () => {
    renderPage()
    expect(screen.getByText('Esperando al tutor…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sesión smoke-replay-003' })).toBeInTheDocument()
  })

  it('shows interventions even when the view document does not exist yet (smoke-replay-003)', () => {
    live.current = state({ interventions: INTERVENTIONS })
    renderPage()
    expect(screen.queryByText('Esperando al tutor…')).not.toBeInTheDocument()
    expect(screen.getByText('Estudiante B, que opinas?')).toBeInTheDocument()
  })

  it('draws the speech share with percentages, the transcript and the interventions newest first', () => {
    live.current = state({ view: VIEW, interventions: INTERVENTIONS, session: { title: 'Pareja 1' } })
    renderPage()

    expect(screen.getByRole('heading', { name: 'Pareja 1' })).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('Hablando ahora')).toBeInTheDocument()
    expect(screen.getByText(/cuanto es tres por cuatro/)).toBeInTheDocument()
    expect(screen.getByText(/creo que doce/)).toBeInTheDocument()

    const list = screen.getByRole('list', { name: /intervenciones del tutor/i })
    const messages = Array.from(list.querySelectorAll('li')).map((li) => li.textContent)
    expect(messages[0]).toContain('Estudiante B, que opinas?')
    expect(messages[1]).toContain('Dejen hablar a todos.')
    expect(messages[0]).toContain('Estudiante B habló 0% en los últimos 55 s')
  })

  it('offers "Invitar tutor" only to the teacher', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Invitar tutor' })).toBeInTheDocument()

    auth.isTeacher = false
    renderPage()
    expect(screen.getAllByRole('button', { name: 'Invitar tutor' })).toHaveLength(1)
  })

  it('does not render the invite button for a student', () => {
    auth.isTeacher = false
    renderPage()
    expect(screen.queryByRole('button', { name: 'Invitar tutor' })).not.toBeInTheDocument()
  })

  it('invites the tutor with the session id and confirms', async () => {
    inviteTutor.mockResolvedValue({ botId: 'b1' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Invitar tutor' }))
    await waitFor(() => expect(screen.getByText(/Tutor invitado\. Admítelo/)).toBeInTheDocument())
    expect(inviteTutor).toHaveBeenCalledWith({ sessionId: 'smoke-replay-003' })
  })

  it('shows the server message when the invite fails', async () => {
    inviteTutor.mockRejectedValue(new Error('Solo el docente puede invitar al tutor.'))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Invitar tutor' }))
    await waitFor(() => expect(screen.getByText('Solo el docente puede invitar al tutor.')).toBeInTheDocument())
  })

  it('disables the invite while the tutor is requested or in the call', () => {
    live.current = state({ session: { bot: { status: 'in_call' } } })
    renderPage()
    expect(screen.getByRole('button', { name: 'Invitar tutor' })).toBeDisabled()
  })
})

describe('SessionDetailPage: a room without a Meet creates it', () => {
  const withoutMeet = (extra = {}) => ({ session: { title: 'Pareja', status: 'scheduled', meetingUrl: null, ...extra } })

  beforeEach(() => {
    auth.isTeacher = false
    inviteTutor.mockReset()
  })

  it('creates the meeting on the server, opens it in the tab that was opened in the click, and brings the tutor', async () => {
    const popup = { location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(popup)
    inviteTutor.mockResolvedValue({ botId: 'b1', meetingUrl: 'https://meet.google.com/abc-defg-hij', meetingCreated: true })
    live.current = state(withoutMeet())
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Crear reunión y entrar' }))
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    await waitFor(() => expect(popup.location.href).toBe('https://meet.google.com/abc-defg-hij'))
    expect(inviteTutor).toHaveBeenCalledWith({ sessionId: 'smoke-replay-003' })
    open.mockRestore()
  })

  it('closes the blank tab and shows the server message when it cannot (teacher has not connected Google)', async () => {
    const popup = { location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(popup)
    inviteTutor.mockRejectedValue(new Error('La sala no tiene enlace de Meet y el docente aun no conecto su cuenta de Google.'))
    live.current = state(withoutMeet())
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Crear reunión y entrar' }))
    await waitFor(() => expect(popup.close).toHaveBeenCalled())
    expect(popup.location.href).toBe('')
    open.mockRestore()
  })

  it('does not offer it when the room already has a link or is closed', () => {
    live.current = state({ session: { title: 'Pareja', status: 'scheduled', meetingUrl: 'https://meet.google.com/abc-defg-hij' } })
    const { unmount } = renderPage()
    expect(screen.queryByRole('button', { name: 'Crear reunión y entrar' })).not.toBeInTheDocument()
    unmount()

    live.current = state(withoutMeet({ status: 'completed' }))
    renderPage()
    expect(screen.queryByRole('button', { name: 'Crear reunión y entrar' })).not.toBeInTheDocument()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = { isTeacher: true }
const live = { current: null }

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../hooks/useLiveSession', () => ({ useLiveSession: () => live.current }))
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

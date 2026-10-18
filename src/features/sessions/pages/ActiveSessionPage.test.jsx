import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = { user: { uid: 'uid-1' }, isTeacher: true }
const active = { current: null }

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../hooks/useActiveSession', () => ({ useActiveSession: vi.fn(() => active.current) }))

import { useActiveSession } from '../hooks/useActiveSession'
import ActiveSessionPage from './ActiveSessionPage'

const state = (patch) => ({ loading: false, error: null, sessionId: null, retry: vi.fn(), ...patch })
const renderPage = () =>
  render(
    <MemoryRouter>
      <ActiveSessionPage render={(id) => <p>detalle de {id}</p>} />
    </MemoryRouter>,
  )

beforeEach(() => {
  auth.isTeacher = true
  active.current = state({})
  useActiveSession.mockClear()
})

describe('ActiveSessionPage (the "Sesión activa" and "Tutor IA" menu items)', () => {
  it('shows loading while it looks for the session', () => {
    active.current = state({ loading: true })
    renderPage()
    expect(screen.getByText('Buscando tu sesión...')).toBeInTheDocument()
  })

  it('renders the target page with the REAL session id', () => {
    active.current = state({ sessionId: 'accept-mem-3' })
    renderPage()
    expect(screen.getByText('detalle de accept-mem-3')).toBeInTheDocument()
  })

  it('looks the session up for the logged-in user, as teacher or as student', () => {
    active.current = state({ sessionId: 's1' })
    renderPage()
    expect(useActiveSession).toHaveBeenCalledWith('uid-1', true)

    auth.isTeacher = false
    renderPage()
    expect(useActiveSession).toHaveBeenLastCalledWith('uid-1', false)
  })

  it('says there is no active session, and links to the rooms, instead of an empty page', () => {
    renderPage()
    expect(screen.getByText('Todavía no hay una sesión activa')).toBeInTheDocument()
    expect(screen.getByText('Cuando crees una sala para una pareja, aparecerá aquí.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver salas' })).toHaveAttribute('href', '/sessions')

    auth.isTeacher = false
    renderPage()
    expect(screen.getByText('Cuando tu docente te asigne una sala, aparecerá aquí.')).toBeInTheDocument()
  })

  it('shows the error with a retry', () => {
    const retry = vi.fn()
    active.current = state({ error: 'No tienes permiso para ver tus sesiones.', retry })
    renderPage()
    expect(screen.getByText('No tienes permiso para ver tus sesiones.')).toBeInTheDocument()
    screen.getByRole('button', { name: /reintentar/i }).click()
    expect(retry).toHaveBeenCalled()
  })
})

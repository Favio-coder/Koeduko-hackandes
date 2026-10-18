import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

// El router real, con el shell real (DashboardLayout + menu). Solo se falsean Auth y los datos.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'uid-docente', email: 'docente@koeduko.dev' },
    profile: { displayName: 'Docente' },
    role: 'teacher',
    isTeacher: true,
    isAuthenticated: true,
    loading: false,
    logout: vi.fn(),
  }),
}))
vi.mock('@/features/sessions/hooks/useLiveSession', () => ({
  useLiveSession: () => ({
    loading: false,
    error: null,
    session: { title: 'Prueba de aceptacion', bot: { status: 'none' } },
    view: null,
    interventions: [],
    retry: vi.fn(),
  }),
}))
vi.mock('@/features/sessions/hooks/useSessionSummary', () => ({ useSessionSummary: () => ({ summary: null, ready: true }) }))
vi.mock('@/features/sessions/hooks/useActiveSession', () => ({
  useActiveSession: () => ({ loading: false, error: null, sessionId: 'accept-mem-3', retry: vi.fn() }),
}))
vi.mock('@/features/sessions/services/sessionBotService', () => ({ inviteTutor: vi.fn() }))
vi.mock('@/features/ai/services/tutorService', () => ({ askTutor: vi.fn() }))

import AppRouter from './router'

describe('router: /sessions/:sessionId', () => {
  it('paints the live session screen inside the app shell (the main area is not empty)', async () => {
    render(
      <MemoryRouter initialEntries={['/sessions/accept-001']}>
        <AppRouter />
      </MemoryRouter>,
    )

    // La pagina se carga con import() perezoso: con la maquina cargada tarda mas que el 1 s por defecto.
    expect(await screen.findByRole('heading', { name: 'Prueba de aceptacion' }, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invitar tutor' })).toBeInTheDocument()
    expect(screen.getByText('Esperando al tutor…')).toBeInTheDocument()
    // el shell sigue ahi: el contenido va dentro de <main>, junto al menu
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('button', { name: 'Invitar tutor' }))
  }, 15000)
})

describe('router: the menu items "Sesión activa" and "Tutor IA" land on a REAL session', () => {
  it('/sessions/active shows the resolved session (not an empty page) and keeps the menu item marked', async () => {
    render(
      <MemoryRouter initialEntries={['/sessions/active']}>
        <AppRouter />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Prueba de aceptacion' }, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invitar tutor' })).toBeInTheDocument()
    // el enlace al tutor de ESTA pantalla lleva a la sesion real, no a una de demostracion
    expect(screen.getByRole('link', { name: 'Abrir tutor IA' })).toHaveAttribute('href', '/sessions/accept-mem-3/tutor')
  }, 15000)

  it('/sessions/active/tutor opens the tutor for the real session', async () => {
    render(
      <MemoryRouter initialEntries={['/sessions/active/tutor']}>
        <AppRouter />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('link', { name: 'Volver a la sesión' }, { timeout: 10000 })).toHaveAttribute('href', '/sessions/accept-mem-3')
  }, 15000)

  it('the menu no longer points to the demo session', () => {
    render(
      <MemoryRouter initialEntries={['/sessions/active']}>
        <AppRouter />
      </MemoryRouter>,
    )
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links).toContain('/sessions/active')
    expect(links).toContain('/sessions/active/tutor')
    expect(links.some((href) => href?.includes('demo-session'))).toBe(false)
  })
})

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

// El router real, con el shell real (DashboardLayout + menu). Solo se falsean Auth y los datos.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'docente@koeduko.dev' },
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
vi.mock('@/features/sessions/services/sessionBotService', () => ({ inviteTutor: vi.fn() }))

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

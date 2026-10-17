/**
 * Pruebas de la página de Salas tras el rediseño visual.
 *
 * Objetivo: demostrar que NO se rompió funcionalidad — se conservan la fuente de
 * datos (`useSessions`), los estados y los botones Nueva sala · Entrar · Copiar.
 * El hook es un stub en memoria, así que no se toca Firebase.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SessionsPage from '@/features/sessions/pages/SessionsPage'
import { ToastProvider } from '@/components/ui/Toast'

const createSession = vi.fn(async () => ({
  id: 'demo-session-2',
  title: 'Pareja Mia Quispe - Diego Huaman',
  pairId: 'pair-demo-2',
  meetingUrl: null,
  status: 'scheduled',
  scheduledAt: null,
}))

let isTeacher = true
let emptyState = false

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isTeacher, profile: { displayName: 'Docente' } }),
}))

vi.mock('@/features/sessions/hooks/useSessions', () => ({
  useSessions: () => ({
    sessions: emptyState
      ? []
      : [
      {
        id: 'demo-session-1',
        title: 'Pareja Ana Torres - Luis Rojas',
        pairId: 'pair-demo-1',
        meetingUrl: null,
        status: 'scheduled',
        scheduledAt: null,
      },
    ],
    loading: false,
    error: null,
    reload: vi.fn(),
    createSession,
  }),
}))

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <SessionsPage />
      </ToastProvider>
    </MemoryRouter>,
  )

describe('SessionsPage (Salas)', () => {
  beforeEach(() => {
    isTeacher = true
    emptyState = false
    createSession.mockClear()
  })

  it('muestra la lista de salas con sus datos', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Salas de reuniones', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Pareja Ana Torres - Luis Rojas')).toBeInTheDocument()
    expect(screen.getByText('pair-demo-1')).toBeInTheDocument()
  })

  it('conserva el enlace de detalle de cada sala', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Ver detalle/ })).toHaveAttribute(
      'href',
      '/sessions/demo-session-1',
    )
  })

  it('mantiene Entrar y Copiar (deshabilitados sin enlace de Meet)', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeDisabled()
  })

  it('el docente ve Nueva sala y Crear sesión de demostración', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /Nueva sala/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Crear sesión de demostración/ })).toBeInTheDocument()
  })

  it('el estudiante no ve las acciones de creación', () => {
    isTeacher = false
    renderPage()
    expect(screen.queryByRole('button', { name: /Nueva sala/ })).toBeNull()
  })

  it('Nueva sala sigue invocando createSession', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Nueva sala/ }))
    expect(createSession).toHaveBeenCalled()
  })

  it('muestra el estado vacío cuando no hay salas', () => {
    emptyState = true
    renderPage()
    expect(screen.getByText('Sin salas por ahora')).toBeInTheDocument()
  })
})
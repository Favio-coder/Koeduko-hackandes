/**
 * Pruebas de la página de Salas tras el rediseño visual.
 *
 * Objetivo: demostrar que NO se rompió funcionalidad — se conservan la fuente de
 * datos (`useSessions`), los estados y los botones Nueva sala · Entrar · Copiar.
 * El hook real usa Firestore; aquí se sustituye para probar la vista sin red.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SessionsPage from '@/features/sessions/pages/SessionsPage'
import { ToastProvider } from '@/components/ui/Toast'

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
  }),
}))

const renderPage = (path = '/sessions') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <SessionsPage />
      </ToastProvider>
    </MemoryRouter>,
  )

describe('SessionsPage (Salas)', () => {
  beforeEach(() => {
    isTeacher = true
    emptyState = false
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

  it('el docente crea salas desde los grupos confirmados y no desde una demo', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Crear salas desde resultados' })).toHaveAttribute('href', '/matching/results')
    expect(screen.queryByText('Crear sesión de demostración')).not.toBeInTheDocument()
  })

  it('el estudiante no ve las acciones de creación', () => {
    isTeacher = false
    renderPage()
    expect(screen.queryByRole('link', { name: 'Crear salas desde resultados' })).toBeNull()
  })

  it('filtra las salas por el curso y evaluación recibidos desde Resultados', () => {
    renderPage('/sessions?courseId=other&assessmentId=other')
    expect(screen.getByText('Sin salas por ahora')).toBeInTheDocument()
    expect(screen.queryByText('Pareja Ana Torres - Luis Rojas')).not.toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay salas', () => {
    emptyState = true
    renderPage()
    expect(screen.getByText('Sin salas por ahora')).toBeInTheDocument()
  })
})

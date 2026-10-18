import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AppRouter from '@/app/router'
import { MatchingWorker } from './helpers/MatchingWorker'
import { classroomFixture } from './helpers/classroomFixture'

const { session } = vi.hoisted(() => ({ session: {} }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => session }))
vi.mock('@/features/sessions/hooks/useSessions', () => ({ useSessions: () => ({ sessions: [], loading: false, error: null }) }))
const { bootstrap, fetchProfile } = vi.hoisted(() => ({ bootstrap: vi.fn(), fetchProfile: vi.fn() }))
vi.mock('@/features/assessments/services/assessmentService', () => ({ loadBootstrap: bootstrap }))
vi.mock('../services/assessmentProfileService', () => ({ fetchMatchingProfile: fetchProfile }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}|{location.state?.from}</output>
}
const renderApp = (path) => render(<MemoryRouter initialEntries={[path]}><AppRouter /><LocationProbe /></MemoryRouter>)

beforeEach(() => {
  sessionStorage.clear()
  Object.assign(session, { user: { uid: 'teacher-1' }, isAuthenticated: true, loading: false, role: 'teacher', isTeacher: true, profile: { displayName: 'Docente de prueba' } })
  const { catalog, profile } = classroomFixture(5)
  bootstrap.mockResolvedValue(catalog)
  fetchProfile.mockResolvedValue(profile)
  window.scrollTo = vi.fn()
  vi.stubGlobal('Worker', MatchingWorker)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('matching en el router y layout reales', () => {
  it('separa estudiantes de resultados y conserva el último cálculo al volver o recargar la ruta', async () => {
    const worker = vi.fn(function () { return new MatchingWorker() })
    vi.stubGlobal('Worker', worker)
    const view = renderApp('/matching?courseId=course-5a&assessmentId=assessment-final')
    expect(await screen.findByRole('heading', { name: 'Estudiantes' })).toBeInTheDocument()
    expect(worker).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    fireEvent.click(screen.getByRole('link', { name: 'Ver resultados' }))
    expect(await screen.findByRole('heading', { name: 'Resultados de emparejamiento' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/matching/results')
    expect(screen.queryByRole('button', { name: 'Agrupar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tríos (1)' }))
    expect(screen.getAllByRole('list', { name: /Integrantes del grupo/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Tríos (1)' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Parejas (1)' }))
    expect(screen.getAllByRole('list', { name: /Integrantes del grupo/ })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Todos (2)' }))
    expect(screen.getAllByRole('list', { name: /Integrantes del grupo/ })).toHaveLength(2)
    view.unmount()
    renderApp('/matching/results')
    await screen.findByRole('heading', { name: 'Resultados de emparejamiento' })
    expect(screen.getAllByRole('list', { name: /Integrantes del grupo/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('link', { name: 'Volver a estudiantes' }))
    expect(await screen.findByRole('button', { name: 'Agrupar' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'Propuesta de grupos' })).not.toBeInTheDocument()
    expect(worker).toHaveBeenCalledTimes(1)
  })

  it('abre resultados sin propuesta con un estado vacío, sin ejecutar el motor', async () => {
    const worker = vi.fn()
    vi.stubGlobal('Worker', worker)
    renderApp('/matching/results')
    expect(await screen.findByText('Aún no hay agrupamiento')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Preparar estudiantes' })).toBeInTheDocument()
    expect(worker).not.toHaveBeenCalled()
  })

  it.each(['/matching', '/matching/results'])('requiere sesión en %s y conserva el destino', async (path) => {
    session.isAuthenticated = false
    session.role = null
    renderApp(path)
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`/login|${path}`))
  })

  it.each(['/matching', '/matching/results'])('mantiene el acceso docente en %s', async (path) => {
    session.role = 'student'
    session.isTeacher = false
    renderApp(path)
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/student|'))
    expect(screen.queryByRole('heading', { name: 'Emparejamiento' })).not.toBeInTheDocument()
  })
})

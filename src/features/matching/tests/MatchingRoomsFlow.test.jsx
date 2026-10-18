import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import MatchingPage from '../pages/MatchingPage'
import MatchingResultsPage from '../pages/MatchingResultsPage'
import SessionsPage from '@/features/sessions/pages/SessionsPage'
import SessionDetailPage from '@/features/sessions/pages/SessionDetailPage'
import { MatchingWorker } from './helpers/MatchingWorker'
import { classroomFixture } from './helpers/classroomFixture'

const { bootstrap, fetchProfile, publish, rooms } = vi.hoisted(() => ({
  bootstrap: vi.fn(), fetchProfile: vi.fn(), publish: vi.fn(), rooms: [],
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'teacher' }, isTeacher: true }) }))
vi.mock('@/features/assessments/services/assessmentService', () => ({ loadBootstrap: bootstrap }))
vi.mock('../services/assessmentProfileService', () => ({ fetchMatchingProfile: fetchProfile }))
vi.mock('@/features/sessions/services/groupSessionService', () => ({ createRoomsFromMatching: publish, saveMeetingUrl: vi.fn() }))
vi.mock('@/features/sessions/hooks/useSessions', () => ({ useSessions: () => ({ sessions: rooms, loading: false, error: null }) }))
vi.mock('@/features/sessions/hooks/useLiveSession', () => ({ useLiveSession: () => ({ session: rooms[0], loading: false, error: null, view: null, interventions: [] }) }))
vi.mock('@/features/sessions/hooks/useSessionSummary', () => ({ useSessionSummary: () => ({ summary: null }) }))

beforeEach(() => {
  sessionStorage.clear(); rooms.length = 0; publish.mockReset()
  const { catalog, profile } = classroomFixture()
  bootstrap.mockResolvedValue(catalog); fetchProfile.mockResolvedValue(profile)
  vi.stubGlobal('Worker', MatchingWorker)
  publish.mockImplementation(async (result) => {
    rooms.push({ id: 'real-private-room', courseId: result.courseId, assessmentId: result.assessmentId,
      studentIds: result.groups[0].studentIds, members: result.groups[0].members,
      title: 'Pareja: Valeria · Mateo', status: 'scheduled', createdBy: 'teacher' })
    return { sessionIds: ['real-private-room'] }
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function flow() {
  render(<MemoryRouter initialEntries={['/matching?courseId=course-5a&assessmentId=assessment-final']}>
    <ToastProvider><Routes>
      <Route path="/matching" element={<MatchingPage />} />
      <Route path="/matching/results" element={<MatchingResultsPage />} />
      <Route path="/sessions" element={<SessionsPage />} />
      <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
    </Routes></ToastProvider>
  </MemoryRouter>)
}
describe('evaluación → grupos → salas → sesión privada', () => {
  it('conserva los dos integrantes al pasar del agrupamiento a su sala y detalle', async () => {
    flow()
    await screen.findByText('2 estudiantes recibidos')
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    fireEvent.click(screen.getByRole('link', { name: 'Ver resultados' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Crear salas para estos grupos' }))
    await screen.findByText('1 sala disponible para los integrantes asignados.')
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[0][0].groups[0].studentIds.sort()).toEqual(['enrolled-1', 'enrolled-2'])
    fireEvent.click(screen.getByRole('link', { name: 'Ver salas' }))
    expect(await screen.findByRole('heading', { name: 'Salas de reuniones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('link', { name: 'Ver detalle' }))
    expect(await screen.findByRole('heading', { name: 'Integrantes de la sala' })).toBeInTheDocument()
    expect(screen.getByText('Valeria')).toBeInTheDocument()
    expect(screen.getByText('Mateo')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Enlace de Google Meet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir tutor IA' })).toHaveAttribute('href', '/sessions/real-private-room/tutor')
  })
  it('si falla la confirmación conserva los grupos y permite reintentar sin inventar salas', async () => {
    publish.mockRejectedValueOnce(new Error('Sin conexión'))
    flow()
    await screen.findByText('2 estudiantes recibidos')
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    fireEvent.click(screen.getByRole('link', { name: 'Ver resultados' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Crear salas para estos grupos' }))
    await screen.findByText('Sin conexión')
    expect(rooms).toHaveLength(0)
    expect(screen.getByText('Valeria')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Crear salas para estos grupos' }))
    await screen.findByRole('link', { name: 'Ver salas' })
    expect(rooms).toHaveLength(1)
  })
})

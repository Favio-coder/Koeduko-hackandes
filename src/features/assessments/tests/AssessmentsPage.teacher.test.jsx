/**
 * Pruebas del listado de curso para docentes.
 *
 * Fijan el contrato de navegación del módulo: pulsar «Curso» en el menú cuando
 * ya se está en el editor debe devolver al listado del módulo, respetando la
 * confirmación de cambios sin guardar.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AssessmentsPage from '@/features/assessments/pages/AssessmentsPage'
import { confirmDestructive } from '@/shared/lib/alerts'
import { assessmentRequest, loadBootstrap } from '@/features/assessments/services/assessmentService'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isTeacher: true, user: { uid: 'teacher-1' } }),
}))
vi.mock('@/shared/lib/alerts', () => ({
  confirmDestructive: vi.fn(),
  showConfirmation: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
}))
vi.mock('@/features/assessments/services/assessmentService', () => ({
  assessmentRequest: vi.fn(),
  loadBootstrap: vi.fn(),
}))

const course = {
  id: 'course-1',
  name: 'Matemática',
  competencyId: 'quantity',
  areas: [{ id: 'math', label: 'Matemática' }],
  competencies: [{ id: 'quantity', label: 'Resuelve problemas' }],
  skills: [{ id: 'addition', label: 'Adición' }],
  students: [{ id: 'student-1', name: 'Ana' }],
}
const draft = {
  id: 'draft-1',
  title: 'Borrador de prueba',
  courseId: 'course-1',
  areaId: 'math',
  competencyId: 'quantity',
  type: 'exam',
  scale: 20,
  maxScore: 20,
  durationMinutes: 30,
  attemptLimit: 1,
  feedbackMode: 'after_close',
  startsAt: new Date(Date.now() + 60_000).toISOString(),
  endsAt: new Date(Date.now() + 3_600_000).toISOString(),
  studentIds: ['student-1'],
  questions: [],
}

function CourseMenuEntry() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/assessments', { state: { koedukoNav: '/assessments' } })}>
      Ir al menú de curso
    </button>
  )
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/assessments']}>
      <CourseMenuEntry />
      <AssessmentsPage />
    </MemoryRouter>,
  )

const openEditor = async () => {
  await screen.findByRole('heading', { name: 'Evaluaciones', level: 1 })
  fireEvent.click(screen.getByRole('button', { name: 'Crear evaluación' }))
  await screen.findByRole('heading', { name: /Borrador de prueba|Nueva evaluación|Configurar evaluación/ })
}

describe('AssessmentsPage docente', () => {
  beforeEach(() => {
    vi.mocked(loadBootstrap).mockReset()
    vi.mocked(loadBootstrap).mockResolvedValue({ courses: [course], assessments: [draft] })
    vi.mocked(assessmentRequest).mockReset()
    vi.mocked(assessmentRequest).mockImplementation(async (action) => {
      if (action === 'detail') return draft
      throw new Error(`Unexpected action: ${action}`)
    })
    vi.mocked(confirmDestructive).mockReset()
    vi.mocked(confirmDestructive).mockResolvedValue(true)
  })

  it('muestra el koala mientras carga el listado', async () => {
    let release
    vi.mocked(loadBootstrap).mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve({ courses: [course], assessments: [draft] }) }),
    )
    renderPage()
    expect(await screen.findByText('Cargando evaluaciones…')).toBeInTheDocument()
    release()
    await waitFor(() => expect(screen.queryByText('Cargando evaluaciones…')).not.toBeInTheDocument())
  })

  it('vuelve al listado del curso al pulsar «Curso» en el menú', async () => {
    renderPage()
    await openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Ir al menú de curso' }))

    expect(await screen.findByRole('heading', { name: 'Evaluaciones', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear evaluación' })).toBeInTheDocument()
    expect(confirmDestructive).not.toHaveBeenCalled()
  })

  it('no sale del editor con cambios sin guardar si el docente cancela la confirmación', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(false)
    renderPage()
    await openEditor()
    fireEvent.change(screen.getByLabelText(/Nombre de la evaluación/), { target: { value: 'Cambio sin guardar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ir al menú de curso' }))

    await waitFor(() => expect(confirmDestructive).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hay cambios sin guardar' }),
    ))
    expect(screen.getByRole('button', { name: 'Ir al menú de curso' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear evaluación' })).not.toBeInTheDocument()
  })
})
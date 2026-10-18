import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MatchingWorker } from './helpers/MatchingWorker'
import { classroomFixture } from './helpers/classroomFixture'
import MatchingPage from '../pages/MatchingPage'
import MatchingResultsPage from '../pages/MatchingResultsPage'

const { fetchProfile, bootstrap, session } = vi.hoisted(() => ({
  fetchProfile: vi.fn(), bootstrap: vi.fn(), session: { user: { uid: 'teacher-1' } },
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => session }))
vi.mock('@/features/assessments/services/assessmentService', () => ({ loadBootstrap: bootstrap }))
vi.mock('../services/assessmentProfileService', () => ({ fetchMatchingProfile: fetchProfile }))

let workers
function renderMatching(path = '/matching?courseId=course-5a&assessmentId=assessment-final') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/matching" element={<MatchingPage />} />
    <Route path="/matching/results" element={<MatchingResultsPage />} />
  </Routes></MemoryRouter>)
}

describe('estudiantes reales → evaluación → agrupamiento → resultados', () => {
  beforeEach(() => {
    sessionStorage.clear()
    session.user = { uid: 'teacher-1' }
    workers = []
    bootstrap.mockReset()
    fetchProfile.mockReset()
    const { profile, catalog } = classroomFixture()
    bootstrap.mockResolvedValue(catalog)
    fetchProfile.mockResolvedValue(profile)
    vi.stubGlobal('Worker', function () {
      const worker = new MatchingWorker()
      workers.push(worker)
      return worker
    })
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('abre /matching sin parámetros, exige elegir evaluación y espera Agrupar', async () => {
    renderMatching('/matching')
    await screen.findByLabelText('Evaluación finalizada')
    expect(fetchProfile).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Agrupar' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Evaluación finalizada'), { target: { value: 'assessment-final' } })
    expect(await screen.findByText('2 estudiantes recibidos')).toBeInTheDocument()
    expect(bootstrap).toHaveBeenCalledWith({ refresh: true })
    expect(fetchProfile).toHaveBeenCalledWith('assessment-final', 'course-5a')
    expect(screen.getByText('Valeria')).toBeInTheDocument()
    expect(screen.getByText('Mateo')).toBeInTheDocument()
    expect(screen.queryByText('Ana Torres')).not.toBeInTheDocument()
    expect(screen.queryByText('Datos de demostración')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver estudiantes del curso' })).toHaveAttribute('href', '/students')
    expect(workers).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    fireEvent.click(screen.getByRole('link', { name: 'Ver resultados' }))
    expect(await screen.findByRole('heading', { name: 'Resultados de emparejamiento' })).toBeInTheDocument()
    expect(screen.getByText('Valeria')).toBeInTheDocument()
    expect(screen.queryByText('Datos de prueba compartidos')).not.toBeInTheDocument()
    expect(workers).toHaveLength(1)
  })

  it('solo pide la evaluación elegida aunque existan otras publicadas o finalizadas', async () => {
    const { catalog } = classroomFixture(6)
    catalog.assessments.push(
      { ...catalog.assessments[0], id: 'other-finalized', title: 'Otro diagnóstico' },
      { ...catalog.assessments[0], id: 'other-open', status: 'published', title: 'Otra prueba abierta' },
    )
    const { profile } = classroomFixture(6)
    bootstrap.mockResolvedValue(catalog)
    fetchProfile.mockResolvedValue(profile)
    renderMatching('/matching')
    await screen.findByLabelText('Evaluación finalizada')
    expect(fetchProfile).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Evaluación finalizada'), { target: { value: 'assessment-final' } })
    await screen.findByText('6 estudiantes recibidos')
    expect(fetchProfile).toHaveBeenCalledTimes(1)
    expect(fetchProfile).toHaveBeenCalledWith('assessment-final', 'course-5a')
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    expect(screen.getAllByRole('list', { name: /Integrantes del grupo/ })).toHaveLength(3)
  })

  it('carga la selección por URL y rechaza errores sin activar demo', async () => {
    fetchProfile.mockRejectedValue(new Error('Hay correcciones pendientes.'))
    renderMatching('/matching?courseId=course-5a&assessmentId=assessment-final')
    expect(await screen.findByText('Hay correcciones pendientes.')).toBeInTheDocument()
    expect(screen.queryByText('Datos de demostración')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agrupar' })).not.toBeInTheDocument()
    expect(workers).toHaveLength(0)
  })

  it('no permite agrupar una evaluación no finalizada ni fabrica perfiles', async () => {
    const { catalog } = classroomFixture()
    catalog.assessments[0].status = 'published'
    bootstrap.mockResolvedValue(catalog)
    renderMatching()
    expect(await screen.findByText('No hay una evaluación finalizada seleccionada')).toBeInTheDocument()
    expect(fetchProfile).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Agrupar' })).not.toBeInTheDocument()
  })

  it.each([[0, 'No hay estudiantes'], [1, 'Falta un compañero']])('recibe %i estudiantes evaluados sin rellenar datos', async (count, title) => {
    const { catalog, profile } = classroomFixture(count)
    bootstrap.mockResolvedValue(catalog)
    fetchProfile.mockResolvedValue(profile)
    renderMatching()
    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agrupar' })).toBeDisabled()
  })

  it('no consulta perfiles ni muestra simulaciones cuando el docente no tiene cursos', async () => {
    bootstrap.mockResolvedValue({ courses: [], assessments: [] })
    renderMatching()
    expect(await screen.findByText('No hay cursos asignados')).toBeInTheDocument()
    expect(fetchProfile).not.toHaveBeenCalled()
    expect(workers).toHaveLength(0)
  })

  it('no incluye a estudiantes del curso que no tienen resultados en esa evaluación', async () => {
    const { catalog, profile } = classroomFixture()
    catalog.courses[0].students.push({ id: 'not-assessed', name: 'Sin evaluación' })
    bootstrap.mockResolvedValue(catalog)
    fetchProfile.mockResolvedValue(profile)
    renderMatching()
    await screen.findByText('2 estudiantes recibidos')
    expect(screen.getByText('3 estudiantes en el curso · 2 con resultados en esta evaluación.')).toBeInTheDocument()
    expect(screen.queryByText('Sin evaluación')).not.toBeInTheDocument()
  })

  it.each(['wrong-course', 'outsider'])('rechaza un paquete ajeno al curso/roster: %s', async (kind) => {
    const { profile } = classroomFixture()
    if (kind === 'wrong-course') profile.courseId = 'other'
    else profile.students[0].studentId = 'outsider'
    fetchProfile.mockResolvedValue(profile)
    renderMatching()
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Agrupar' })).not.toBeInTheDocument()
    expect(workers).toHaveLength(0)
  })

  it('cambiar de evaluación retira la propuesta e ignora respuestas de la carga anterior', async () => {
    const { catalog, profile } = classroomFixture()
    catalog.assessments.push({ ...catalog.assessments[0], id: 'assessment-second', title: 'Segundo diagnóstico' })
    bootstrap.mockResolvedValue(catalog)
    let resolveFirst
    fetchProfile.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    fetchProfile.mockResolvedValue({ ...profile, assessmentId: 'assessment-second' })
    renderMatching()
    await waitFor(() => expect(fetchProfile).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Evaluación finalizada'), { target: { value: 'assessment-second' } })
    await screen.findByText('2 estudiantes recibidos')
    await act(async () => resolveFirst(profile))
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    fireEvent.click(screen.getByRole('link', { name: 'Ver resultados' }))
    expect(screen.getByText(/assessment-second/)).toBeInTheDocument()
    expect(workers).toHaveLength(1)
  })

  it('actualizar datos retira los grupos y recarga el roster y resultados', async () => {
    renderMatching()
    await screen.findByText('2 estudiantes recibidos')
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar datos' }))
    await waitFor(() => expect(fetchProfile).toHaveBeenCalledTimes(2))
    await screen.findByText('2 estudiantes recibidos')
    expect(screen.queryByRole('heading', { name: 'Propuesta de grupos' })).not.toBeInTheDocument()
    expect(workers).toHaveLength(1)
  })

  it('no recupera resultados de otro docente ni de otra evaluación', async () => {
    let view = renderMatching()
    await screen.findByText('2 estudiantes recibidos')
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    view.unmount()
    view = renderMatching('/matching/results?courseId=course-5a&assessmentId=other')
    expect(await screen.findByText('Aún no hay agrupamiento')).toBeInTheDocument()
    view.unmount()
    session.user = { uid: 'teacher-2' }
    renderMatching('/matching/results')
    expect(await screen.findByText('Aún no hay agrupamiento')).toBeInTheDocument()
  })

  it('no sustituye un error del roster por alumnos demo y ofrece reintentar', async () => {
    bootstrap.mockRejectedValueOnce(new Error('Sin conexión'))
    renderMatching()
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button'))
    await screen.findByText('2 estudiantes recibidos')
    expect(screen.queryByText('Ana Torres')).not.toBeInTheDocument()
  })
})

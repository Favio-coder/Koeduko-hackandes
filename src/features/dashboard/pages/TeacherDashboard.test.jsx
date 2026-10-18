import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TeacherDashboard from '@/features/dashboard/pages/TeacherDashboard'

const { bootstrap, session } = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  session: { user: { uid: 'teacher-1' }, profile: { displayName: 'Lucía Méndez' } },
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => session }))
vi.mock('@/features/assessments/services/assessmentService', () => ({ loadBootstrap: bootstrap }))

const fixture = () => {
  const students = Array.from({ length: 6 }, (_, index) => ({ id: 'real-' + index, name: 'Alumno ' + (index + 1) }))
  return {
    courses: [
      { id: 'course-1', name: 'Matemática 5A', students },
      { id: 'course-2', name: 'Refuerzo', students: [students[0]] },
    ],
    assessments: [{ id: 'assessment-1' }],
  }
}
const renderDashboard = () => render(<MemoryRouter><TeacherDashboard /></MemoryRouter>)
beforeEach(() => {
  bootstrap.mockReset()
  bootstrap.mockResolvedValue(fixture())
  session.user = { uid: 'teacher-1' }
})
afterEach(cleanup)

describe('TeacherDashboard con estudiantes reales', () => {
  it('saluda al docente y cuenta seis estudiantes únicos aunque uno esté en dos cursos', async () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: '¡Hola, Lucía!' })).toBeInTheDocument()
    expect(await screen.findByText('Alumno 6')).toBeInTheDocument()
    expect(screen.getByLabelText('Estudiantes')).toHaveTextContent('6')
    expect(screen.getByLabelText('Cursos')).toHaveTextContent('2')
    expect(screen.getByLabelText('Evaluaciones')).toHaveTextContent('1')
    const roster = screen.getByRole('list', { name: 'Estudiantes registrados' })
    expect(within(roster).getAllByRole('listitem')).toHaveLength(6)
    expect(within(roster).getAllByText('Alumno 1')).toHaveLength(1)
    expect(bootstrap).toHaveBeenCalledWith({ refresh: true })
    expect(screen.queryByText('Ana Torres')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('conserva los accesos a diagnóstico, emparejamiento, salas y roster real', async () => {
    renderDashboard()
    await screen.findByText('Alumno 6')
    expect(screen.getByRole('link', { name: 'Diagnosticar estudiantes' })).toHaveAttribute('href', '/assessments')
    expect(screen.getByRole('link', { name: 'Formar parejas' })).toHaveAttribute('href', '/matching')
    expect(screen.getByRole('link', { name: 'Gestionar salas' })).toHaveAttribute('href', '/sessions')
    expect(screen.getByRole('link', { name: 'Ver estudiantes' })).toHaveAttribute('href', '/students')
  })

  it('actualiza la cantidad cuando cambia el roster', async () => {
    renderDashboard()
    await screen.findByText('Alumno 6')
    bootstrap.mockResolvedValue({ courses: [], assessments: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estudiantes' }))
    await screen.findByText('No hay estudiantes asignados')
    expect(screen.getByLabelText('Estudiantes')).toHaveTextContent('0')
    expect(screen.queryByText('Alumno 6')).not.toBeInTheDocument()
  })

  it('no muestra una cantidad ficticia ante un fallo y permite reintentar', async () => {
    bootstrap.mockRejectedValueOnce(new Error('Sin conexión'))
    renderDashboard()
    await screen.findByText('Sin conexión')
    expect(screen.getByLabelText('Estudiantes')).toHaveTextContent('—')
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button'))
    await screen.findByText('Alumno 6')
    expect(screen.getByLabelText('Estudiantes')).toHaveTextContent('6')
  })

  it('retira los alumnos anteriores al cambiar de cuenta', async () => {
    const view = renderDashboard()
    await screen.findByText('Alumno 6')
    bootstrap.mockResolvedValue({ courses: [], assessments: [] })
    session.user = { uid: 'teacher-2' }
    view.rerender(<MemoryRouter><TeacherDashboard /></MemoryRouter>)
    expect(screen.queryByText('Alumno 6')).not.toBeInTheDocument()
    await screen.findByText('No hay estudiantes asignados')
    expect(screen.getByLabelText('Estudiantes')).toHaveTextContent('0')
  })

  it('muestra las ilustraciones de los accesos rápidos, decorativas y con carga diferida', async () => {
    const { container } = render(
      <MemoryRouter>
        <TeacherDashboard />
      </MemoryRouter>,
    )

    await screen.findByText('Alumno 6')
    const images = [...container.querySelectorAll('img')].filter((img) =>
      img.getAttribute('src')?.startsWith('/botones/'),
    )

    expect(images).toHaveLength(3)
    images.forEach((img) => {
      // Decorativa: el enlace ya tiene el nombre accesible
      expect(img).toHaveAttribute('alt', '')
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('width')
      expect(img).toHaveAttribute('height')
      expect(img.className).toContain('w-full')
      expect(img.className).toContain('h-full')
      expect(img.className).toContain('scale-[1.04]')
      expect(img.className).toContain('group-hover:scale-[1.07]')
      expect(img.className).toContain('motion-reduce:transform-none')
    })
    expect(container.querySelectorAll('video[src="/carga/carga.mp4"]')).toHaveLength(3)
    fireEvent.load(images[0])
    expect(container.querySelectorAll('video[src="/carga/carga.mp4"]')).toHaveLength(2)

    const actionLinks = [
      screen.getByRole('link', { name: 'Diagnosticar estudiantes' }),
      screen.getByRole('link', { name: 'Formar parejas' }),
      screen.getByRole('link', { name: 'Gestionar salas' }),
    ]
    actionLinks.forEach((link) => {
      expect(link.className).toContain('active:scale-[0.99]')
      expect(link.className).toContain('focus-visible:ring-offset-2')
      expect(link.className).toContain('motion-reduce:transition-none')
    })

    // Una ilustración por acceso rápido, con su ruta real
    expect(screen.getByRole('link', { name: 'Diagnosticar estudiantes' })).toHaveAttribute(
      'href',
      '/assessments',
    )
    const sources = images.map((img) => img.getAttribute('src'))
    expect(sources).toEqual([
      '/botones/diagnosticar-card.png',
      '/botones/emparejar-card.png',
      '/botones/gestionarsalas-card.png',
    ])
  })

  it('superpone los valores en las ilustraciones optimizadas de las métricas', async () => {
    const { container } = renderDashboard()
    await screen.findByText('Alumno 6')

    const images = [...container.querySelectorAll('img')].filter((img) =>
      img.getAttribute('src')?.startsWith('/metricas/'),
    )

    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      '/metricas/MetricasEstudiante.webp',
      '/metricas/MetricasCurso.webp',
      '/metricas/MetricasEvaluaciones.webp',
    ])
    images.forEach((img) => {
      // Decorativa: el dato asociado a la tarjeta ya ofrece el contexto accesible.
      expect(img).toHaveAttribute('alt', '')
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('width', '1200')
      expect(img).toHaveAttribute('height', '1200')
      expect(img).toHaveAttribute('decoding', 'async')
      expect(img.className).toContain('object-contain')
    })

    expect(screen.getByLabelText('Estudiantes')).toHaveTextContent('6')
    expect(screen.getByLabelText('Cursos')).toHaveTextContent('2')
    expect(screen.getByLabelText('Evaluaciones')).toHaveTextContent('1')
    expect(screen.getByRole('group', { name: 'Métricas del docente' })).toHaveClass(
      'sm:grid-cols-2',
      'xl:grid-cols-3',
    )
  })

  it('permite recorrer las métricas en móvil con controles y mantiene la cuadrícula en escritorio', async () => {
    const { container } = renderDashboard()
    await screen.findByText('Alumno 6')

    const track = screen.getByRole('group', { name: 'Métricas del docente' })
    const scrollTo = vi.fn()
    Object.defineProperty(track, 'scrollTo', { configurable: true, value: scrollTo })

    expect(track.className).toContain('overflow-x-auto')
    expect(track.className).toContain('sm:grid')
    expect(track.className).toContain('xl:grid-cols-3')
    expect(screen.getByRole('button', { name: 'Ver métrica anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ver métrica siguiente' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Ver Cursos' }))

    expect(scrollTo).toHaveBeenCalledWith({ left: track.clientWidth, behavior: 'smooth' })
    expect(screen.getByRole('button', { name: 'Ver métrica anterior' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Ver Cursos' })).toHaveAttribute('aria-current', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Ver métrica siguiente' }))
    expect(scrollTo).toHaveBeenLastCalledWith({ left: track.clientWidth * 2, behavior: 'smooth' })
    expect(container.querySelectorAll('[aria-roledescription="diapositiva"]')).toHaveLength(3)
  })

  it('vuelve al icono cuando una ilustracion de metrica no carga', async () => {
    const { container } = renderDashboard()
    await screen.findByText('Alumno 6')

    const [first] = [...container.querySelectorAll('img')].filter((img) =>
      img.getAttribute('src')?.startsWith('/metricas/'),
    )
    const card = first.closest('article')
    expect(card.querySelector('img')).not.toBeNull()

    fireEvent.error(first)
    await waitFor(() => expect(card.querySelector('img')).toBeNull())
    expect(card.querySelector('svg')).not.toBeNull()
    expect(within(card).getByText('Estudiantes')).toBeInTheDocument()
    expect(within(card).getByLabelText('Estudiantes')).toHaveTextContent('6')
  })
})

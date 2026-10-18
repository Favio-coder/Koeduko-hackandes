/**
 * Pruebas de la ruta real `/students`.
 *
 * La vista consume la API autorizada (`bootstrap`) y `knowledgeProfiles`, así que
 * aquí se fija el contrato visual y el manejo de carga, error y vacío sin
 * depender de los datos ficticios de `demoData`.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentsPage from '@/features/dashboard/pages/StudentsPage'

const { bootstrap, collection, getDocs } = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { displayName: 'Lucía Méndez' }, role: 'teacher', isTeacher: true }),
}))
vi.mock('@/features/assessments/services/assessmentService', () => ({
  assessmentRequest: (action, payload) => bootstrap(action, payload),
  loadBootstrap: (options) => bootstrap('bootstrap', options),
}))
// Firebase v13: la lectura usa la API modular (`collection` + `getDocs`), no `db.collection()`.
vi.mock('firebase/firestore', () => ({ collection, getDocs }))
vi.mock('@/services/firebase', () => ({
  db: { type: 'firestore' },
}))

const renderPage = () =>
  render(
    <MemoryRouter>
      <StudentsPage />
    </MemoryRouter>,
  )

const student = { id: 'student-real-1', name: 'Ana Torres' }

beforeEach(() => {
  vi.clearAllMocks()
  collection.mockImplementation((_db, path) => ({ path }))
  getDocs.mockResolvedValue({ docs: [] })
  bootstrap.mockResolvedValue({
    courses: [{ id: 'matematica', name: 'Matemática', students: [student] }],
    assessments: [],
  })
})

describe('StudentsPage', () => {
  it('lista los estudiantes reales del curso con el total correcto', async () => {
    renderPage()
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument()
    expect(screen.getByText('student-real-1')).toBeInTheDocument()
    expect(screen.getByText('Matemática')).toBeInTheDocument()
    expect(screen.getAllByText('1 estudiantes').length).toBeGreaterThan(0)
    expect(bootstrap).toHaveBeenCalledWith('bootstrap', undefined)
    expect(collection).toHaveBeenCalledWith({ type: 'firestore' }, 'knowledgeProfiles')
  })

  it('muestra el diagnóstico publicado cuando existe perfil de conocimientos', async () => {
    getDocs.mockResolvedValue({
      docs: [{ id: 'student-real-1', data: () => ({ studentId: 'student-real-1', skills: { addition: 0.8 } }) }],
    })
    renderPage()
    const [progressbar] = await screen.findAllByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '80')
  })

  it('no inventa destrezas cuando el estudiante no tiene diagnóstico', async () => {
    renderPage()
    expect(await screen.findByText('Sin diagnóstico publicado todavía.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('permite reintentar cuando la API falla', async () => {
    bootstrap.mockRejectedValueOnce(new Error('Sesión inválida o vencida.'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sesión inválida o vencida.')
    bootstrap.mockResolvedValue({ courses: [{ id: 'matematica', name: 'Matemática', students: [student] }] })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument()
  })

  it('muestra estado vacío cuando el docente no tiene estudiantes', async () => {
    bootstrap.mockResolvedValue({ courses: [], assessments: [] })
    renderPage()
    expect(
      await screen.findByText('Todavía no hay estudiantes en tus cursos'),
    ).toBeInTheDocument()
  })

  it('enlaza a las rutas existentes de diagnóstico y salas', async () => {
    renderPage()
    await screen.findByText('Ana Torres')
    expect(screen.getAllByRole('link', { name: 'Diagnóstico' })[0]).toHaveAttribute(
      'href',
      '/assessments',
    )
    expect(screen.getAllByRole('link', { name: /Sus salas/ })[0]).toHaveAttribute('href', '/sessions?courseId=matematica&studentId=student-real-1')
  })

  it('no deja buttons sin tipo (evita submits accidentales)', async () => {
    bootstrap.mockRejectedValueOnce(new Error('Sin conexión'))
    renderPage()
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(retry).toHaveAttribute('type', 'button')
  })
})

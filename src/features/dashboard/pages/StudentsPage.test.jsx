/**
 * Pruebas de la ruta real `/students`.
 *
 * La vista es el punto de extensión del desarrollador de autenticación/dashboard
 * (CRUD de estudiantes). Aquí se fija el contrato visual que no debe romperse:
 * encabezado, listado, rutas de navegación y visibilidad por rol.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import StudentsPage from '@/features/dashboard/pages/StudentsPage'
import { DEMO_STUDENTS } from '@/shared/lib/demoData'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { displayName: 'Lucía Méndez' }, role: 'teacher', isTeacher: true }),
}))

const renderPage = () =>
  render(
    <MemoryRouter>
      <StudentsPage />
    </MemoryRouter>,
  )

describe('StudentsPage', () => {
  it('muestra el encabezado y el total de estudiantes', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Estudiantes', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(`${DEMO_STUDENTS.length} estudiantes`)).toBeInTheDocument()
  })

  it('lista los estudiantes del aula con sus destrezas', () => {
    renderPage()
    DEMO_STUDENTS.forEach((student) => {
      expect(screen.getByText(student.displayName)).toBeInTheDocument()
      expect(screen.getByText(student.id)).toBeInTheDocument()
    })
    // Una barra de progreso por destreza, accesible como progressbar.
    expect(
      screen.getAllByRole('progressbar').length,
    ).toBeGreaterThanOrEqual(DEMO_STUDENTS.length)
  })

  it('avisa que la pantalla está en construcción', () => {
    renderPage()
    expect(screen.getByText('Pantalla en construcción')).toBeInTheDocument()
  })

  it('enlaza a las rutas existentes de diagnóstico y salas', () => {
    renderPage()
    expect(screen.getAllByRole('link', { name: 'Diagnóstico' })[0]).toHaveAttribute(
      'href',
      '/assessments',
    )
    expect(screen.getAllByRole('link', { name: /Sus salas/ })[0]).toHaveAttribute('href', '/sessions')
  })

  it('no deja buttons sin tipo (evita submits accidentales)', () => {
    const { container } = renderPage()
    const buttons = container.querySelectorAll('button')
    buttons.forEach((btn) => {
      expect(btn.getAttribute('type')).toBe('button')
    })
  })
})
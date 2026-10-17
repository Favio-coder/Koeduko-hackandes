import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TeacherDashboard from '@/features/dashboard/pages/TeacherDashboard'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { displayName: 'Lucía Méndez' } }),
}))

describe('TeacherDashboard', () => {
  it('saluda con el nombre del perfil y marca claramente los datos de demostración', () => {
    render(
      <MemoryRouter>
        <TeacherDashboard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '¡Hola, Lucía! 👋' })).toBeInTheDocument()
    expect(screen.getByText('Gestiona tus estudiantes y acompaña su aprendizaje.')).toBeInTheDocument()
    expect(screen.getByText('Datos de demostración')).toBeInTheDocument()
  })

  it('conserva las acciones del dashboard y muestra progreso para los estudiantes de demostración', () => {
    render(
      <MemoryRouter>
        <TeacherDashboard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Diagnosticar estudiantes' })).toHaveAttribute(
      'href',
      '/assessments',
    )
    expect(screen.getByRole('link', { name: 'Formar parejas' })).toHaveAttribute('href', '/matching')
    expect(screen.getByRole('link', { name: 'Gestionar salas' })).toHaveAttribute('href', '/sessions')
    expect(screen.getByRole('link', { name: 'Ver diagnóstico' })).toHaveAttribute(
      'href',
      '/assessments',
    )
    expect(screen.getAllByRole('progressbar')).toHaveLength(5)
    expect(screen.getByText('Ana Torres')).toBeInTheDocument()
    expect(screen.getByText('student-001')).toBeInTheDocument()
  })
})

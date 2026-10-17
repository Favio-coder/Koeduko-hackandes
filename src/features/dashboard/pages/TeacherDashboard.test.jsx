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

  it('muestra las ilustraciones de los accesos rápidos, decorativas y con carga diferida', () => {
    const { container } = render(
      <MemoryRouter>
        <TeacherDashboard />
      </MemoryRouter>,
    )

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
})

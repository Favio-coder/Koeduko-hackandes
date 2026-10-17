/**
 * Prueba de humo de la vista previa del sistema de diseño.
 *
 * Se monta la página completa dentro de un router de memoria y con
 * `AuthContext` simulado: verifica que la galería renderiza sin tocar Firebase
 * ni el matching.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'ana@koeduko.dev' },
    profile: { displayName: 'Ana Torres' },
    role: 'teacher',
    isTeacher: true,
    logout: vi.fn(),
  }),
}))

const { default: DesignSystemPage } = await import('@/pages/design-system/DesignSystemPage')

describe('DesignSystemPage', () => {
  it('renderiza la galería completa con datos simulados', () => {
    render(
      <MemoryRouter>
        <DesignSystemPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'KoEduko UI', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('#62DD6B')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Botones' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Modales' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir modal' })).toBeInTheDocument()
  })
})
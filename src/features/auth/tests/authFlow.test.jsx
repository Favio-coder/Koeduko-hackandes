/**
 * Accesos de demostración del login y matrícula automática del registro.
 *
 * Sin Firebase: `useAuth` y el servicio de matrícula van simulados.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from '@/features/auth/pages/Login'
import Register from '@/features/auth/pages/Register'
import { DEMO_TEACHER } from '@/features/auth/demoAccount'
import { joinDefaultCourse } from '@/features/assessments/services/courseEnrollmentService'

const login = vi.fn()
const register = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login,
    register,
    isAuthenticated: false,
    error: null,
  }),
}))

vi.mock('@/features/assessments/services/courseEnrollmentService', () => ({
  joinDefaultCourse: vi.fn(),
}))

const renderApp = (path = '/login') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<p>Panel del estudiante</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('accesos de demostración', () => {
  beforeEach(() => {
    login.mockReset()
    register.mockReset()
    vi.mocked(joinDefaultCourse).mockReset()
    vi.mocked(joinDefaultCourse).mockResolvedValue(null)
  })

  it('el login ofrece los dos caminos de la demo', () => {
    renderApp()
    expect(
      screen.getByRole('region', { name: 'Accesos de demostración' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Ingresa como estudiante/ }),
    ).toHaveAttribute('href', '/register')
  })

  it('«Ingresa como docente» entra con la cuenta de la demo', async () => {
    login.mockResolvedValue({})
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Ingresa como docente/ }))

    expect(login).toHaveBeenCalledWith(DEMO_TEACHER)
    expect(screen.getByLabelText(/Correo electrónico/)).toHaveValue(DEMO_TEACHER.email)
  })

  it('crear cuenta matricula al estudiante en el curso de matemática', async () => {
    register.mockResolvedValue({})
    vi.mocked(joinDefaultCourse).mockResolvedValue({
      courses: [{ id: 'matematica-5a', name: 'Matemática 5A' }],
      joined: [{ id: 'matematica-5a', name: 'Matemática 5A' }],
    })
    renderApp('/register')

    fireEvent.change(screen.getByLabelText(/Nombre completo/), {
      target: { value: 'Ana Torres' },
    })
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
      target: { value: 'ana@coeduko.dev' },
    })
    fireEvent.change(screen.getByLabelText(/^Contraseña/), {
      target: { value: 'Clave123' },
    })
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/), {
      target: { value: 'Clave123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }))

    expect(await screen.findByText('Panel del estudiante')).toBeInTheDocument()
    expect(joinDefaultCourse).toHaveBeenCalledTimes(1)
  })

  it('la cuenta se crea aunque la matrícula no responda', async () => {
    register.mockResolvedValue({})
    vi.mocked(joinDefaultCourse).mockResolvedValue(null)
    renderApp('/register')

    fireEvent.change(screen.getByLabelText(/Nombre completo/), {
      target: { value: 'Ana Torres' },
    })
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
      target: { value: 'ana@coeduko.dev' },
    })
    fireEvent.change(screen.getByLabelText(/^Contraseña/), {
      target: { value: 'Clave123' },
    })
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/), {
      target: { value: 'Clave123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }))

    expect(await screen.findByText('Panel del estudiante')).toBeInTheDocument()
  })
})

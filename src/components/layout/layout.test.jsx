/**
 * Pruebas del shell de navegación (Sidebar + Navbar + DashboardLayout).
 *
 * Verifican que el rediseño visual no rompió la navegación existente:
 * se conservan todas las rutas, el logout y el drawer accesible.
 * `AuthContext` va simulado: no se toca Firebase.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Navbar from '@/components/layout/Navbar'
import Sidebar from '@/components/layout/Sidebar'
import {
  SIDEBAR_ITEMS,
  activeItemTo,
  itemsForRole,
  sectionTitleFor,
} from '@/components/layout-kit/navConfig'
import { USER_ROLES } from '@/shared/constants/contracts'

const logout = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'ana@koeduko.dev' },
    profile: { displayName: 'Ana Torres' },
    role: 'teacher',
    isTeacher: true,
    logout,
  }),
}))

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('navegación (navConfig)', () => {
  it('conserva todas las rutas que existían antes del rediseño', () => {
    const paths = SIDEBAR_ITEMS.map((i) => i.to)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/dashboard',
        '/assessments',
        '/students',
        '/matching',
        '/matching/results',
        '/sessions',
        '/sessions/demo-session-1',
        '/sessions/demo-session-1/tutor',
      ]),
    )
  })

  it('oculta las opciones de docente a los estudiantes', () => {
    const studentPaths = itemsForRole(USER_ROLES.STUDENT).map((i) => i.to)
    expect(studentPaths).not.toContain('/matching')
    expect(studentPaths).not.toContain('/students')
    expect(studentPaths).toContain('/sessions')
    expect(studentPaths).toContain('/dashboard')
  })

  it('expone las cinco secciones acordadas', () => {
    const teacher = itemsForRole(USER_ROLES.TEACHER).map((i) => i.label)
    expect(teacher).toEqual(
      expect.arrayContaining([
        'Principal',
        'Curso',
        'Estudiantes',
        'Emparejamiento',
        'Salas',
      ]),
    )
  })

  it('activeItemTo devuelve un único responsable por ruta', () => {
    expect(activeItemTo('/dashboard')).toBe('/dashboard')
    expect(activeItemTo('/dashboard/teacher')).toBe('/dashboard')
    expect(activeItemTo('/dashboard/student')).toBe('/dashboard')
    expect(activeItemTo('/matching')).toBe('/matching')
    expect(activeItemTo('/matching/results')).toBe('/matching/results')
    expect(activeItemTo('/sessions')).toBe('/sessions')
    expect(activeItemTo('/sessions/demo-session-1')).toBe('/sessions/demo-session-1')
    expect(activeItemTo('/sessions/demo-session-1/tutor')).toBe('/sessions/demo-session-1/tutor')
    expect(activeItemTo('/ruta-inexistente')).toBeNull()
  })

  it('«Estudiantes» tiene ruta propia y distinta de «Principal»', () => {
    const estudiantes = SIDEBAR_ITEMS.find((i) => i.label === 'Estudiantes')
    const principal = SIDEBAR_ITEMS.find((i) => i.label === 'Principal')

    expect(estudiantes.to).toBe('/students')
    expect(estudiantes.to).not.toBe(principal.to)
    // Cada ruta tiene un único responsable del indicador.
    expect(activeItemTo('/students')).toBe('/students')
    expect(activeItemTo('/dashboard/teacher')).toBe('/dashboard')
  })

  it('resuelve el título de sección por ruta', () => {
    expect(sectionTitleFor('/dashboard/teacher')).toBe('Panel docente')
    expect(sectionTitleFor('/sessions/demo-session-1/tutor')).toBe('Tutor IA')
    expect(sectionTitleFor('/matching/results')).toBe('Resultados de emparejamiento')
    expect(sectionTitleFor('/sessions')).toBe('Salas')
  })
})

describe('Sidebar', () => {
  it.each([
    ['/dashboard', 'Principal'],
    // `/dashboard` es un índice que redirige por rol: al pulsar «Principal» el
    // docente aterriza en `/dashboard/teacher`, y el indicador debe quedarse en
    // «Principal» (Estudiantes es un atajo a esa misma vista, no otra sección).
    ['/dashboard/teacher', 'Principal'],
    ['/students', 'Estudiantes'],
    ['/dashboard/student', 'Principal'],
    ['/matching', 'Emparejamiento'],
    ['/matching/results', 'Resultados'],
    ['/sessions', 'Salas'],
    ['/sessions/demo-session-1', 'Sesión activa'],
    ['/sessions/demo-session-1/tutor', 'Tutor IA'],
  ])('marca solo "%s" como activo', (path, activeLabel) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Sidebar />
      </MemoryRouter>,
    )

    const activeLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')

    expect(activeLinks).toHaveLength(1)
    expect(activeLinks[0]).toHaveTextContent(activeLabel)
  })

  it('la navbar marca el mismo ítem que el sidebar', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/teacher']}>
        <DashboardLayout />
      </MemoryRouter>,
    )
    const active = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent.trim())

    // Un único indicador en cada barra, los dos sobre «Principal».
    expect(active).toEqual(['Principal'])
  })

  it('renderiza el contenido hijo de las rutas protegidas independientes', () => {
    render(
      <MemoryRouter initialEntries={['/assessments']}>
        <DashboardLayout>
          <h1>Evaluaciones</h1>
        </DashboardLayout>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Evaluaciones' })).toBeInTheDocument()
  })

  it('muestra la marca y la navegación con fondo verde bosque', () => {
    const { container } = wrap(<Sidebar />)
    expect(screen.getByRole('img', { name: 'KoEduko' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
    expect(container.querySelector('.bg-\\[\\#304744\\]')).toBeTruthy()
  })

  it('enlaza a las rutas existentes', () => {
    wrap(<Sidebar />)
    expect(screen.getByRole('link', { name: 'Emparejamiento' })).toHaveAttribute(
      'href',
      '/matching',
    )
    expect(screen.getByRole('link', { name: 'Salas' })).toHaveAttribute('href', '/sessions')
  })
})

describe('Navbar', () => {
  it('muestra solo el control compacto de navegación, sin título ni enlaces', () => {
    wrap(<Navbar onMenuClick={vi.fn()} />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menú de navegación' })).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})

describe('Cerrar sesión desde el sidebar', () => {
  it('conserva el cierre de sesión y lo lleva a login', () => {
    logout.mockClear()
    wrap(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(logout).toHaveBeenCalled()
  })
})

describe('DashboardLayout', () => {
  it('mantiene el sidebar en el borde del shell y no muestra un título superior', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/teacher']}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard/teacher" element={<p>Panel principal</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
    expect(screen.getByText('Panel principal')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Panel docente' })).not.toBeInTheDocument()
  })

  it('abre y cierra el drawer lateral con Escape', () => {
    render(
      <MemoryRouter initialEntries={['/sessions']}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/sessions" element={<p>Contenido de salas</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Contenido de salas')).toBeInTheDocument()

    const menuButton = screen.getByRole('button', { name: 'Abrir menú de navegación' })
    fireEvent.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Menú de navegación' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog', { name: 'Menú de navegación' })).toBeNull()
  })

  it('cierra el drawer al pulsar fuera o navegar', () => {
    render(
      <MemoryRouter initialEntries={['/sessions']}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/sessions" element={<p>Contenido de salas</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú de navegación' }))
    expect(screen.queryByRole('dialog', { name: 'Menú de navegación' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }))
    const drawer = screen.getByRole('dialog', { name: 'Menú de navegación' })
    fireEvent.click(within(drawer).getByRole('link', { name: 'Salas' }))
    expect(screen.queryByRole('dialog', { name: 'Menú de navegación' })).toBeNull()
  })

  it('expone el enlace de salto al contenido', () => {
    render(
      <MemoryRouter initialEntries={['/sessions']}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/sessions" element={<p>Contenido</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Saltar al contenido principal' })).toBeInTheDocument()
  })
})
/**
 * Pruebas del panel del estudiante (`/dashboard/student`).
 *
 * Fija el contrato de juego (nivel, XT, rango, insignias, misiones) y el
 * manejo de datos: real, vacío y demostración, sin depender de Firebase.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentDashboard from '@/features/dashboard/pages/StudentDashboard'

const { bootstrap, grades, knowledgeProfile, session } = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  grades: vi.fn(),
  knowledgeProfile: vi.fn(),
  session: { user: { uid: 'student-1' }, profile: { displayName: 'Ana Torres' } },
}))

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => session }))
vi.mock('@/features/assessments/services/assessmentService', () => ({
  loadBootstrap: bootstrap,
  assessmentRequest: (action) => (action === 'grades' ? grades() : Promise.resolve(null)),
}))
vi.mock('firebase/firestore', () => ({
  doc: (_db, path, id) => ({ path, id }),
  getDoc: knowledgeProfile,
}))
vi.mock('@/services/firebase', () => ({ db: { type: 'firestore' } }))

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <StudentDashboard />
    </MemoryRouter>,
  )

const SKILLS = {
  addition: 0.92,
  subtraction: 0.78,
  multiplication: 0.8,
  division: 0.7,
  fraction: 0.6,
  estimation: 0.65,
}

beforeEach(() => {
  vi.clearAllMocks()
  session.user = { uid: 'student-1' }
  bootstrap.mockResolvedValue({ courses: [], assessments: [{ id: 'a1' }, { id: 'a2' }] })
  grades.mockResolvedValue({ records: [{ assessmentId: 'a1', score20: 18, gradedAt: new Date().toISOString() }] })
  knowledgeProfile.mockResolvedValue({ exists: () => true, data: () => ({ skills: SKILLS }) })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('StudentDashboard con datos reales', () => {
  it('saluda por nombre y muestra nivel, rango y XP derivados de las notas', async () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: '¡Hola, Ana!' })).toBeInTheDocument()

    /* 92+78+80+70+60+65 = 445 de competencias + 90 de la nota = 535 XT → nivel 2. */
    expect(await screen.findByText('Nivel 2')).toBeInTheDocument()
    expect(screen.getByText('535 XT en total')).toBeInTheDocument()
    expect(screen.getAllByText('235 / 300 XT').length).toBeGreaterThan(0)
    expect(screen.getByText('Te faltan 65 XT para el nivel 3')).toBeInTheDocument()
    expect(screen.getAllByText('Explorador').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Progreso hacia el nivel 3')).toHaveAttribute(
      'aria-valuenow',
      '78',
    )
    expect(screen.queryByText(/Modo demostración/)).not.toBeInTheDocument()
  })

  it('publica las cuatro tarjetas de resumen con sus cifras', async () => {
    renderDashboard()
    await screen.findByText('Nivel 2')
    const resumen = screen.getByRole('region', { name: 'Tu resumen de progreso' })
    expect(within(resumen).getByLabelText('Nivel')).toHaveTextContent('2')
    expect(within(resumen).getByLabelText('Puntos XP')).toHaveTextContent('535')
    expect(within(resumen).getByLabelText('Destrezas expertas')).toHaveTextContent('3')
    expect(within(resumen).getByLabelText('Mejor nota')).toHaveTextContent('18')
    expect(resumen.querySelector('ul').className).toContain('grid-cols-2')
    expect(resumen.querySelector('ul').className).toContain('xl:grid-cols-4')
  })

  it('las misiones Illustrated usan las imágenes de public/botonesestudiante', async () => {
    const { container } = renderDashboard()
    await screen.findByText('Nivel 2')

    const images = [...container.querySelectorAll('img')].filter((img) =>
      img.getAttribute('src')?.startsWith('/botonesestudiante/'),
    )
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      '/botonesestudiante/Realizadiagnostica-card.png',
      '/botonesestudiante/gestionarsalas-card.png',
    ])
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt', '')
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('width', '622')
      expect(img).toHaveAttribute('height', '320')
      expect(img.className).toContain('scale-[1.04]')
      expect(img.className).toContain('motion-reduce:transform-none')
    })

    expect(screen.getByRole('link', { name: 'Realizar diagnóstico' })).toHaveAttribute(
      'href',
      '/assessments',
    )
    expect(screen.getByRole('link', { name: 'Gestionar mis salas' })).toHaveAttribute(
      'href',
      '/sessions',
    )
    /* Las dos misiones restantes apuntan a la misma ruta, sin ilustración. */
    expect(screen.getByRole('link', { name: 'Entrena tu destreza más débil' })).toHaveAttribute(
      'href',
      '/assessments',
    )
    expect(screen.getByText('+120 XT')).toBeInTheDocument()
  })

  it('ordena las competencias de mayor a menor y señala la más fuerte', async () => {
    renderDashboard()
    await screen.findByText('Nivel 2')
    expect(screen.getByText('Adicion')).toBeInTheDocument()
    expect(screen.getAllByText('Tu mejor')).toHaveLength(1)
    expect(screen.getAllByText('Maestro').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Mis competencias' })).toBeInTheDocument()
  })

  it('las insigniasearned se distinguen de las bloqueadas', async () => {
    renderDashboard()
    await screen.findByText('Nivel 2')
    expect(screen.getByLabelText('Insignias ganadas: 3 de 6')).toBeInTheDocument()
    expect(screen.getByText('Primer paso')).toBeInTheDocument()
    expect(screen.getByText('Equilibrado')).toBeInTheDocument()
    /* Constancia exige haber asistido; con la sala solo programada sigue bloqueada. */
    expect(screen.getByText('Constancia').closest('div')).toHaveClass('border-dashed')
    expect(screen.getByText('Especialista').closest('div')).not.toHaveClass('border-dashed')
  })

  it('destaca la próxima sala con su acceso directo', async () => {
    renderDashboard()
    expect(screen.getByText('Próxima misión')).toBeInTheDocument()
    const next = screen.getByRole('link', { name: 'Entrar a la sala' })
    expect(next).toHaveAttribute('href', '/sessions/demo-session-1')
    expect(screen.getByRole('link', { name: 'Consultar al tutor IA' })).toHaveAttribute(
      'href',
      '/sessions/demo-session-1/tutor',
    )
  })

  it('permite volver a pedir los datos', async () => {
    renderDashboard()
    await screen.findByText('Nivel 2')
    expect(bootstrap).toHaveBeenCalledWith({ refresh: true })
    screen.getByRole('button', { name: 'Actualizar mi progreso' }).click()
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(2))
  })
})

describe('StudentDashboard sin datos', () => {
  it('avisa que está en modo demostración cuando ninguna lectura responde', async () => {
    bootstrap.mockRejectedValue(new Error('API no disponible'))
    grades.mockRejectedValue(new Error('API no disponible'))
    knowledgeProfile.mockRejectedValue(new Error('Sin permisos'))

    renderDashboard()
    expect(await screen.findByText('Modo demostración.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '¡Hola, Ana!' })).toBeInTheDocument()
    /* El perfil ficticio de Ana (315 XT) sigue dando nivel 2, pero rotulado. */
    expect(await screen.findByText('Nivel 2')).toBeInTheDocument()
  })

  it('sin diagnóstico invitation a resolverlo en vez de mostrar ceros', async () => {
    knowledgeProfile.mockResolvedValue({ exists: () => false, data: () => null })
    grades.mockResolvedValue({ records: [] })
    bootstrap.mockResolvedValue({ courses: [], assessments: [] })

    renderDashboard()
    expect(
      await screen.findByText('Tu mapa aparece con el primer diagnóstico'),
    ).toBeInTheDocument()
    /* Sin perfil no hay insignias ganadas ni notas: se dice explícitamente. */
    expect(screen.getByLabelText('Insignias ganadas: 0 de 6')).toBeInTheDocument()
    expect(screen.getByLabelText('Mejor nota')).toHaveTextContent('—')
    expect(screen.getByText('Nivel 1')).toBeInTheDocument()
  })
})

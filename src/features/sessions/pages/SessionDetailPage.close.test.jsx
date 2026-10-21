import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = { isTeacher: true }
const summaryState = { current: { summary: null, ready: true } }
const session = { current: { title: 'Pareja 1', status: 'scheduled' } }

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../hooks/useLiveSession', () => ({
  useLiveSession: () => ({ loading: false, error: null, session: session.current, view: null, interventions: [], retry: vi.fn() }),
}))
vi.mock('../hooks/useSessionSummary', () => ({ useSessionSummary: vi.fn(() => summaryState.current) }))
vi.mock('../services/sessionBotService', () => ({ inviteTutor: vi.fn() }))
vi.mock('../services/closeSessionService', () => ({ closeSession: vi.fn() }))

import { useSessionSummary } from '../hooks/useSessionSummary'
import { closeSession } from '../services/closeSessionService'
import SessionDetailPage from './SessionDetailPage'

const cap = (id, nombre, estado, evidencias = [], extra = {}) => ({ id, nombre, estado, evidencias, señales: [], ...extra })
const REPORT = {
  v: 1,
  competencia: { id: 'resuelve-problemas-cantidad', nombre: 'Resuelve problemas de cantidad' },
  nota: 'Evidencia formativa: la calificación la decide el docente.',
  problema: { activityId: 'p-01', skillId: 'multiplication', text: 'Hay 6 cajas con 8 lápices cada una.' },
  duracionSeg: 120,
  estudiantes: [
    {
      key: 'estudiante a',
      name: 'Estudiante A',
      resumen: { talkPct: 75, talkSec: 30, turns: 4, estimated: false },
      capacidades: [
        cap('traduce', 'Traduce cantidades a expresiones numéricas', 'evidencia parcial', [{ t: 10, cita: 'Entonces seis por ocho' }]),
        cap('comunica', 'Comunica su comprensión sobre los números y las operaciones', 'con evidencia', [{ t: 65, cita: 'primero hay que contar las cajas' }]),
        cap('usa-estrategias', 'Usa estrategias y procedimientos de estimación y cálculo', 'evidencia parcial'),
        cap('argumenta', 'Argumenta afirmaciones sobre las relaciones numéricas y las operaciones', 'sin evidencia suficiente'),
      ],
    },
    {
      key: 'estudiante b',
      name: 'Estudiante B',
      resumen: { talkPct: 25, talkSec: 10, turns: 1, estimated: false },
      capacidades: [
        cap('traduce', 'Traduce cantidades a expresiones numéricas', 'sin evidencia suficiente', [], { nota: 'Mostró dificultad al plantear el problema.' }),
        cap('comunica', 'Comunica su comprensión sobre los números y las operaciones', 'evidencia parcial'),
        cap('usa-estrategias', 'Usa estrategias y procedimientos de estimación y cálculo', 'con evidencia', [{ t: 20, cita: 'son cuarenta y ocho' }]),
        cap('argumenta', 'Argumenta afirmaciones sobre las relaciones numéricas y las operaciones', 'con evidencia', [{ t: 24, cita: 'porque seis veces ocho es cuarenta y ocho' }]),
      ],
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/sessions/accept-mem-1']}>
      <Routes>
        <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const confirmClose = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }))
}

const withSummary = (steps = {}, report = REPORT) => {
  summaryState.current = { summary: { report, steps }, ready: true }
}

beforeEach(() => {
  auth.isTeacher = true
  closeSession.mockReset()
  useSessionSummary.mockClear()
  summaryState.current = { summary: null, ready: true }
  session.current = { title: 'Pareja 1', status: 'scheduled' }
})

describe('SessionDetailPage: closing the session', () => {
  it('offers "Cerrar sesión" to the teacher and does not close until confirmed', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(closeSession).not.toHaveBeenCalled()

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(closeSession).not.toHaveBeenCalled()
  })

  it('closes with the session id and shows the report right away, replacing the invite and close buttons', async () => {
    closeSession.mockResolvedValue({ status: 'completed', alreadyClosed: false, report: REPORT, steps: { leaveCall: 'ok' } })
    renderPage()
    confirmClose()

    expect(await screen.findByRole('region', { name: 'Evidencia por competencias' })).toBeInTheDocument()
    expect(closeSession).toHaveBeenCalledWith({ sessionId: 'accept-mem-1' })
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invitar tutor' })).not.toBeInTheDocument()
  })

  it('shows the server message when closing fails, and keeps the button to try again', async () => {
    closeSession.mockRejectedValue(new Error('Solo el docente puede hacer esto.'))
    renderPage()
    confirmClose()
    expect(await screen.findByText('Solo el docente puede hacer esto.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('never shows the close button to a student, and does not subscribe to the report for them', () => {
    auth.isTeacher = false
    renderPage()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
    expect(useSessionSummary).toHaveBeenCalledWith('accept-mem-1', { enabled: false, uid: null })
  })

  it('shows the saved report when the session was already closed, without the close button', () => {
    withSummary()
    renderPage()
    expect(screen.getByRole('region', { name: 'Evidencia por competencias' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
    expect(useSessionSummary).toHaveBeenCalledWith('accept-mem-1', { enabled: true, uid: null })
  })

  it('hides the close button for a completed session even if the report has not arrived yet', () => {
    session.current = { title: 'Pareja 1', status: 'completed' }
    renderPage()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })
})

describe('the competency report', () => {
  it("says it is formative evidence and that the grade is the teacher's", () => {
    withSummary()
    renderPage()
    expect(screen.getByText('Evidencia formativa: la calificación la decide el docente.')).toBeInTheDocument()
    expect(screen.getByText(/Resuelve problemas de cantidad/)).toBeInTheDocument()
  })

  it('lists the four capabilities for each student with their state', () => {
    withSummary()
    renderPage()
    const a = within(screen.getByRole('list', { name: 'Capacidades de Estudiante A' }))
    expect(a.getByText('Traduce cantidades a expresiones numéricas')).toBeInTheDocument()
    expect(a.getByText('Comunica su comprensión sobre los números y las operaciones')).toBeInTheDocument()
    expect(a.getByText('Usa estrategias y procedimientos de estimación y cálculo')).toBeInTheDocument()
    expect(a.getByText('Argumenta afirmaciones sobre las relaciones numéricas y las operaciones')).toBeInTheDocument()
    expect(a.getAllByText('Evidencia parcial')).toHaveLength(2)
    expect(a.getByText('Con evidencia')).toBeInTheDocument()
    expect(a.getByText('Sin evidencia suficiente')).toBeInTheDocument()

    const b = within(screen.getByRole('list', { name: 'Capacidades de Estudiante B' }))
    expect(b.getAllByText('Con evidencia')).toHaveLength(2)
  })

  it('shows the textual quotes with the minute they were said, and the notes of a capability', () => {
    withSummary()
    renderPage()
    expect(screen.getByText(/«Entonces seis por ocho»/)).toBeInTheDocument()
    expect(screen.getByText('0:10')).toBeInTheDocument()
    expect(screen.getByText('1:05')).toBeInTheDocument()
    expect(screen.getByText(/«porque seis veces ocho es cuarenta y ocho»/)).toBeInTheDocument()
    expect(screen.getByText('Mostró dificultad al plantear el problema.')).toBeInTheDocument()
  })

  it('shows the speech summary of each student', () => {
    withSummary()
    renderPage()
    expect(screen.getByText('Habló 75% del tiempo · 4 turnos')).toBeInTheDocument()
    expect(screen.getByText('Habló 25% del tiempo · 1 turno')).toBeInTheDocument()
  })

  it('the report itself never shows a grade (AD / A / B / C); only the optional selector of the teacher offers them, and it starts empty', () => {
    withSummary()
    const { container } = renderPage()
    const report = container.querySelector('section[aria-label="Evidencia por competencias"]')
    expect(report.textContent).not.toMatch(/\b(AD|Nota:|Calificación:)/)
    expect(report.textContent).not.toMatch(/Logro (destacado|esperado)/i)
    // El registro auxiliar deja elegir un calificativo al docente, pero KoEduko no propone ninguno: todo arranca vacío.
    const selects = [...container.querySelectorAll('details select')]
    expect(selects.length).toBeGreaterThan(0)
    for (const select of selects) expect(select.value).toBe('')
  })

  it('warns the teacher about what did not work when closing (the tutor is still in the meeting)', () => {
    withSummary({ leaveCall: 'failed:404', classifier: 'failed:timeout', memory: { enabled: true, failed: 1, skipped: 0 } })
    renderPage()
    expect(screen.getByText('No se pudo sacar al tutor de la reunión. Sácalo desde Meet.')).toBeInTheDocument()
    expect(screen.getByText('La IA no pudo clasificar algunas frases: este reporte usa solo reglas.')).toBeInTheDocument()
    expect(screen.getByText(/No se pudo guardar la memoria de 1 estudiante/)).toBeInTheDocument()
  })

  it('handles a session where nobody spoke', () => {
    withSummary({}, { ...REPORT, estudiantes: [] })
    renderPage()
    expect(screen.getByText(/No se registró a nadie hablando/)).toBeInTheDocument()
  })
})

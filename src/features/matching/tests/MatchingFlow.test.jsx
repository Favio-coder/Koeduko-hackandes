import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MatchingPage from '../pages/MatchingPage'
import MatchingResultsPage from '../pages/MatchingResultsPage'
import { prepareDemoProfiles } from '../data/prepareDemoProfiles'
import { MatchingWorker } from './helpers/MatchingWorker'
import { MATCHING_RESULT_KEY } from '../services/matchingResultStorage'
import assessmentExample from './fixtures/assessment-results-v1.json'

const renderPage = (props = {}) => render(<MemoryRouter><MatchingPage {...props} /></MemoryRouter>)
const group = () => fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('Worker', MatchingWorker)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('agrupamiento explícito por contrato', () => {
  it('recibe la evaluación sin calcular hasta pulsar Agrupar', async () => {
    const workers = vi.fn(function () { return new MatchingWorker() })
    vi.stubGlobal('Worker', workers)
    renderPage({ assessmentResults: assessmentExample })
    expect(screen.getByText('2 estudiantes recibidos')).toBeInTheDocument()
    expect(workers).not.toHaveBeenCalled()
    expect(screen.queryByRole('list', { name: 'Grupos de estudiantes' })).not.toBeInTheDocument()
    group()
    const groups = await screen.findByRole('list', { name: 'Grupos de estudiantes' })
    expect(within(groups).getByText('student-001')).toBeInTheDocument()
    expect(within(groups).getByText('student-002')).toBeInTheDocument()
    expect(workers).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(MATCHING_RESULT_KEY)).not.toBeNull()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Resultado JSON')).not.toBeInTheDocument()
  })

  it('muestra los cinco estudiantes compartidos y una propuesta de pareja y trío tras el clic', async () => {
    renderPage()
    const roster = screen.getByRole('list', { name: 'Estudiantes recibidos' })
    expect(within(roster).getAllByRole('listitem')).toHaveLength(5)
    expect(within(roster).getByText('Ana Torres')).toHaveProperty('tagName', 'SUMMARY')
    expect(within(roster).getAllByText('Adicion')).toHaveLength(5)
    expect(screen.queryByRole('heading', { name: 'Propuesta de grupos' })).not.toBeInTheDocument()
    group()
    const groups = await screen.findByRole('list', { name: 'Grupos de estudiantes' })
    expect(within(groups).getAllByRole('heading')).toHaveLength(2)
    expect(screen.getAllByRole('list', { name: /Integrantes del grupo/ }).map((list) => within(list).getAllByRole('listitem').length).sort()).toEqual([2, 3])
    expect(within(groups).getAllByText('Ver motivo del agrupamiento')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Ver resultados' })).toBeInTheDocument()
  })

  it.each([[0, 'No hay estudiantes'], [1, 'Falta un compañero']])('usa los %i perfiles recibidos y deshabilita Agrupar', (count, title) => {
    const worker = vi.fn()
    vi.stubGlobal('Worker', worker)
    renderPage({ knowledgeProfiles: prepareDemoProfiles(count) })
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agrupar' })).toBeDisabled()
    expect(worker).not.toHaveBeenCalled()
    expect(screen.queryByRole('list', { name: 'Grupos de estudiantes' })).not.toBeInTheDocument()
  })

  it('genera veinte parejas a partir de cuarenta perfiles recibidos', async () => {
    renderPage({ knowledgeProfiles: prepareDemoProfiles(40) })
    expect(screen.getByText('40 estudiantes recibidos')).toBeInTheDocument()
    group()
    await waitFor(() => expect(screen.getAllByRole('list', { name: /Integrantes del grupo/ })).toHaveLength(20))
  })

  it('informa evidencia faltante sin inventar puntajes al agrupar', async () => {
    const profiles = prepareDemoProfiles(2)
    delete profiles[0].skills.fraction
    renderPage({ knowledgeProfiles: profiles })
    group()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('Falta evidencia')
    expect(screen.queryByRole('list', { name: 'Grupos de estudiantes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agrupar' })).toBeEnabled()
  })

  it('cancela respuestas antiguas, evita doble clic y requiere nueva acción al cambiar la entrada', async () => {
    const workers = []
    vi.stubGlobal('Worker', class {
      constructor() { workers.push(this) }
      postMessage(request) { this.request = request }
      terminate() { this.terminated = true }
    })
    const profiles = prepareDemoProfiles(2).map((profile) => ({ ...profile, computedAt: { toDate() {} } }))
    const view = renderPage({ knowledgeProfiles: profiles })
    expect(workers).toHaveLength(0)
    group()
    expect(workers).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Agrupar' })).toBeDisabled()
    expect(workers[0].request.profiles[0]).not.toHaveProperty('computedAt')
    view.rerender(<MemoryRouter><MatchingPage knowledgeProfiles={[]} /></MemoryRouter>)
    expect(workers[0].terminated).toBe(true)
    act(() => workers[0].onmessage({ data: { result: { groups: 'stale' } } }))
    expect(screen.getByText('No hay estudiantes')).toBeInTheDocument()
    expect(workers).toHaveLength(1)
    expect(sessionStorage.getItem(MATCHING_RESULT_KEY)).toBeNull()
    view.rerender(<MemoryRouter><MatchingPage knowledgeProfiles={profiles} /></MemoryRouter>)
    group()
    act(() => workers[1].onerror())
    await screen.findByRole('alert')
    group()
    expect(workers).toHaveLength(3)
    view.unmount()
    expect(workers[2].terminated).toBe(true)
  })

  it('descarta la propuesta visible al recibir otro conjunto de estudiantes', async () => {
    const view = renderPage({ knowledgeProfiles: prepareDemoProfiles(2) })
    group()
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    view.rerender(<MemoryRouter><MatchingPage knowledgeProfiles={prepareDemoProfiles(3)} /></MemoryRouter>)
    expect(screen.getByText('3 estudiantes recibidos')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Propuesta de grupos' })).not.toBeInTheDocument()
  })

  it('permite revisar Resultados por navegación aunque el almacenamiento no esté disponible', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    render(<MemoryRouter initialEntries={['/matching']}><Routes>
      <Route path="/matching" element={<MatchingPage />} />
      <Route path="/matching/results" element={<MatchingResultsPage />} />
    </Routes></MemoryRouter>)
    group()
    await screen.findByRole('heading', { name: 'Propuesta de grupos' })
    expect(screen.getByRole('status')).toHaveTextContent('no se conservarán')
    fireEvent.click(screen.getByRole('link', { name: 'Ver resultados' }))
    expect(screen.getByRole('heading', { name: 'Resultados de emparejamiento' })).toBeInTheDocument()
    expect(screen.getAllByRole('list', { name: /Integrantes del grupo/ })).toHaveLength(2)
  })
})

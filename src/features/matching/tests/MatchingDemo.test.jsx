import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MatchingDemo from '../MatchingDemo'
import { MatchingWorker } from './helpers/MatchingWorker'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); window.history.replaceState(null, '', '/') })

it('abre la prueba aislada, espera Agrupar y navega a resultados', async () => {
  sessionStorage.clear()
  vi.stubGlobal('Worker', MatchingWorker)
  window.history.replaceState(null, '', '/demo/matching#/matching')
  render(<MatchingDemo />)
  expect(screen.getByRole('heading', { name: 'Emparejamiento' })).toBeInTheDocument()
  expect(screen.getByText('Ana Torres')).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Grupos de estudiantes' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
  await screen.findByRole('list', { name: 'Grupos de estudiantes' })
  fireEvent.click(screen.getByRole('link', { name: 'Ver resultados' }))
  expect(screen.getByRole('heading', { name: 'Resultados de emparejamiento' })).toBeInTheDocument()
  expect(window.location.hash).toBe('#/matching/results')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

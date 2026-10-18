import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchClassInsights } from '../services/classInsightsService'
import ClassInsights from './ClassInsights'

const data = {
  sessions: 3,
  students: 6,
  capacities: [
    { id: 'argumenta', nombre: 'Argumenta afirmaciones sobre las relaciones numéricas y las operaciones', con: 1, parcial: 1, sin: 4, total: 6, sinPct: 67 },
    { id: 'traduce', nombre: 'Traduce cantidades a expresiones numéricas', con: 5, parcial: 1, sin: 0, total: 6, sinPct: 0 },
    { id: 'comunica', nombre: 'Comunica su comprensión', con: 0, parcial: 0, sin: 0, total: 0, sinPct: 0 },
  ],
}

describe('ClassInsights', () => {
  it('lists the capabilities from the hardest, with plain counts, and says it is not a grade', async () => {
    render(<ClassInsights fetchInsights={vi.fn().mockResolvedValue(data)} />)
    expect(await screen.findByText('Lo que más cuesta en tus salas')).toBeInTheDocument()
    expect(screen.getByText('3 salas cerradas · 6 participaciones')).toBeInTheDocument()
    expect(screen.getByText(/1 con evidencia · 1 parcial · 4 sin evidencia/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '67% sin evidencia suficiente' })).toBeInTheDocument()
    expect(screen.queryByText('Comunica su comprensión')).not.toBeInTheDocument() // sin datos, no se muestra
    expect(screen.getByText(/la calificación la decide el docente/)).toBeInTheDocument()
  })

  it('renders nothing with no closed rooms yet, or when the request fails', async () => {
    for (const fetchInsights of [vi.fn().mockResolvedValue({ sessions: 0, students: 0, capacities: [] }), vi.fn().mockRejectedValue(new Error('x'))]) {
      const { container, unmount } = render(<ClassInsights fetchInsights={fetchInsights} />)
      await waitFor(() => expect(fetchInsights).toHaveBeenCalled())
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
  })

  it('asks the server without sending any data', async () => {
    const post = vi.fn().mockResolvedValue({})
    await fetchClassInsights({ post })
    expect(post).toHaveBeenCalledWith('/api/class-insights', {}, { subject: 'el servidor de sesiones' })
  })
})

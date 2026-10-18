import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchMyFeedback } from '../services/myFeedbackService'
import StudentFeedback from './StudentFeedback'

const feedback = {
  title: 'Tu sesión',
  problem: 'Hay 8 bolsas con 11 caramelos cada una.',
  strengths: ['Planteaste la operación con los números del problema.'],
  nextSteps: ['Para la próxima: di qué datos tiene el problema.'],
  note: 'Esto es una ayuda para que sigas aprendiendo, no es una nota.',
}

describe('StudentFeedback', () => {
  it('shows what the student did well, what to try next and the note, without grades', async () => {
    render(<StudentFeedback sessionId="s1" fetchFeedback={vi.fn().mockResolvedValue({ ready: true, feedback })} />)
    expect(await screen.findByText('Tu sesión')).toBeInTheDocument()
    expect(screen.getByText('Lo que hiciste bien')).toBeInTheDocument()
    expect(screen.getByText(feedback.strengths[0])).toBeInTheDocument()
    expect(screen.getByText('Para la próxima')).toBeInTheDocument()
    expect(screen.getByText(feedback.nextSteps[0])).toBeInTheDocument()
    expect(screen.getByText(feedback.note)).toBeInTheDocument()
    expect(screen.getByText(/Hay 8 bolsas/)).toBeInTheDocument()
  })

  it('renders nothing when the room is not ready, the student could not be identified, or the request fails', async () => {
    for (const fetchFeedback of [vi.fn().mockResolvedValue({ ready: false }), vi.fn().mockResolvedValue({ ready: true, feedback: null }), vi.fn().mockRejectedValue(new Error('x'))]) {
      const { container, unmount } = render(<StudentFeedback sessionId="s1" fetchFeedback={fetchFeedback} />)
      await waitFor(() => expect(fetchFeedback).toHaveBeenCalledWith({ sessionId: 's1' }))
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
  })

  it('asks the server with only the session id', async () => {
    const post = vi.fn().mockResolvedValue({ ready: false })
    await fetchMyFeedback({ sessionId: 's9' }, { post })
    expect(post).toHaveBeenCalledWith('/api/my-summary', { sessionId: 's9' }, { subject: 'el servidor de sesiones' })
  })
})

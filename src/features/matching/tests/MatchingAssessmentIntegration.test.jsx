import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MatchingWorker } from './helpers/MatchingWorker'

const { fetchMatchingProfile } = vi.hoisted(() => ({
  fetchMatchingProfile: vi.fn(),
}))

vi.mock('@/features/matching/services/assessmentProfileService', () => ({
  fetchMatchingProfile,
}))

import MatchingPage from '../pages/MatchingPage'

const finalizedProfile = {
  schemaVersion: '1.0',
  courseId: 'course-5a',
  assessmentId: 'assessment-final',
  competencyId: 'resuelve-problemas-cantidad',
  generatedAt: '2026-10-17T21:00:00.000Z',
  status: 'finalized',
  students: [
    {
      studentId: 'student-a',
      overallScore: 6,
      maxScore: 10,
      skills: [
        {
          skillId: 'addition',
          score: 4,
          maxScore: 5,
          mastery: 0.8,
          evidenceCount: 2,
        },
      ],
    },
    {
      studentId: 'student-b',
      overallScore: 5,
      maxScore: 10,
      skills: [
        {
          skillId: 'addition',
          score: 2,
          maxScore: 5,
          mastery: 0.4,
          evidenceCount: 2,
        },
      ],
    },
  ],
}

let workerCreations

function renderMatching(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/matching" element={<MatchingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('integración de perfiles finalizados con matching', () => {
  beforeEach(() => {
    workerCreations = 0
    fetchMatchingProfile.mockReset()
    fetchMatchingProfile.mockResolvedValue(finalizedProfile)
    vi.stubGlobal(
      'Worker',
      function MatchingWorkerFactory() {
        workerCreations += 1
        return new MatchingWorker()
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('carga el perfil v1.0 desde el endpoint y solo agrupa tras la acción docente', async () => {
    renderMatching('/matching?courseId=course-5a&assessmentId=assessment-final')

    expect(
      await screen.findByText('2 estudiantes recibidos'),
    ).toBeInTheDocument()
    expect(fetchMatchingProfile).toHaveBeenCalledWith(
      'assessment-final',
      'course-5a',
    )
    expect(screen.getByText('Evaluación recibida')).toBeInTheDocument()
    expect(screen.getByText('student-a')).toBeInTheDocument()
    expect(screen.queryByText('Multiplicación')).not.toBeInTheDocument()
    expect(workerCreations).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    expect(
      await screen.findByRole('heading', { name: 'Propuesta de grupos' }),
    ).toBeInTheDocument()
    expect(workerCreations).toBe(1)
  })

  it('no reemplaza por perfiles demo cuando falla la carga de la evaluación', async () => {
    fetchMatchingProfile.mockRejectedValue(
      new Error('Solo se permiten evaluaciones finalizadas.'),
    )
    renderMatching('/matching?courseId=course-5a&assessmentId=assessment-open')

    expect(
      await screen.findByText('Solo se permiten evaluaciones finalizadas.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Datos de demostración')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agrupar' })).not.toBeInTheDocument()
    expect(workerCreations).toBe(0)
  })
})

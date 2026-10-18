import { useEffect, useState } from 'react'
import { Alert, Card } from '@/components/ui'
import { fetchMyFeedback } from '../services/myFeedbackService'

/**
 * «Tu sesión»: lo que le queda al alumno cuando la sala se cierra. Solo para alumnos (el docente ve el reporte completo).
 * Nunca una nota ni una comparación: lo que hizo bien y qué probar la próxima vez. Si el servidor no pudo identificarlo con
 * certeza, o falla, la tarjeta no aparece: es una ayuda, nunca debe molestar.
 *
 * @param {{ sessionId: string, fetchFeedback?: typeof fetchMyFeedback }} props
 */
export default function StudentFeedback({ sessionId, fetchFeedback = fetchMyFeedback }) {
  const [state, setState] = useState({ phase: 'loading', feedback: null })

  useEffect(() => {
    let active = true
    fetchFeedback({ sessionId })
      .then((data) => active && setState({ phase: data?.ready && data.feedback ? 'ready' : 'hidden', feedback: data?.feedback ?? null }))
      .catch(() => active && setState({ phase: 'hidden', feedback: null }))
    return () => {
      active = false
    }
  }, [sessionId, fetchFeedback])

  if (state.phase !== 'ready') return null
  const { feedback } = state

  return (
    <Card title={feedback.title} description="Lo que pasó en tu sesión de hoy.">
      {feedback.problem && <p className="mb-3 break-words text-sm text-[#5A6B6A]">Problema: {feedback.problem}</p>}

      {feedback.strengths.length > 0 && (
        <section aria-label="Lo que hiciste bien">
          <h3 className="text-sm font-bold text-[#2A7A35]">Lo que hiciste bien</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-[#304744]">
            {feedback.strengths.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </section>
      )}

      {feedback.nextSteps.length > 0 && (
        <section aria-label="Para la próxima" className={feedback.strengths.length > 0 ? 'mt-4' : ''}>
          <h3 className="text-sm font-bold text-[#304744]">Para la próxima</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-[#304744]">
            {feedback.nextSteps.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </section>
      )}

      <Alert tone="info" compact className="mt-4">{feedback.note}</Alert>
    </Card>
  )
}

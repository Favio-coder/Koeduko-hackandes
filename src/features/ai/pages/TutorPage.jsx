import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card, LoadingState } from '@/components/ui'
import Alert from '@/components/ui/Alert'
import Icon from '@/components/ui/Icon'
import { askTutor } from '../services/tutorService'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 3 (feature/sessions-ai)
 * Llama a `POST /api/ask-tutor` del backend de sesiones (`server/`, Vercel) con el ID token del usuario;
 * Gemini corre allí. Nunca invocar la API de Gemini directamente desde el navegador.
 *
 * Solo presentación: mismo envío, mismos mensajes, mismo servicio.
 */
export default function TutorPage({ sessionId: resolvedId }) {
  const params = useParams()
  // `sessionId` por prop lo usa "Tutor IA" del menú (ya resolvió el id); por la ruta /sessions/:sessionId/tutor sale de la URL.
  const sessionId = resolvedId ?? params.sessionId
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const send = async (event) => {
    event.preventDefault()
    const prompt = question.trim()
    if (!prompt) return
    setQuestion('')
    setMessages((prev) => [...prev, { from: 'student', text: prompt }])
    setLoading(true)
    setError(null)
    try {
      const reply = await askTutor({ sessionId, prompt })
      setMessages((prev) => [...prev, { from: 'tutor', text: reply }])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">
          Aprendizaje guiado
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#304744] sm:text-3xl">
          Tutor IA
        </h1>
        <p className="mt-1.5 text-sm text-[#5A6B6A]">
          Pistas progresivas. El tutor no entrega la solución final.
        </p>
      </header>

      <Card title="Conversación" padding="md">
        {messages.length === 0 ? (
          <div className="flex items-start gap-3 rounded-2xl bg-[#F8FAF6] p-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F8EA] text-[#2A7A35]">
              <Icon name="koala" className="h-5 w-5" />
            </span>
            <p className="text-sm text-[#5A6B6A]">
              Escribe tu duda. El tutor responderá con una pista, no con la respuesta.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m, i) => (
              <li
                key={i}
                className={[
                  'max-w-[85%] break-words rounded-2xl px-3.5 py-2.5 text-sm',
                  m.from === 'student'
                    ? 'ml-auto bg-[#4CDB59] text-[#263D48]'
                    : 'bg-[#F8FAF6] text-[#304744]',
                ].join(' ')}
              >
                {m.text}
              </li>
            ))}
          </ul>
        )}

        {loading && <LoadingState label="Pensando..." compact />}

        {error && (
          <div className="mt-3">
            <Alert tone="error" compact>
              {error}
            </Alert>
          </div>
        )}

        <form onSubmit={send} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="¿Cómo empiezo este problema?"
            aria-label="Escribe tu duda al tutor"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#ABB1AB]/60 bg-white px-3.5 text-sm text-[#304744] placeholder:text-[#7D8C8A] transition-colors duration-150 focus:border-[#4CDB59] focus:outline-none focus:ring-[3px] focus:ring-[#4CDB59]/40"
          />
          <Button type="submit" loading={loading} className="h-11">
            Enviar
          </Button>
        </form>
      </Card>

      <Link
        to={`/sessions/${sessionId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A7A35] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
        Volver a la sesión
      </Link>
    </div>
  )
}
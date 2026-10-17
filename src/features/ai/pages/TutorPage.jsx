import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { askTutor } from '../services/tutorService'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 3 (feature/sessions-ai)
 * Debe llamar a la Cloud Function `askTutor` (Gemini en el servidor).
 * Nunca invocar la API de Gemini directamente desde el navegador.
 */
export default function TutorPage() {
  const { sessionId } = useParams()
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
        <h1 className="text-2xl font-bold text-slate-900">Tutor IA</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pistas progresivas. El tutor no entrega la solucion final.
        </p>
      </header>

      <Card title="Conversacion">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">
            Escribe tu duda. El tutor respondera con una pista, no con la respuesta.
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m, i) => (
              <li
                key={i}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.from === 'student'
                    ? 'ml-auto bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.text}
              </li>
            ))}
          </ul>
        )}

        {loading && <p className="mt-3 text-sm text-slate-500">Pensando...</p>}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={send} className="mt-4 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="¿Como empiezo este problema?"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <Button type="submit" disabled={loading}>
            Enviar
          </Button>
        </form>
      </Card>

      <Link to={`/sessions/${sessionId}`} className="text-sm text-indigo-700 hover:underline">
        Volver a la sesion
      </Link>
    </div>
  )
}
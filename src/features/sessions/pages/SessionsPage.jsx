import { Link } from 'react-router-dom'
import { Button, Card, EmptyState } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useSessions } from '../hooks/useSessions'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 3 (feature/sessions-ai)
 * Debe crear sesiones en `learningSessions` y asociarlas a un pairId.
 */
export default function SessionsPage() {
  const { isTeacher } = useAuth()
  const { sessions, loading, error, createSession } = useSessions()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Sesiones de aprendizaje</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sesiones colaborativas por pareja con enlace de Google Meet.
        </p>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Cargando sesiones...</p>}

      {isTeacher && (
        <Card title="Nueva sesion" description="Se asocia a una pareja generada por el modulo 2.">
          <Button onClick={createSession} variant="secondary">
            Crear sesion de demostracion
          </Button>
        </Card>
      )}

      <Card title="Sesiones">
        {sessions.length === 0 ? (
          <EmptyState title="Sin sesiones" description="Crea la primera sesion de aprendizaje." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{session.title}</p>
                  <p className="text-xs uppercase text-slate-500">
                    {session.status} · {session.meetingUrl || 'sin enlace de Meet'}
                  </p>
                </div>
                <Link
                  to={`/sessions/${session.id}`}
                  className="text-sm font-medium text-indigo-700 hover:underline"
                >
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
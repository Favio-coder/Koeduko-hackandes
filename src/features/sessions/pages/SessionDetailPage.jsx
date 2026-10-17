import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card } from '@/components/ui'
import { useSession } from '../hooks/useSessions'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 3 (feature/sessions-ai)
 * Debe permitir al docente registrar/validar el enlace de Google Meet
 * y a los estudiantes unirse a la reunion.
 */
export default function SessionDetailPage() {
  const { sessionId } = useParams()
  const { session, loading } = useSession(sessionId)

  if (loading) return <p className="text-sm text-slate-500">Cargando sesion...</p>
  if (!session) {
    return (
      <Card title="Sesion no encontrada">
        <Link to="/sessions" className="text-sm text-indigo-700 hover:underline">
          Volver a sesiones
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{session.title}</h1>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone={session.status === 'scheduled' ? 'amber' : 'green'}>{session.status}</Badge>
          <span className="text-xs text-slate-500">pairId: {session.pairId}</span>
        </div>
      </header>

      <Card title="Reunion de Google Meet">
        {session.meetingUrl ? (
          <a
            href={session.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-indigo-700 hover:underline"
          >
            Unirse a la reunion
          </a>
        ) : (
          <p className="text-sm text-slate-600">
            Todavia no hay enlace de reunion. El docente debe registrarlo.
          </p>
        )}
      </Card>

      <Card title="Tutor IA" description="Pistas progresivas durante la sesion.">
        <Button to={`/sessions/${session.id}/tutor`} variant="secondary">
          Abrir tutor IA
        </Button>
      </Card>
    </div>
  )
}
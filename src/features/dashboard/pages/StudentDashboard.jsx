import { Link } from 'react-router-dom'
import { Button, Card, ProgressBar } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { DEMO_STUDENTS } from '@/shared/lib/demoData'

export default function StudentDashboard() {
  const { profile } = useAuth()
  const me = DEMO_STUDENTS[0]
  const sessions = [
    { id: 'demo-session-1', title: 'Pareja assigned - Ana y Luis', status: 'scheduled', meetingUrl: null },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Hola, {profile?.displayName || 'estudiante'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Completa tu diagnostico, revisa tu pareja y unite a la sesion.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Button to="/assessments">Realizar diagnostico</Button>
        <Button to="/sessions" variant="secondary">
          Ver mis sesiones
        </Button>
      </div>

      <Card title="Mi perfil de conocimientos" description="Datos ficticios de demostracion.">
        <div className="space-y-3">
          {Object.entries(me.skills).map(([skill, value]) => (
            <ProgressBar key={skill} value={value} label={skill} />
          ))}
        </div>
      </Card>

      <Card title="Mis sesiones">
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">Todavia no tienes sesiones asignadas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{session.title}</p>
                  <p className="text-xs uppercase text-slate-500">{session.status}</p>
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
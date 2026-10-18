import { Link } from 'react-router-dom'
import { Button, Card, ErrorState, LoadingState } from '@/components/ui'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useSessions } from '@/features/sessions/hooks/useSessions'

export default function StudentDashboard() {
  const { profile } = useAuth()
  const { sessions, loading, error, reload } = useSessions()
  const firstName = (profile?.displayName || 'estudiante').split(' ')[0]


  return (
    <div className="min-w-0 w-full space-y-6">
      {/* Saludo */}
      <header className="flex flex-col gap-4 rounded-3xl border border-[#E6EAE3] bg-white p-5 shadow-[0_1px_3px_rgba(48,71,68,0.08)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={profile?.displayName || 'Estudiante'} size="lg" showStatus />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">
              Panel estudiante
            </p>
            <h2 className="mt-0.5 truncate text-2xl font-bold tracking-tight text-[#304744]">
              Hola, {firstName}
            </h2>
          </div>
        </div>
        <Button to="/assessments" icon="clipboard" className="w-full sm:w-auto">
          Realizar diagnóstico
        </Button>
      </header>

      <p className="-mt-3 text-sm text-[#5A6B6A] sm:mt-0">
        Completa tu diagnóstico, revisa tu pareja y únete a la sesión.
      </p>

      {/* Acciones */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button to="/assessments" icon="clipboard" fullWidth>
          Realizar diagnóstico
        </Button>
        <Button to="/sessions" variant="secondary" icon="video" fullWidth>
          Ver mis salas
        </Button>
      </div>

      <Card title="Mis evaluaciones" description="Consulta tus evaluaciones y calificaciones en Curso.">
        <Button to="/assessments" variant="secondary">Ver evaluaciones y resultados</Button>
      </Card>

      {/* Sesiones */}
      <Card title="Mis salas" padding="sm" className="min-w-0 max-w-full">
        {loading && <LoadingState label="Cargando mis salas…" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && (sessions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#5A6B6A]">
            Todavía no tienes sesiones asignadas.
          </p>
        ) : (
          <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-[#E6EAE3] bg-white p-4 transition-[border-color,box-shadow] duration-200 hover:border-[#B7E8B5] hover:shadow-[0_12px_32px_rgba(48,71,68,0.12)] sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F8EA] text-[#2A7A35]">
                  <Icon name="video" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="[overflow-wrap:anywhere] text-sm font-semibold text-[#304744]">{session.title}</p>
                  <p className="[overflow-wrap:anywhere] text-xs uppercase text-[#7D8C8A]">{session.status}</p>
                </div>
                <Link
                  to={`/sessions/${session.id}`}
                  className="col-span-2 flex min-h-10 items-center justify-center rounded-lg bg-[#E9F8EA] px-2.5 py-1.5 text-xs font-semibold text-[#2A7A35] transition-colors duration-150 hover:bg-[#DDF3DD] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45 sm:col-span-1"
                >
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </Card>
    </div>
  )
}

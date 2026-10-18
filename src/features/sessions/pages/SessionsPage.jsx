import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import Icon from '@/components/ui/Icon'
import useToast from '@/components/ui/useToast'
import { SESSION_STATUS } from '@/shared/constants/contracts'
import { useAuth } from '@/contexts/AuthContext'
import { useSessions } from '../hooks/useSessions'

/** Etiqueta y tono del badge según el estado del contrato. */
const STATUS_META = {
  [SESSION_STATUS.SCHEDULED]: { label: 'Programada', tone: 'info', icon: 'calendar' },
  [SESSION_STATUS.LIVE]: { label: 'En vivo', tone: 'danger', dot: true, icon: 'video' },
  [SESSION_STATUS.COMPLETED]: { label: 'Realizada', tone: 'success', icon: 'check' },
  [SESSION_STATUS.CANCELLED]: { label: 'Cancelada', tone: 'neutral', icon: 'close' },
}

/** Proveedor de la reunión a partir de la URL (solo presentación). */
function providerFrom(url) {
  if (!url) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('meet.google.com')) return 'Google Meet'
    if (host.includes('zoom.us')) return 'Zoom'
    if (host.includes('teams.microsoft.com')) return 'Microsoft Teams'
    return host
  } catch {
    return 'Videollamada'
  }
}

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default function SessionsPage() {
  const { isTeacher } = useAuth()
  const { sessions: allSessions, loading, error, reload } = useSessions()
  const [params] = useSearchParams()
  const sessions = allSessions.filter((session) =>
    (!params.get('courseId') || session.courseId === params.get('courseId')) &&
    (!params.get('assessmentId') || session.assessmentId === params.get('assessmentId')) &&
    (!params.get('studentId') || session.studentIds?.includes(params.get('studentId'))))
  const toast = useToast()

  const handleCopy = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado al portapapeles.')
    } catch {
      toast.error('No se pudo copiar. Copia el enlace manualmente.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado de la vista */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">
            Aprendizaje colaborativo
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#304744] sm:text-3xl">
            Salas de reuniones
          </h2>
          <p className="mt-1.5 text-sm text-[#5A6B6A]">
            Salas privadas de tus grupos con enlace de videollamada y seguimiento del estado.
          </p>
        </div>

        {isTeacher && (
          <Button to="/matching/results" icon="users" className="w-full shrink-0 sm:w-auto">Crear salas desde resultados</Button>
        )}
      </header>

      {error && <ErrorState error={error} onRetry={reload} compact />}
      {loading && <LoadingState label="Cargando salas..." compact />}

      {/* Contenido */}
      {!loading && (
        <>
          {sessions.length === 0 ? (
            <EmptyState
              icon="video"
              title="Sin salas por ahora"
              description="Las salas aparecerán cuando el docente confirme los grupos en Resultados."
              action={isTeacher ? <Button to="/matching/results">Ir a resultados</Button> : null}
            />
          ) : (
            <Card
              title="Salas"
              description={`${sessions.length} ${sessions.length === 1 ? 'sala' : 'salas'} registradas`}
              padding="sm"
            >
              {/* Grid responsive: 1 columna en móvil, 2 en tablet, 3 en escritorio */}
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sessions.map((session) => {
                  const status = STATUS_META[session.status] ?? {
                    label: session.status,
                    tone: 'neutral',
                    icon: 'info',
                  }
                  const provider = providerFrom(session.meetingUrl)

                  return (
                    <li
                      key={session.id}
                      className="flex flex-col gap-3 rounded-2xl border border-[#E6EAE3] bg-white p-4 transition-[box-shadow,border-color] duration-200 ease-out hover:border-[#B7E8B5] hover:shadow-[0_12px_32px_rgba(48,71,68,0.14)]"
                    >
                      {/* Encabezado de la tarjeta */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 flex-1 text-sm font-bold leading-snug text-[#304744]">
                          {session.title}
                        </h3>
                        <Badge tone={status.tone} dot={status.dot} className="shrink-0">
                          {status.label}
                        </Badge>
                      </div>

                      {/* Metadatos */}
                      <dl className="space-y-1.5 text-xs text-[#5A6B6A]">
                        <div className="flex items-center gap-2">
                          <Icon name="calendar" className="h-4 w-4 shrink-0 text-[#7D8C8A]" />
                          <dt className="sr-only">Fecha</dt>
                          <dd className="min-w-0 truncate">
                            {session.scheduledAt
                              ? dateFormatter.format(session.scheduledAt?.toDate?.() ?? new Date(session.scheduledAt))
                              : 'Fecha por definir'}
                          </dd>
                        </div>

                        <div className="flex items-center gap-2">
                          <Icon name="video" className="h-4 w-4 shrink-0 text-[#7D8C8A]" />
                          <dt className="sr-only">Proveedor</dt>
                          <dd className="min-w-0 truncate">{provider ?? 'Enlace por registrar'}</dd>
                        </div>

                        <div className="flex items-center gap-2">
                          <Icon name="users" className="h-4 w-4 shrink-0 text-[#7D8C8A]" />
                          <dt className="sr-only">Integrantes</dt>
                          {/* URL larga: se recorta en lugar de desbordar */}
                          <dd className="min-w-0 truncate">{session.members?.map((member) => member.displayName).join(' · ') || session.groupId || session.pairId}</dd>
                        </div>
                      </dl>

                      {/* Acciones */}
                      <div className="mt-auto flex flex-wrap gap-2 border-t border-[#E6EAE3] pt-3">
                        <Button
                          size="sm"
                          icon="video"
                          disabled={!session.meetingUrl}
                          onClick={() => window.open(session.meetingUrl, '_blank', 'noreferrer')}
                        >
                          Entrar
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          icon="link"
                          disabled={!session.meetingUrl}
                          onClick={() => handleCopy(session.meetingUrl)}
                        >
                          Copiar
                        </Button>

                        <Link
                          to={`/sessions/${session.id}`}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#2A7A35] transition-colors duration-150 hover:bg-[#E9F8EA] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
                        >
                          Ver detalle
                          <Icon name="chevronRight" className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

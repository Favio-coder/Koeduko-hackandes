/**
 * SessionShelf — salas del estudiante con llamada a la acción.
 *
 * La sala más próxima se destaca como «próxima misión» con su acceso directo; el
 * resto queda en una lista compacta para no competir con ella.
 */
import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import Icon from '@/components/ui/Icon'

const statusMeta = {
  live: { label: 'En vivo', tone: 'danger', dot: true },
  scheduled: { label: 'Programada', tone: 'info' },
  completed: { label: 'Realizada', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
}

export default function SessionShelf({ sessions = [] }) {
  const next = sessions.find((session) => session.status === 'live' || session.status === 'scheduled')
  const others = sessions.filter((session) => session.id !== next?.id)

  return (
    <Card
      title="Mis salas"
      description="Practica en vivo con tu pareja de aprendizaje."
      actions={
        sessions.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E9F8EA] px-2.5 py-1 text-xs font-bold tabular-nums text-[#2A7A35]">
            <Icon name="video" className="h-3.5 w-3.5" />
            {sessions.length}
          </span>
        ) : null
      }
      padding="sm"
    >
      {sessions.length === 0 ? (
        <EmptyState
          compact
          icon="video"
          title="Todavía no tienes salas"
          description="Cuando tu docente cree una sala para tu pareja, aparecerá aquí con su enlace de acceso."
          action={
            <Button to="/sessions" variant="secondary" icon="video">
              Ver mis salas
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {next && (
            <div className="relative isolate overflow-hidden rounded-2xl border border-[#B7E8B5] bg-gradient-to-br from-[#F0FFF1] via-[#F7FFF7] to-[#EAF5FF] p-4">
              <div aria-hidden="true" className="absolute -right-8 -top-10 -z-10 h-28 w-28 rounded-full bg-[#B7E8B5]/50 blur-2xl" />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#2A7A35] shadow-sm ring-1 ring-[#D7EDD6]">
                    <Icon name="video" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">
                      Próxima misión
                    </p>
                    <p className="mt-0.5 break-words text-sm font-extrabold text-[#304744]">
                      {next.title}
                    </p>
                  </div>
                </div>
                <Badge tone={statusMeta[next.status]?.tone ?? 'neutral'} dot={statusMeta[next.status]?.dot}>
                  {statusMeta[next.status]?.label ?? next.status}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button to={`/sessions/${next.id}`} icon="arrowRight" className="w-full sm:w-auto">
                  Entrar a la sala
                </Button>
                <Button to={`/sessions/${next.id}/tutor`} variant="blueSoft" icon="koala" className="w-full sm:w-auto">
                  Consultar al tutor IA
                </Button>
              </div>
            </div>
          )}

          {others.length > 0 && (
            <ul aria-label="Otras salas" className="grid gap-2.5 sm:grid-cols-2">
              {others.map((session) => {
                const meta = statusMeta[session.status] ?? { label: session.status, tone: 'neutral' }
                return (
                  <li
                    key={session.id}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#E6EAE3] bg-white p-3.5 transition-[border-color,box-shadow] duration-200 hover:border-[#B7E8B5] hover:shadow-[0_12px_32px_rgba(48,71,68,0.12)]"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F7F2] text-[#304744]">
                      <Icon name="video" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#304744]">{session.title}</p>
                      <Badge tone={meta.tone} size="sm" className="mt-1">
                        {meta.label}
                      </Badge>
                    </div>
                    <Link
                      to={`/sessions/${session.id}`}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#2A7A35] transition-colors duration-150 hover:bg-[#E9F8EA] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
                    >
                      Abrir
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

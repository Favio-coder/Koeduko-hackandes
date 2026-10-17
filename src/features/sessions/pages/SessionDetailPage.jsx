import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card, LoadingState } from '@/components/ui'
import Icon from '@/components/ui/Icon'
import useToast from '@/components/ui/useToast'
import { SESSION_STATUS } from '@/shared/constants/contracts'
import { useSession } from '../hooks/useSessions'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 3 (feature/sessions-ai)
 * Debe permitir al docente registrar/validar el enlace de Google Meet
 * y a los estudiantes unirse a la reunion.
 *
 * Solo cambia la presentación: mismos datos, mismo enlace, mismo destino.
 */

const STATUS_META = {
  [SESSION_STATUS.SCHEDULED]: { label: 'Programada', tone: 'info' },
  [SESSION_STATUS.LIVE]: { label: 'En vivo', tone: 'danger', dot: true },
  [SESSION_STATUS.COMPLETED]: { label: 'Realizada', tone: 'success' },
  [SESSION_STATUS.CANCELLED]: { label: 'Cancelada', tone: 'neutral' },
}

export default function SessionDetailPage() {
  const { sessionId } = useParams()
  const { session, loading } = useSession(sessionId)
  const toast = useToast()

  if (loading) return <LoadingState label="Cargando sesión..." />

  if (!session) {
    return (
      <Card title="Sesión no encontrada">
        <Link
          to="/sessions"
          className="text-sm font-semibold text-[#2A7A35] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
        >
          Volver a salas
        </Link>
      </Card>
    )
  }

  const status = STATUS_META[session.status] ?? { label: session.status, tone: 'neutral' }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(session.meetingUrl)
      toast.success('Enlace copiado al portapapeles.')
    } catch {
      toast.error('No se pudo copiar. Copia el enlace manualmente.')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3">
        <Link
          to="/sessions"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#5A6B6A] transition-colors duration-150 hover:text-[#2A7A35] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
          Volver a salas
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-2xl font-bold tracking-tight text-[#304744] sm:text-3xl">
            {session.title}
          </h2>
          <Badge tone={status.tone} dot={status.dot}>
            {status.label}
          </Badge>
        </div>

        <p className="font-mono text-xs text-[#7D8C8A]">pairId: {session.pairId}</p>
      </header>

      <Card title="Reunión de Google Meet" description="Enlace generado para esta pareja.">
        {session.meetingUrl ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={session.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-0 items-center gap-2 rounded-xl bg-[#F8FAF6] px-3 py-2.5 text-sm font-medium text-[#304744] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
            >
              <Icon name="video" className="h-4 w-4 shrink-0 text-[#2A7A35]" />
              {/* URL larga: se recorta en vez de desbordar el layout */}
              <span className="max-w-[16rem] truncate sm:max-w-xs">{session.meetingUrl}</span>
            </a>

            <div className="flex gap-2 sm:ml-auto">
              <Button variant="secondary" icon="link" onClick={handleCopy}>
                Copiar
              </Button>
              <Button icon="external" onClick={() => window.open(session.meetingUrl, '_blank', 'noreferrer')}>
                Entrar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#5A6B6A]">
            Todavía no hay enlace de reunión. El docente debe registrarlo.
          </p>
        )}
      </Card>

      <Card
        title="Tutor IA"
        description="Pistas progresivas durante la sesión para la pareja."
        variant="accent"
        className="border-[#B7E8B5]"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#2A7A35]">
            Ayuda guiada sin resolver el ejercicio por el estudiante.
          </p>
          <Button to={`/sessions/${session.id}/tutor`} variant="subtle" icon="sparkles" className="shrink-0">
            Abrir tutor IA
          </Button>
        </div>
      </Card>
    </div>
  )
}
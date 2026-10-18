import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import Icon from '@/components/ui/Icon'
import useToast from '@/components/ui/useToast'
import { useAuth } from '@/contexts/AuthContext'
import { SESSION_STATUS } from '@/shared/constants/contracts'
import CloseSession from '../components/CloseSession'
import CompetencyReport from '../components/CompetencyReport'
import InterventionsCard from '../components/InterventionsCard'
import InviteTutor from '../components/InviteTutor'
import StudentFeedback from '../components/StudentFeedback'
import TalkShareCard from '../components/TalkShareCard'
import TranscriptCard from '../components/TranscriptCard'
import MeetingLinkForm from '../components/MeetingLinkForm'
import { useLiveSession } from '../hooks/useLiveSession'
import { useNow } from '../hooks/useNow'
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat'
import { useSessionSummary } from '../hooks/useSessionSummary'
import { botStatusMeta, canInvite } from '../lib/describeIntervention'
import { inviteTutor } from '../services/sessionBotService'

/**
 * Sesion en vivo: quien habla, la conversacion y lo que dijo el tutor, todo por onSnapshot.
 * Los datos de la pantalla salen de `live/view` (un documento chico que escribe el servidor),
 * no de la ventana cruda de eventos, para no gastar la cuota gratuita de lecturas de Firestore.
 */

const STATUS_META = {
  [SESSION_STATUS.SCHEDULED]: { label: 'Programada', tone: 'info' },
  [SESSION_STATUS.LIVE]: { label: 'En vivo', tone: 'danger', dot: true },
  [SESSION_STATUS.COMPLETED]: { label: 'Realizada', tone: 'success' },
  [SESSION_STATUS.CANCELLED]: { label: 'Cancelada', tone: 'neutral' },
}

const BACK_LINK_CLASS =
  'inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#5A6B6A] transition-colors duration-150 hover:text-[#2A7A35] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45'

/** `sessionId` por prop lo usa "Sesión activa" del menú (ya resolvió el id); por la ruta /sessions/:sessionId sale de la URL. */
export default function SessionDetailPage({ sessionId: resolvedId }) {
  const params = useParams()
  const sessionId = resolvedId ?? params.sessionId
  const { isTeacher, user } = useAuth()
  const { loading, error, session, view, interventions, retry } = useLiveSession(sessionId)
  const nowMs = useNow()
  const toast = useToast()
  // El reporte de cierre solo lo lee el docente (reglas de Firestore): al estudiante no se le suscribe.
  const { summary } = useSessionSummary(sessionId, { enabled: isTeacher })
  const [creating, setCreating] = useState(false)
  const [closed, setClosed] = useState(null) // lo que devolvio close-session, para mostrar el reporte sin esperar a Firestore

  // Mientras el tutor esta en la reunion y la sala sigue abierta, la pantalla avisa cada ~20 s para que el servidor reevalue
  // aunque nadie hable (el silencio no genera eventos). El servidor limita a una evaluacion cada 15 s por sala.
  useSessionHeartbeat(sessionId, {
    enabled: session?.bot?.status === 'in_call' && session?.status !== SESSION_STATUS.COMPLETED && !closed && !summary?.report,
  })

  if (loading) return <LoadingState label="Cargando sesión..." />

  const status = STATUS_META[session?.status]
  const botStatus = session?.bot?.status
  const hasActivity = Boolean(view) || interventions.length > 0
  // Solo el enunciado: la respuesta esperada ya no esta en este documento (vive en private/answer).
  const problemText = session?.currentProblem?.text
  const report = closed?.report ?? summary?.report ?? null
  const reportSteps = closed?.steps ?? summary?.steps
  const isClosed = Boolean(report) || session?.status === SESSION_STATUS.COMPLETED

  // Quien entra al Meet de la sala (docente o integrante) trae al tutor sin pasos extra. El servidor no duplica el bot
  // (lo reserva en una transaccion); si algo falla, el docente conserva el boton «Invitar tutor».
  const handleEnter = () => {
    window.open(session.meetingUrl, '_blank', 'noreferrer')
    if (!isClosed && canInvite(botStatus)) inviteTutor({ sessionId }).catch(() => {})
  }

  // La sala no tiene Meet: el servidor lo crea con la cuenta de Google del docente, trae al tutor y devuelve el enlace. La pestaña
  // se abre YA, dentro del clic, para que el navegador no la bloquee por esperar la respuesta.
  const handleCreateAndEnter = async () => {
    const popup = window.open('about:blank', '_blank')
    setCreating(true)
    try {
      const data = await inviteTutor({ sessionId })
      if (data?.meetingUrl && popup) popup.location.href = data.meetingUrl
      else if (data?.meetingUrl) window.location.assign(data.meetingUrl)
      else popup?.close()
    } catch (failure) {
      popup?.close()
      toast.error(failure.message)
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(session.meetingUrl)
      toast.success('Enlace copiado al portapapeles.')
    } catch {
      toast.error('No se pudo copiar. Copia el enlace manualmente.')
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-3">
        <Link to="/sessions" className={BACK_LINK_CLASS}>
          <Icon name="chevronLeft" className="h-4 w-4" />
          Volver a salas
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="min-w-0 break-words text-2xl font-bold tracking-tight text-[#304744] sm:text-3xl">
            {session?.title || `Sesión ${sessionId}`}
          </h2>
          {status && (
            <Badge tone={status.tone} dot={status.dot}>
              {status.label}
            </Badge>
          )}
          {botStatus && (
            <Badge tone={botStatusMeta(botStatus).tone} dot={botStatusMeta(botStatus).dot}>
              {botStatusMeta(botStatus).label}
            </Badge>
          )}
        </div>
      </header>

      {!error && session?.members?.length > 0 && <Card title="Integrantes de la sala">
        <ul>{session.members.map((member) => <li key={member.studentId}>{member.displayName}</li>)}</ul>
        <p className="mt-2 text-xs text-[#5A6B6A]">{session.courseName} · {session.assessmentTitle}</p>
      </Card>}
      {!error && isTeacher && session?.createdBy === user?.uid && session?.status === SESSION_STATUS.SCHEDULED && !session?.bot?.id && !['requested', 'joining', 'in_call'].includes(session?.bot?.status) &&
        <MeetingLinkForm key={sessionId} session={{ ...session, id: sessionId }} />}
      {isTeacher && !isClosed && <InviteTutor sessionId={sessionId} botStatus={botStatus} />}
      {isTeacher && !isClosed && <CloseSession sessionId={sessionId} onClosed={setClosed} />}
      {report && <CompetencyReport report={report} steps={reportSteps} />}
      {!isTeacher && session?.status === SESSION_STATUS.COMPLETED && <StudentFeedback sessionId={sessionId} />}

      {session && !session.meetingUrl && !isClosed && (
        <Card title="Reunión de Google Meet" description="Esta sala todavía no tiene reunión.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#5A6B6A]">Se crea sola, con la cuenta de Google que conectó el docente, y el tutor entra con ustedes.</p>
            <Button icon="video" loading={creating} disabled={creating} onClick={handleCreateAndEnter} className="sm:shrink-0">
              Crear reunión y entrar
            </Button>
          </div>
        </Card>
      )}

      {session?.meetingUrl && (
        <Card title="Reunión de Google Meet" description="Enlace de esta pareja.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={session.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-2 rounded-xl bg-[#F8FAF6] px-3 py-2.5 text-sm font-medium text-[#304744] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
            >
              <Icon name="video" className="h-4 w-4 shrink-0 text-[#2A7A35]" />
              <span className="min-w-0 truncate sm:max-w-xs">{session.meetingUrl}</span>
            </a>

            <div className="flex gap-2 sm:ml-auto">
              <Button variant="secondary" icon="link" onClick={handleCopy}>
                Copiar
              </Button>
              <Button icon="external" onClick={handleEnter}>
                Entrar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {problemText && (
        <Card title="Problema de la sesión" description="Lo que están resolviendo ahora.">
          <p className="break-words text-base font-medium text-[#304744]">{problemText}</p>
        </Card>
      )}

      {error ? (
        <ErrorState title="No se pudo abrir la sesión" error={error} onRetry={retry} />
      ) : hasActivity ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-6">
            <TalkShareCard view={view} />
            <TranscriptCard lines={view?.transcripts ?? []} />
          </div>
          <div className="min-w-0">
            <InterventionsCard items={interventions} nowMs={nowMs} />
          </div>
        </div>
      ) : (
        <EmptyState
          title="Esperando al tutor…"
          description="Cuando el tutor entre a la reunión y alguien hable, aquí verás quién participa y qué dice el tutor."
        />
      )}

      <Card
        title="Tutor IA"
        description="Pistas progresivas durante la sesión para la pareja."
        variant="accent"
        className="border-[#B7E8B5]"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#2A7A35]">Ayuda guiada sin resolver el ejercicio por el estudiante.</p>
          <Button to={`/sessions/${sessionId}/tutor`} variant="subtle" icon="sparkles" className="shrink-0">
            Abrir tutor IA
          </Button>
        </div>
      </Card>
    </div>
  )
}

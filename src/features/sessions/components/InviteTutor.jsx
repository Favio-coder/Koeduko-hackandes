import { useState } from 'react'
import { Alert, Badge, Button, Card } from '@/components/ui'
import { botStatusMeta, canInvite } from '../lib/describeIntervention'
import { inviteTutor } from '../services/sessionBotService'

/**
 * "Invitar tutor": solo para el docente (la pagina decide si lo muestra; el servidor lo exige igual).
 * Envia solo el id de la sesion: el enlace de Meet lo lee el servidor de la sesion guardada.
 * El estado del tutor llega por la propia sesion (bot.status), asi que el boton se bloquea solo
 * mientras el tutor esta pedido o dentro de la llamada.
 *
 * @param {{ sessionId: string, botStatus?: string, invite?: typeof inviteTutor }} props
 */
export default function InviteTutor({ sessionId, botStatus, invite = inviteTutor }) {
  const [state, setState] = useState({ phase: 'idle', message: '' })
  const status = botStatusMeta(botStatus)
  const pending = state.phase === 'pending'

  const handleInvite = async () => {
    setState({ phase: 'pending', message: '' })
    try {
      await invite({ sessionId })
      setState({ phase: 'done', message: 'Tutor invitado. Admítelo cuando pida entrar a la reunión de Meet.' })
    } catch (error) {
      setState({ phase: 'error', message: error.message })
    }
  }

  return (
    <Card title="Tutor en la reunión" description="Entra a tu Meet, escucha y ayuda a la pareja.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Badge tone={status.tone} dot={status.dot} className="w-fit">
          {status.label}
        </Badge>
        <Button icon="sparkles" loading={pending} disabled={pending || !canInvite(botStatus)} onClick={handleInvite} className="sm:shrink-0">
          {pending ? 'Invitando…' : 'Invitar tutor'}
        </Button>
      </div>

      {state.phase === 'done' && <Alert tone="success" compact className="mt-3">{state.message}</Alert>}
      {state.phase === 'error' && <Alert tone="error" compact className="mt-3">{state.message}</Alert>}
    </Card>
  )
}

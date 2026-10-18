import { useState } from 'react'
import { Alert, Button, Card, ConfirmDialog } from '@/components/ui'
import { closeSession } from '../services/closeSessionService'

/**
 * "Cerrar sesión": solo para el docente (la pagina decide si lo muestra; el servidor lo exige igual).
 * Pide confirmacion porque saca al tutor de la reunion y genera el reporte. Cuando termina, entrega
 * el resultado a `onClosed` para que la pagina muestre el reporte de inmediato.
 *
 * @param {{ sessionId: string, onClosed: (result: object) => void, close?: typeof closeSession }} props
 */
export default function CloseSession({ sessionId, onClosed, close = closeSession }) {
  const [state, setState] = useState({ phase: 'idle', message: '' })
  const [confirming, setConfirming] = useState(false)
  const pending = state.phase === 'pending'

  const handleConfirm = async () => {
    setState({ phase: 'pending', message: '' })
    try {
      const result = await close({ sessionId })
      setConfirming(false)
      setState({ phase: 'idle', message: '' })
      onClosed(result)
    } catch (error) {
      setConfirming(false)
      setState({ phase: 'error', message: error.message })
    }
  }

  return (
    <Card title="Terminar la sesión" description="Saca al tutor de la reunión y genera la evidencia por competencias.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#5A6B6A]">El reporte queda guardado y el tutor recordará a cada estudiante en la próxima sesión.</p>
        <Button variant="secondary" icon="check" onClick={() => setConfirming(true)} disabled={pending} className="sm:shrink-0">
          Cerrar sesión
        </Button>
      </div>

      {state.phase === 'error' && (
        <Alert tone="error" compact className="mt-3">
          {state.message}
        </Alert>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => !pending && setConfirming(false)}
        onConfirm={handleConfirm}
        loading={pending}
        tone="primary"
        title="¿Cerrar la sesión?"
        description="El tutor saldrá de la reunión y se generará el reporte de evidencia por competencias."
        confirmLabel="Cerrar sesión"
      />
    </Card>
  )
}

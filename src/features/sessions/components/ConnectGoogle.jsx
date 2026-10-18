import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card } from '@/components/ui'
import { fetchGoogleStatus, requestGoogleAuthUrl } from '../services/googleConnectService'

/**
 * «Cuenta de Google»: solo para el docente. Conectarla una vez permite que el servidor cree la reunión de Meet de cada sala
 * cuando alguien entra (sin que el docente pegue enlaces). Si el servidor no tiene Google configurado, la tarjeta no molesta:
 * el enlace se registra a mano como siempre.
 *
 * @param {{ fetchStatus?: typeof fetchGoogleStatus, requestUrl?: typeof requestGoogleAuthUrl, navigate?: (url: string) => void }} props
 */
export default function ConnectGoogle({ fetchStatus = fetchGoogleStatus, requestUrl = requestGoogleAuthUrl, navigate = (url) => window.location.assign(url) }) {
  const [status, setStatus] = useState({ phase: 'loading', connected: false })
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let active = true
    fetchStatus()
      .then((connected) => active && setStatus({ phase: 'ready', connected }))
      // Sin Google configurado en el servidor (o sin red) la tarjeta se oculta: nada se rompe.
      .catch(() => active && setStatus({ phase: 'unavailable', connected: false }))
    return () => {
      active = false
    }
  }, [fetchStatus])

  if (status.phase === 'loading' || status.phase === 'unavailable') return null

  const handleConnect = async () => {
    setPending(true)
    setError('')
    try {
      navigate(await requestUrl())
    } catch (failure) {
      setError(failure.message)
      setPending(false)
    }
  }

  return (
    <Card title="Cuenta de Google" description="Para crear las reuniones de Meet de tus salas automáticamente.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Badge tone={status.connected ? 'success' : 'warning'} dot className="w-fit">
          {status.connected ? 'Conectada' : 'No conectada'}
        </Badge>
        <Button variant={status.connected ? 'secondary' : 'primary'} icon="link" loading={pending} disabled={pending} onClick={handleConnect} className="sm:shrink-0">
          {status.connected ? 'Volver a conectar' : 'Conectar Google'}
        </Button>
      </div>
      {error && <Alert tone="error" compact className="mt-3">{error}</Alert>}
    </Card>
  )
}

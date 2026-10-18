import { useState } from 'react'
import { Button, ErrorState } from '@/components/ui'
import { createRoomsFromMatching } from '@/features/sessions/services/groupSessionService'

export default function PublishGroupRooms({ result }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [published, setPublished] = useState(null)
  const publish = async () => {
    setBusy(true)
    setError(null)
    try { setPublished(await createRoomsFromMatching(result)) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  const url = '/sessions?' + new URLSearchParams({ courseId: result.courseId, assessmentId: result.assessmentId })
  return <div className="space-y-3 rounded-2xl border border-[#B7E8B5] bg-[#E9F8EA] p-4">
    <p className="text-sm text-[#304744]">Confirma estos grupos para crear una sala privada por pareja o trío.</p>
    {published ? <div role="status" className="flex flex-wrap items-center gap-3">
      <span>{published.sessionIds.length} {published.sessionIds.length === 1 ? 'sala disponible' : 'salas disponibles'} para los integrantes asignados.</span>
      <Button to={url}>Ver salas</Button>
      {published.sessionIds.length === 1 && <Button to={'/sessions/' + published.sessionIds[0]} variant="secondary">Abrir sesión privada</Button>}
    </div> : <Button onClick={publish} loading={busy}>Crear salas para estos grupos</Button>}
    {error && <ErrorState error={error} />}
  </div>
}

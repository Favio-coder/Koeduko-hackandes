import { useState } from 'react'
import { Button, ErrorState } from '@/components/ui'
import { saveMeetingUrl } from '../services/groupSessionService'

export default function MeetingLinkForm({ session }) {
  const [url, setUrl] = useState(session.meetingUrl || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try { await saveMeetingUrl(session.id, url); setSaved(true) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[#E6EAE3] bg-white p-4">
    <label className="block space-y-2 text-sm font-semibold text-[#304744]">Enlace de Google Meet
      <input type="url" required pattern="https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}" value={url} onChange={(event) => { setUrl(event.target.value); setSaved(false) }} placeholder="https://meet.google.com/abc-defg-hij" className="block w-full rounded-xl border border-[#ABB1AB] p-3" />
    </label>
    <Button type="submit" loading={busy}>Guardar enlace</Button>
    {saved && <p role="status">Enlace guardado para los integrantes de esta sala.</p>}
    {error && <ErrorState error={error} />}
  </form>
}

import { auth } from '@/services/firebase'

export async function assessmentRequest(action, payload = {}) {
  const user = auth.currentUser
  if (!user) throw new Error('Inicia sesión para continuar.')
  const response = await fetch('/api/assessments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ action, payload }),
  })
  const data = await response.json().catch(() => { throw new Error('API no disponible. Usa el despliegue Vercel o vercel dev.') })
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.')
  return data
}

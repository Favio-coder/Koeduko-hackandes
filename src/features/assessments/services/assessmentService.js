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

export async function getMatchingContract(assessmentId, courseId) {
  const user = auth.currentUser
  if (!user) throw new Error('Inicia sesión para continuar.')
  const query = new URLSearchParams({ assessmentId, courseId })
  const response = await fetch(`/api/assessments/matching-profile?${query}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  })
  const data = await response.json().catch(() => {
    throw new Error('API no disponible. Usa el despliegue Vercel o vercel dev.')
  })
  if (!response.ok) throw new Error(data.error || 'No se pudo exportar el perfil.')
  return data
}

export function downloadContract(contract) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(contract, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `matching-v1-${contract.assessmentId}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

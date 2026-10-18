import { auth } from '@/services/firebase'

async function request(payload) {
  if (!auth.currentUser) throw new Error('Inicia sesión para continuar.')
  const response = await fetch('/api/group-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await auth.currentUser.getIdToken() },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => { throw new Error('API no disponible. Usa Vercel o vercel dev.') })
  if (!response.ok) throw new Error(data.error || 'No se pudo guardar la sala.')
  return data
}

export function createRoomsFromMatching(result) {
  if (result?.status !== 'optimal' || result.source?.containsSimulatedData || !result.courseId || !result.assessmentId) throw new Error('Se requiere un agrupamiento de una evaluación real.')
  return request({
    action: 'publish', courseId: result.courseId, assessmentId: result.assessmentId,
    groups: result.groups.map(({ studentIds, focusSkillIds }) => ({ studentIds, focusSkillIds })),
    assessmentEvidence: result.assessmentEvidence,
  })
}

export const saveMeetingUrl = (sessionId, meetingUrl) => request({ action: 'meeting', sessionId, meetingUrl: meetingUrl.trim() })

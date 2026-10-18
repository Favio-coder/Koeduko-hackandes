export async function fetchMatchingProfile(
  assessmentId,
  courseId,
  getIdToken,
) {
  if (!assessmentId || !courseId) {
    throw new Error('Curso y evaluación son obligatorios.')
  }
  const user = getIdToken
    ? null
    : (await import('@/services/firebase')).auth.currentUser
  if (!getIdToken && !user) {
    throw new Error('Inicia sesión para preparar perfiles.')
  }

  const token = await (getIdToken ? getIdToken() : user.getIdToken())
  const query = new URLSearchParams({ assessmentId, courseId })
  const response = await fetch(
    `/api/assessments/matching-profile?${query.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const data = await response.json().catch(() => {
    throw new Error('API no disponible. Usa Vercel Dev o el despliegue Vercel.')
  })
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo preparar el perfil para matching.')
  }
  return data
}

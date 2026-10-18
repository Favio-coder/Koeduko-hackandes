import { auth } from '@/services/firebase'

export async function assessmentRequest(action, payload = {}) {
  const user = auth.currentUser
  if (!user) throw new Error('Inicia sesión para continuar.')
  if (action === 'save' || action === 'publish') invalidateBootstrap()
  const response = await fetch('/api/assessments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ action, payload }),
  })
  const data = await response.json().catch(() => { throw new Error('API no disponible. Usa el despliegue Vercel o vercel dev.') })
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.')
  return data
}

/**
 * Caché corta del `bootstrap`: es la lectura más pesada del módulo y se pide en
 * cada montaje de página y en cada regreso del editor. Se reutiliza durante
 * `BOOTSTRAP_TTL` y se invalida al guardar o publicar (las únicas acciones del
 * cliente que cambian el listado). `refresh` fuerza la lectura real.
 */
const BOOTSTRAP_TTL = 30000
let bootstrapCache = null

export function invalidateBootstrap() {
  bootstrapCache = null
}

export async function loadBootstrap({ refresh = false } = {}) {
  const uid = auth.currentUser?.uid
  const cached =
    !refresh &&
    bootstrapCache &&
    bootstrapCache.uid === uid &&
    Date.now() - bootstrapCache.at < BOOTSTRAP_TTL
      ? bootstrapCache.data
      : null
  if (cached) return cached
  const data = await assessmentRequest('bootstrap')
  bootstrapCache = { uid, at: Date.now(), data }
  return data
}

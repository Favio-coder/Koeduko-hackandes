import { useCallback, useEffect, useState } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/services/firebase'

/** Cuantas intervenciones del tutor se leen (las mas recientes). */
export const INTERVENTIONS_LIMIT = 20

const REAL_FIRESTORE = { db, doc, collection, query, orderBy, limit, onSnapshot }

const ERROR_MESSAGES = {
  'permission-denied': 'No tienes permiso para ver esta sesión.',
  unavailable: 'No hay conexión con los datos de la sesión. Revisa tu internet.',
  unauthenticated: 'Tu sesión venció. Vuelve a iniciar sesión.',
}

/** Mensaje legible para un error de Firestore; nunca el texto tecnico crudo. */
export const friendlyError = (error) =>
  ERROR_MESSAGES[error?.code] ?? 'No se pudieron cargar los datos de la sesión. Inténtalo de nuevo.'

const initial = (key) => ({ key, session: null, view: null, interventions: [], viewReady: false, interventionsReady: false, error: null })

/**
 * Datos de la sesion en vivo, con onSnapshot. Tres suscripciones baratas:
 *  - learningSessions/{id}                   la sesion (titulo, enlace, estado del bot). Puede no existir.
 *  - learningSessions/{id}/live/view         reparto de habla y transcripcion ya calculados por el
 *                                            servidor. Cambia ~cada 5 s (no con cada evento) para que cada
 *                                            espectador no consuma la cuota de lecturas de Firestore.
 *  - learningSessions/{id}/agentInterventions las 20 mas recientes del tutor.
 *
 * `deps` permite probar el hook sin Firebase.
 *
 * @returns {{ loading: boolean, error: string|null, session: object|null, view: object|null, interventions: object[], retry: () => void }}
 */
export function useLiveSession(sessionId, deps = REAL_FIRESTORE) {
  const [attempt, setAttempt] = useState(0)
  const key = `${sessionId}#${attempt}`
  const [snapshot, setSnapshot] = useState(() => initial(key))
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!sessionId) return undefined
    const patch = (changes) => setSnapshot((prev) => ({ ...(prev.key === key ? prev : initial(key)), ...changes }))
    const onError = (error) => patch({ error: friendlyError(error) })
    const base = ['learningSessions', sessionId]

    const stops = [
      deps.onSnapshot(
        deps.doc(deps.db, ...base),
        (snap) => patch({ session: snap.exists() ? { id: snap.id, ...snap.data() } : null }),
        onError,
      ),
      deps.onSnapshot(
        deps.doc(deps.db, ...base, 'live', 'view'),
        (snap) => patch({ view: snap.exists() ? snap.data() : null, viewReady: true }),
        onError,
      ),
      deps.onSnapshot(
        deps.query(deps.collection(deps.db, ...base, 'agentInterventions'), deps.orderBy('createdAt', 'desc'), deps.limit(INTERVENTIONS_LIMIT)),
        (snap) =>
          patch({
            interventions: snap.docs.map((d) => {
              const data = d.data()
              return { id: d.id, ...data, createdMs: data.createdAt?.toMillis?.() ?? null }
            }),
            interventionsReady: true,
          }),
        onError,
      ),
    ]

    return () => stops.forEach((stop) => stop())
  }, [sessionId, key, deps])

  // Los datos de otra sesion (o de un intento anterior) no se mezclan con los de esta.
  const current = snapshot.key === key ? snapshot : initial(key)
  return {
    loading: !current.error && !(current.viewReady && current.interventionsReady),
    error: current.error,
    session: current.session,
    view: current.view,
    interventions: current.interventions,
    retry,
  }
}

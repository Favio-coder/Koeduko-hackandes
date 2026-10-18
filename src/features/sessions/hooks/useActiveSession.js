import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'

const REAL_FIRESTORE = { db, collection, getDocs, query, where }

const ERROR_MESSAGES = {
  'permission-denied': 'No tienes permiso para ver tus sesiones.',
  unavailable: 'No hay conexión con los datos de las sesiones. Revisa tu internet.',
  unauthenticated: 'Tu sesión venció. Vuelve a iniciar sesión.',
}
const friendlyError = (error) => ERROR_MESSAGES[error?.code] ?? 'No se pudieron cargar tus sesiones. Inténtalo de nuevo.'

const createdMs = (session) => session.createdAt?.toMillis?.() ?? 0

/**
 * Elige la sesion "activa" de una lista. Pura.
 *  1. la que esta en vivo (la mas reciente si hay varias);
 *  2. si no, la proxima programada (la mas reciente);
 *  3. si no, la mas reciente que no este cancelada.
 *
 * @param {{ id: string, status?: string, createdAt?: { toMillis?: () => number } }[]} sessions
 * @returns {string|null} el id de la sesion, o null si no hay ninguna
 */
export function pickActiveSession(sessions) {
  const newestFirst = [...sessions].sort((a, b) => createdMs(b) - createdMs(a))
  const byStatus = (status) => newestFirst.find((session) => session.status === status)
  const chosen = byStatus('live') ?? byStatus('scheduled') ?? newestFirst.find((session) => session.status !== 'cancelled')
  return chosen?.id ?? null
}

/**
 * La sesion activa del usuario, leida de Firestore una sola vez.
 *  - Docente: solo sus sesiones, identificadas por createdBy.
 *  - Estudiante: solo aquellas donde su uid esta en studentIds (la consulta lo exige, igual que las reglas).
 *
 * @returns {{ loading: boolean, error: string|null, sessionId: string|null, retry: () => void }}
 */
export function useActiveSession(uid, isTeacher, deps = REAL_FIRESTORE) {
  const [attempt, setAttempt] = useState(0)
  const key = `${uid}|${isTeacher ? 't' : 's'}|${attempt}`
  const [result, setResult] = useState({ key: null, sessionId: null, error: null })
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!uid) return undefined
    let cancelled = false
    const sessions = deps.collection(deps.db, 'learningSessions')
    // Se ordena aquí para no exigir índices compuestos. No se recorta antes de elegir la activa.
    const request = deps.query(sessions, deps.where(isTeacher ? 'createdBy' : 'studentIds', isTeacher ? '==' : 'array-contains', uid))

    deps
      .getDocs(request)
      .then((snap) => {
        if (!cancelled) setResult({ key, sessionId: pickActiveSession(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), error: null })
      })
      .catch((error) => {
        if (!cancelled) setResult({ key, sessionId: null, error: friendlyError(error) })
      })
    return () => {
      cancelled = true
    }
  }, [uid, isTeacher, key, deps])

  const current = result.key === key ? result : { sessionId: null, error: null, pending: true }
  return { loading: !uid || current.pending === true, error: current.error, sessionId: current.sessionId, retry }
}

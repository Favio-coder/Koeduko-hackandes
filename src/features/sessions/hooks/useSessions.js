import { useCallback, useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/contexts/AuthContext'

const REAL_FIRESTORE = { db, collection, onSnapshot, query, where }
const timeOf = (value) => value?.toMillis?.() ?? (Date.parse(value) || 0)

/** Salas persistidas: el docente ve las suyas y el alumno solo aquellas donde figura su UID. */
export function useSessions(deps = REAL_FIRESTORE) {
  const { user, isTeacher } = useAuth()
  const uid = user?.uid
  const [attempt, setAttempt] = useState(0)
  const key = `${uid}|${isTeacher}|${attempt}`
  const [state, setState] = useState(null)
  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  useEffect(() => {
    if (!uid) return
    let active = true
    const request = deps.query(deps.collection(deps.db, 'learningSessions'),
      deps.where(isTeacher ? 'createdBy' : 'studentIds', isTeacher ? '==' : 'array-contains', uid))
    const stop = deps.onSnapshot(request, (snapshot) => {
      if (!active) return
      const sessions = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
        .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt))
      setState({ key, sessions, error: null })
    }, () => {
      if (active) setState({ key, sessions: [], error: 'No se pudieron cargar tus salas. Revisa tu conexión y permisos.' })
    })
    return () => { active = false; stop() }
  }, [uid, isTeacher, key, deps])
  const current = state?.key === key ? state : null
  return { sessions: current?.sessions ?? [], loading: Boolean(uid) && !current, error: current?.error ?? null, reload }
}

export function useSession(sessionId) {
  const { sessions, loading, error, reload } = useSessions()
  return { session: sessions.find((session) => session.id === sessionId) ?? null, loading, error, reload }
}

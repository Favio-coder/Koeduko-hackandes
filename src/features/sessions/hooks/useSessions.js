import { useCallback, useState } from 'react'
import { SESSION_STATUS } from '@/shared/constants/contracts'

/**
 * Hook de arranque en memoria. El desarrollador 3 debe reemplazarlo por
 * lecturas/escrituras reales en `learningSessions` (ver docs/API_CONTRACTS.md).
 */
const SEED = [
  {
    id: 'demo-session-1',
    title: 'Pareja Ana Torres - Luis Rojas',
    pairId: 'pair-demo-1',
    meetingUrl: null,
    status: SESSION_STATUS.SCHEDULED,
    scheduledAt: null,
  },
]

export function useSessions() {
  const [sessions, setSessions] = useState(SEED)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSessions(SEED)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const createSession = useCallback(async () => {
    const next = {
      id: `demo-session-${sessions.length + 1}`,
      title: 'Pareja Mia Quispe - Diego Huaman',
      pairId: 'pair-demo-2',
      meetingUrl: null,
      status: SESSION_STATUS.SCHEDULED,
      scheduledAt: null,
    }
    setSessions((prev) => [...prev, next])
    return next
  }, [sessions.length])

  return { sessions, loading, error, reload, createSession }
}

export function useSession(sessionId) {
  const { sessions, loading, error, reload } = useSessions()
  const session = sessions.find((s) => s.id === sessionId) || null
  return { session, loading, error, reload }
}
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase'

const REAL_FIRESTORE = { db, doc, onSnapshot }

/**
 * El reporte de cierre de la sesion: learningSessions/{id}/summary/final. Una sola lectura por cambio
 * (el documento se escribe una vez, al cerrar). Solo el docente puede leerlo (reglas de Firestore):
 * con `enabled: false` no se suscribe y no cuesta nada.
 *
 * @returns {{ summary: object|null, ready: boolean }}  `ready` es false hasta que Firestore contesta.
 *   Un error (sin permiso, sin red) deja el resumen en null: la pagina sigue funcionando sin reporte.
 */
export function useSessionSummary(sessionId, { enabled = true } = {}, deps = REAL_FIRESTORE) {
  const [state, setState] = useState({ key: null, summary: null, ready: false })
  const key = `${sessionId}`

  useEffect(() => {
    if (!sessionId || !enabled) return undefined
    return deps.onSnapshot(
      deps.doc(deps.db, 'learningSessions', sessionId, 'summary', 'final'),
      (snap) => setState({ key, summary: snap.exists() ? snap.data() : null, ready: true }),
      () => setState({ key, summary: null, ready: true }),
    )
  }, [sessionId, enabled, key, deps])

  if (!enabled || !sessionId) return { summary: null, ready: true }
  return state.key === key ? { summary: state.summary, ready: state.ready } : { summary: null, ready: false }
}

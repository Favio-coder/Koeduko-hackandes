/**
 * useStudentProgress — datos reales del panel del estudiante.
 *
 * Tres lecturas independientes, en paralelo y con fallos aislados: que el
 * historial de notas no cargue no puede dejar el panel en blanco.
 *
 * - `bootstrap`  → evaluaciones asignadas (la API filtra por rol).
 * - `grades`     → historial de calificaciones del propio estudiante.
 * - `knowledgeProfiles/{uid}` → dominio por destreza (las reglas permiten leer
 *   el perfil propio).
 *
 * Si ninguna lectura responde se marca `demo`, y la vista usa los datos
 * ficticios de `shared/lib/demoData` declarándolo en pantalla, en vez de
 * mostrar un progreso inventado como si fuera real.
 */
import { useCallback, useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { assessmentRequest, loadBootstrap } from '@/features/assessments/services/assessmentService'
import { db } from '@/services/firebase'

/** Última sala conocida del estudiante mientras el módulo de sesiones no migra. */
export const DEMO_SESSIONS = [
  {
    id: 'demo-session-1',
    title: 'Pareja asignada - Ana y Luis',
    status: 'scheduled',
    meetingUrl: null,
  },
]

/**
 * Ejecuta una lectura a prueba de fallos: ni un rechazo ni un error síncrono
 * (un módulo mal mockeado, por ejemplo) pueden tumbar el panel completo.
 * `null` distingue «la lectura falló» de «la lectura respondió vacío».
 */
const settle = (read, fallback) =>
  Promise.resolve()
    .then(read)
    .then((value) => value ?? fallback, () => fallback)

const IDLE = {
  status: 'demo',
  error: null,
  skills: null,
  records: [],
  assessments: [],
  sessions: DEMO_SESSIONS,
}

export function useStudentProgress(uid) {
  const [result, setResult] = useState(null)
  const [revision, setRevision] = useState(0)

  const reload = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    if (!uid) return undefined
    let active = true

    Promise.all([
      settle(() => loadBootstrap({ refresh: true }).then((data) => data?.assessments ?? []), null),
      settle(() => assessmentRequest('grades').then((data) => data?.records ?? []), null),
      settle(
        () =>
          getDoc(doc(db, 'knowledgeProfiles', uid)).then((snap) =>
            snap.exists() ? snap.data()?.skills ?? null : null,
          ),
        null,
      ),
    ]).then(([assessments, records, skills]) => {
      if (!active) return
      setResult({ uid, revision, skills, records, assessments })
    })

    return () => {
      active = false
    }
  }, [uid, revision])

  /* Sin sesión no hay nada que pedir: se resuelve en render para no disparar un
     setState dentro del efecto. */
  if (!uid) return { ...IDLE, reload }

  const current = result?.uid === uid && result?.revision === revision ? result : null
  if (!current) return { ...IDLE, status: 'loading', reload }

  const online = current.skills !== null || current.records !== null || current.assessments !== null

  return {
    status: online ? 'ready' : 'demo',
    error: null,
    skills: current.skills,
    records: current.records ?? [],
    assessments: current.assessments ?? [],
    sessions: DEMO_SESSIONS,
    reload,
  }
}

export default useStudentProgress

import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadBootstrap } from '@/features/assessments/services/assessmentService'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase'
import StudentsDirectory from '../components/StudentsDirectory'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 1 (feature/auth-dashboard)
 *
 * Ruta real: `/students` (registrada en `src/app/router.jsx`, solo rol docente).
 *
 * Los estudiantes ya no son ficticios: el roster sale de la API autorizada
 * (`action: 'bootstrap'`), que devuelve únicamente los cursos del docente y los
 * alumnos de cada curso. El progreso por destreza se completa con
 * `knowledgeProfiles`, que es donde el módulo de evaluaciones publica el
 * diagnóstico. Si un estudiante todavía no tiene perfil, se muestra como
 * pendiente en vez de inventar un valor.
 *
 * Qué falta implementar aquí (no se hace desde el diseño):
 * - Alta / edición / baja de estudiante (CRUD) con confirmación en `Modal`.
 * - Enlace al perfil del estudiante (tarea 1.7).
 * - Paginación o búsqueda cuando el aula supere ~30 estudiantes.
 *
 * Contrato de datos: ver `docs/FIRESTORE_SCHEMA.md`.
 * La autoridad la validan las Firestore Security Rules, no el frontend.
 */

/**
 * Roster real: cursos del docente + perfiles de conocimientos si existen.
 * El acceso privileged lo resuelve la API; las reglas permiten al docente
 * leer `knowledgeProfiles`. Firebase v13 no expone métodos en la instancia,
 * por eso se usa la API modular (`collection` + `getDocs`).
 */
async function loadRoster() {
  const [bootstrap, profiles] = await Promise.all([
    loadBootstrap(),
    getDocs(collection(db, 'knowledgeProfiles')).catch(() => null),
  ])
  const skillsByStudent = new Map()
  profiles?.docs.forEach((doc) => {
    const data = doc.data()
    const studentId = data.studentId || doc.id
    if (studentId) skillsByStudent.set(studentId, data.skills || {})
  })
  return (bootstrap.courses || [])
    .filter((course) => course.students?.length)
    .map((course) => ({
      id: course.id,
      name: course.name,
      students: course.students.map((student) => ({
        id: student.id,
        displayName: student.name || student.id,
        skills: skillsByStudent.get(student.id) || null,
      })),
    }))
}

export default function StudentsPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCourses(await loadRoster())
    } catch (failure) {
      setError(failure)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadRoster().then(
      (data) => {
        if (cancelled) return
        setCourses(data)
        setLoading(false)
      },
      (failure) => {
        if (cancelled) return
        setError(failure)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const total = useMemo(
    () => courses.reduce((count, course) => count + course.students.length, 0),
    [courses],
  )

  return <StudentsDirectory courses={courses} total={total} loading={loading} error={error} onRetry={load} />
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ProgressBar,
} from '@/components/ui'
//import Alert from '@/components/ui/Alert'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { assessmentRequest } from '@/features/assessments/services/assessmentService'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { MATH_SKILLS } from '@/shared/constants/contracts'

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
    assessmentRequest('bootstrap'),
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Docencia"
        title="Estudiantes"
        description="Listado de estudiantes del aula con su perfil de conocimientos."
        badge={<Badge tone="brand">{loading ? 'Cargando…' : `${total} estudiantes`}</Badge>}
        actions={
          <>
            <Button to="/assessments" variant="secondary" icon="clipboard" className="w-full sm:w-auto">
              Diagnóstico
            </Button>
            {/* <Button icon="plus" className="w-full sm:w-auto">
              Nuevo estudiante
            </Button> */}
          </>
        }
      />

      {/* <Alert tone="info" title="Datos reales de Firebase">
        El listado se arma con los cursos y estudiantes que tienes autorizados en
        <code className="mx-1 rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">assessmentCourseAccess</code>
        y con los diagnósticos publicados en
        <code className="mx-1 rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">knowledgeProfiles</code>
        . El alta, la edición y la baja de estudiantes todavía no están implementadas.
      </Alert> */}

      {loading && <LoadingState label="Cargando estudiantes…" inline compact />}

      {!loading && error && (
        <ErrorState error={error} onRetry={load} title="No se pudieron cargar los estudiantes" />
      )}

      {!loading && !error && total === 0 && (
        <EmptyState
          title="Todavía no hay estudiantes en tus cursos"
          description="Cuando te asignen cursos con estudiantes en Firebase, aparecerán aquí con su diagnóstico."
          action={
            <Button to="/assessments" variant="secondary" icon="clipboard">
              Ir a evaluaciones
            </Button>
          }
        />
      )}

      {!loading &&
        !error &&
        courses.map((course) => (
          <Card
            key={course.id}
            title={course.name}
            description={`${course.students.length} estudiantes`}
            padding="sm"
          >
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {course.students.map((student) => (
                <li
                  key={`${course.id}-${student.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[#E6EAE3] bg-white p-4 transition-[border-color,box-shadow] duration-200 ease-out hover:border-[#B7E8B5] hover:shadow-[0_12px_32px_rgba(48,71,68,0.12)]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={student.displayName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#304744]">
                        {student.displayName}
                      </p>
                      {/* ID largo: se recorta en vez de desbordar */}
                      <p className="truncate font-mono text-xs text-[#7D8C8A]">{student.id}</p>
                    </div>
                  </div>

                  {student.skills ? (
                    <div className="space-y-2.5 border-t border-[#E6EAE3] pt-3">
                      {MATH_SKILLS.map((skill) => (
                        <ProgressBar
                          key={skill.id}
                          size="sm"
                          label={skill.label}
                          value={student.skills[skill.id] ?? 0}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="border-t border-[#E6EAE3] pt-3 text-xs text-[#7D8C8A]">
                      Sin diagnóstico publicado todavía.
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[#E6EAE3] pt-3">
                    <Button to="/sessions" variant="ghost" size="sm" icon="video">
                      Sus salas
                    </Button>
                    {/* <Button variant="secondary" size="sm" icon="edit" className="ml-auto">
                      Editar
                    </Button> */}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {!loading && !error && total > 0 && (
        <p className="flex items-center gap-2 text-xs text-[#7D8C8A]">
          <Icon name="info" className="h-4 w-4 shrink-0" />
          Los botones «Nuevo estudiante» y «Editar» son visuales: aún no ejecutan ninguna acción.
        </p>
      )}
    </div>
  )
}
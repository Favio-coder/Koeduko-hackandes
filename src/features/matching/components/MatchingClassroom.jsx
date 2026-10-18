import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { loadBootstrap } from '@/features/assessments/services/assessmentService'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { COMPETENCY_ID } from '@/shared/constants/contracts'
import { fetchMatchingProfile } from '../services/assessmentProfileService'
import { normalizeAssessmentResults } from '../services/normalizeAssessmentResults'

/** Mismo roster autorizado que Estudiantes; los puntajes proceden de una única evaluación. */
export default function MatchingClassroom({ children }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [params, setParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const [catalog, setCatalog] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let active = true
    if (!uid) return
    loadBootstrap({ refresh: true }).then(
      (data) => { if (active) setCatalog({ uid, revision, data }) },
      (error) => { if (active) setCatalog({ uid, revision, error }) },
    )
    return () => { active = false }
  }, [uid, revision])

  const current = catalog?.uid === uid && catalog?.revision === revision ? catalog : null
  const courses = current?.data?.courses ?? []
  const courseId = params.get('courseId') ?? courses[0]?.id
  const course = courses.find(({ id }) => id === courseId)
  const assessments = (current?.data?.assessments ?? []).filter((item) =>
    item.courseId === courseId && item.status === 'finalized' &&
    item.competencyId === COMPETENCY_ID.RESOLVE_QUANTITY_PROBLEMS)
  const assessmentId = params.get('assessmentId') ?? ''
  const assessment = assessments.find(({ id }) => id === assessmentId)
  const scopeKey = JSON.stringify({ ownerId: uid, courseId, assessmentId })
  const scope = { ownerId: uid, courseId, assessmentId }

  useEffect(() => {
    let active = true
    if (!uid || !course || !assessment) return
    fetchMatchingProfile(assessment.id, course.id).then((data) => {
      if (!active) return
      if (data.courseId !== course.id || data.assessmentId !== assessment.id) throw new Error('Los resultados no corresponden al curso y evaluación seleccionados.')
      normalizeAssessmentResults(data)
      const roster = new Map((course.students ?? []).map((student) => [student.id, student.name || student.id]))
      if (data.students.some((student) => !roster.has(student.studentId))) throw new Error('La evaluación contiene estudiantes que no pertenecen al listado actual del curso.')
      setProfile({ key: scopeKey, revision, data: {
        ...data,
        students: data.students.map((student) => ({ ...student, displayName: roster.get(student.studentId) })),
      } })
    }).catch((error) => { if (active) setProfile({ key: scopeKey, revision, error }) })
    return () => { active = false }
  }, [uid, course, assessment, scopeKey, revision])

  const loaded = profile?.key === scopeKey && profile?.revision === revision ? profile : null
  const changeCourse = (event) => setParams({ courseId: event.target.value })
  const changeAssessment = (event) => setParams({ courseId, assessmentId: event.target.value })
  const retry = () => setRevision((value) => value + 1)

  if (!uid) return <ErrorState error="Inicia sesión con una cuenta docente para cargar tus estudiantes." />
  if (!current) return <LoadingState label="Cargando cursos y estudiantes…" />
  if (current.error) return <ErrorState error={current.error} onRetry={retry} />
  if (!courses.length) return <EmptyState title="No hay cursos asignados" description="Los cursos y estudiantes autorizados aparecerán aquí cuando estén disponibles." />

  return <div className="space-y-6">
    <Card title="Curso y evaluación" actions={<Button variant="secondary" onClick={retry}>Actualizar datos</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-[#304744]">Curso
          <select value={courseId ?? ''} onChange={changeCourse} className="block w-full rounded-xl border border-[#ABB1AB] bg-white p-3">
            {!course && <option value={courseId ?? ''}>Curso no disponible</option>}
            {courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-[#304744]">Evaluación finalizada
          <select value={assessmentId ?? ''} onChange={changeAssessment} disabled={!assessments.length} className="block w-full rounded-xl border border-[#ABB1AB] bg-white p-3 disabled:opacity-50">
            <option value="">Selecciona una evaluación finalizada</option>
            {assessments.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.id}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#5A6B6A]">
        <span>{course?.students?.length ?? 0} estudiantes en el curso{loaded?.data ? ' · ' + loaded.data.students.length + ' con resultados en esta evaluación' : ''}.</span>
        <Button to="/students" variant="ghost" size="sm">Ver estudiantes del curso</Button>
      </div>
    </Card>
    {!course ? <ErrorState error="No tienes acceso al curso seleccionado." />
      : !assessment ? <EmptyState title="No hay una evaluación finalizada seleccionada" description="Selecciona solo la evaluación que usarás para formar grupos. Los alumnos asignados deben haberla enviado y tener sus correcciones completas; no necesitan resolver las demás pruebas." action={<Button to="/assessments">Ir a evaluaciones</Button>} />
      : !loaded ? <LoadingState label="Preparando perfiles de la evaluación…" />
      : loaded.error ? <ErrorState error={loaded.error} onRetry={retry} />
      : children({ data: loaded.data, scope })}
  </div>
}

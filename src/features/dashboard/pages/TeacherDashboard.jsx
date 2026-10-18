import { Link } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, LoadingAnimation, LoadingState } from '@/components/ui'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import { loadBootstrap } from '@/features/assessments/services/assessmentService'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'

/** Tarjeta de métrica: cifra grande + etiqueta + icono. */
function StatCard({ label, value, icon, hint }) {
  return (
    <Card padding="md" className="flex items-start gap-3.5">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E9F8EA] text-[#2A7A35]">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6B6A]">{label}</p>
        <output aria-label={label} className="mt-0.5 block text-2xl font-bold tabular-nums text-[#304744]">{value}</output>
        {hint && <p className="mt-0.5 text-xs text-[#7D8C8A]">{hint}</p>}
      </div>
    </Card>
  )
}

/**
 * Acceso rápido: tarjeta ilustrada que lleva al inicio de cada módulo.
 *
 * La ilustración es decorativa (`alt` vacío) y el enlace lleva `aria-label`
 * con la acción, para no duplicar la lectura del texto.
 */
function QuickAction({ to, label, hint, img, icon }) {
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  return (
    <Link
      to={to}
      aria-label={label}
      className={[
        'group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E6EAE3] bg-white',
        'transition-[box-shadow,border-color,transform] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none',
        'hover:-translate-y-1 hover:border-[#B7E8B5] hover:shadow-[0_12px_32px_rgba(48,71,68,0.14)]',
        'active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/55 focus-visible:ring-offset-2',
      ].join(' ')}
    >
      {/* El ligero zoom recorta el borde oscuro incluido en los PNG sin editar los originales. */}
      <div className="relative aspect-[1.94/1] w-full overflow-hidden bg-[#F8FAF6]">
        {imageLoading && !imageError && (
          <LoadingAnimation className="absolute inset-0 m-auto h-20 w-20" />
        )}
        {imageError ? (
          <div
            role="img"
            aria-label={`${label}: ilustración no disponible`}
            className="flex h-full flex-col items-center justify-center gap-2 text-[#7D8C8A]"
          >
            <Icon name={icon} className="h-8 w-8" />
            <span className="text-xs font-medium">Ilustración no disponible</span>
          </div>
        ) : (
          <img
            src={img}
            alt=""
            width={622}
            height={320}
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true)
              setImageLoading(false)
            }}
            className="block h-full w-full scale-[1.04] object-cover transition-transform duration-300 ease-out group-hover:scale-[1.07] motion-reduce:transform-none motion-reduce:transition-none"
          />
        )}
      </div>

      <div className="flex min-h-19 items-center gap-3 border-t border-[#E6EAE3] px-3.5 py-3 sm:px-4">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F8EA] text-[#2A7A35] transition-[background-color,color,transform] duration-200 group-hover:scale-105 group-hover:bg-[#4CDB59] group-hover:text-[#263D48] group-active:scale-95 motion-reduce:transform-none motion-reduce:transition-none">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold leading-snug text-[#304744]">
            {label}
            <Icon
              name="chevronRight"
              className="h-4 w-4 shrink-0 text-[#7D8C8A] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
            />
          </p>
          <p className="mt-1 text-xs leading-snug text-[#5A6B6A] sm:text-[13px]">{hint}</p>
        </div>
      </div>
    </Link>
  )
}

export default function TeacherDashboard() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const firstName = (profile?.displayName || 'docente').split(' ')[0]
  const [roster, setRoster] = useState(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    if (!uid) return
    loadBootstrap({ refresh: true }).then(
      (data) => { if (active) setRoster({ uid, revision, data }) },
      (error) => { if (active) setRoster({ uid, revision, error }) },
    )
    return () => { active = false }
  }, [uid, revision])

  const current = roster?.uid === uid && roster?.revision === revision ? roster : null
  const courses = current?.data?.courses ?? []
  const studentsById = new Map()
  for (const course of courses) {
    for (const student of course.students ?? []) {
      const existing = studentsById.get(student.id)
      if (existing) existing.courses.push(course.name)
      else studentsById.set(student.id, { ...student, courses: [course.name] })
    }
  }
  const students = [...studentsById.values()]
  const loaded = Boolean(current?.data)
  const retry = () => setRevision((value) => value + 1)
  const stats = [
    { label: 'Estudiantes', value: loaded ? students.length : '—', icon: 'users', hint: 'Alumnos únicos de tus cursos' },
    { label: 'Cursos', value: loaded ? courses.length : '—', icon: 'clipboard', hint: 'Asignados a tu cuenta' },
    { label: 'Evaluaciones', value: loaded ? (current.data.assessments ?? []).length : '—', icon: 'clipboard', hint: 'Disponibles para gestionar' },
  ]

  const shortcuts = [
    {
      to: '/assessments',
      label: 'Diagnosticar estudiantes',
      hint: 'Aplica el diagnóstico inicial del curso.',
      img: '/botones/diagnosticar-card.png',
      icon: 'clipboard',
    },
    {
      to: '/matching',
      label: 'Formar parejas',
      hint: 'Empareja por conocimientos complementarios.',
      img: '/botones/emparejar-card.png',
      icon: 'sparkles',
    },
    {
      to: '/sessions',
      label: 'Gestionar salas',
      hint: 'Crea salas y acompaña las reuniones.',
      img: '/botones/gestionarsalas-card.png',
      icon: 'video',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <header className="flex flex-col gap-4 rounded-2xl border border-[#E6EAE3] bg-white p-4 shadow-[0_1px_3px_rgba(48,71,68,0.08)] sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-center gap-4">
          <Avatar name={profile?.displayName || 'Docente'} size="md" />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight text-[#304744] sm:text-2xl">
              ¡Hola, {firstName}! 
            </h2>
            <p className="mt-1 text-sm text-[#5A6B6A]">
              Gestiona tus estudiantes y acompaña su aprendizaje.
            </p>
          </div>
        </div>

      </header>

      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Accesos rápidos */}
      <Card title="Accesos rápidos" description="Puntos de entrada al flujo principal del MVP.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((s) => (
            <QuickAction key={s.to} {...s} />
          ))}
        </div>
      </Card>

      <Card
        title="Estudiantes registrados"
        description="Listado real de tus cursos, sin contar dos veces al mismo alumno."
        padding="sm"
        actions={<>
          <Button onClick={retry} variant="secondary" size="sm">Actualizar estudiantes</Button>
          <Button to="/students" variant="ghost" size="sm">Ver estudiantes</Button>
        </>}
      >
        {!uid && <ErrorState error="Inicia sesión para consultar tus estudiantes." />}
        {uid && !current && <LoadingState label="Cargando estudiantes…" />}
        {current?.error && <ErrorState error={current.error} onRetry={retry} />}
        {loaded && students.length === 0 && <EmptyState title="No hay estudiantes asignados" description="Los alumnos aparecerán cuando estén registrados en tus cursos." />}
        {loaded && students.length > 0 && <ul aria-label="Estudiantes registrados" className="divide-y divide-[#E6EAE3]">
          {students.map((student) => (
            <li key={student.id} className="flex min-w-0 items-center gap-3 py-3">
              <Avatar name={student.name || student.id} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#304744]">{student.name || student.id}</p>
                <p className="truncate text-xs text-[#7D8C8A]">{student.courses.join(' · ')}</p>
              </div>
            </li>
          ))}
        </ul>}
      </Card>

    </div>
  )
}

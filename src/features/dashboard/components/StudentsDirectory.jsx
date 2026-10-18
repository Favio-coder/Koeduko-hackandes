import { Badge, Button, EmptyState, ErrorState, Icon, LoadingState, ProgressBar } from '@/components/ui'
import Avatar from '@/components/ui/Avatar'
import { MATH_SKILLS } from '@/shared/constants/contracts'

const studentCount = (count) => count + (count === 1 ? ' estudiante' : ' estudiantes')

/** Vista del directorio. La carga, los permisos y las operaciones viven en StudentsPage. */
export default function StudentsDirectory({ courses, total, loading, error, onRetry }) {
  const ready = !loading && !error
  const withProfile = courses.reduce((count, course) => count + course.students.filter((student) => student.skills).length, 0)
  const metrics = [
    { label: 'Estudiantes', value: total, icon: 'users', hint: 'Registrados en tus cursos' },
    { label: 'Cursos', value: courses.length, icon: 'clipboard', hint: 'Con estudiantes asignados' },
    { label: 'Con perfil', value: withProfile, icon: 'chart', hint: 'Perfil de conocimientos disponible' },
  ]
  return <div className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl border border-[#D8E8D5] bg-[#E9F8EA] p-6 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-52 w-52 rounded-full border-[28px] border-[#DDF0D9] opacity-60" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#2A7A35]"><Icon name="users" className="h-4 w-4" />Estudiantes · Espacio docente</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-[#304744]">Estudiantes</h1>
            <Badge tone="brand">{loading ? 'Cargando…' : error ? 'Carga pendiente' : studentCount(total)}</Badge>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5A6B6A]">Conoce a tu aula, revisa sus habilidades y encuentra sus salas de aprendizaje.</p>
        </div>
        <Button to="/assessments" variant="secondary" icon="clipboard" className="w-full shrink-0 sm:w-auto">Diagnóstico</Button>
      </div>
    </header>

    <dl aria-label="Resumen de estudiantes" className="grid grid-cols-3 gap-2 sm:gap-3">
      {metrics.map((metric) => <div key={metric.label} className="flex items-start gap-3 rounded-2xl border border-[#E6EAE3] bg-white p-3 sm:p-5">
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E9F8EA] text-[#2A7A35] md:grid"><Icon name={metric.icon} className="h-4 w-4" /></span>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold text-[#5A6B6A] sm:text-xs">{metric.label}</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight text-[#304744] tabular-nums">{ready ? metric.value : '—'}</dd>
          <p className="mt-1 hidden text-[11px] leading-relaxed text-[#7D8C8A] sm:block">{metric.hint}</p>
        </div>
      </div>)}
    </dl>

    {loading && <LoadingState label="Cargando estudiantes…" inline compact />}
    {!loading && error && <ErrorState error={error} onRetry={onRetry} title="No se pudieron cargar los estudiantes" />}
    {ready && total === 0 && <div className="rounded-3xl border border-dashed border-[#D8E8D5] bg-white p-6">
      <EmptyState title="Todavía no hay estudiantes en tus cursos" description="Cuando te asignen cursos con estudiantes en Firebase, aparecerán aquí con su diagnóstico."
        action={<Button to="/assessments" variant="secondary" icon="clipboard">Ir a evaluaciones</Button>} />
    </div>}

    {ready && courses.map((course) => <section key={course.id} aria-labelledby={'course-' + course.id} className="space-y-4">
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-[#E6EAE3] bg-white px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F0F5ED] text-[#304744]"><Icon name="clipboard" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7D8C8A]">Tu curso</p>
            <h2 id={'course-' + course.id} className="break-words text-base font-bold tracking-tight text-[#304744]">{course.name}</h2>
          </div>
        </div>
        <Badge tone="neutral" className="shrink-0">{studentCount(course.students.length)}</Badge>
      </header>
      <ul className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={'Estudiantes de ' + course.name}>
        {course.students.map((student) => <li key={course.id + '-' + student.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E6EAE3] bg-white shadow-[0_1px_3px_rgba(48,71,68,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[#B7E8B5] hover:shadow-[0_8px_24px_rgba(48,71,68,0.07)]">
          <div className="flex-1 space-y-5 p-5">
            <div className="flex items-center justify-between gap-3">
              <Avatar name={student.displayName} size="md" />
              <Badge tone={student.skills ? 'brand' : 'neutral'} dot>{student.skills ? 'Con perfil' : 'Sin diagnóstico'}</Badge>
            </div>
            <div className="min-w-0">
              <h3 className="break-words text-base font-bold leading-snug text-[#304744]">{student.displayName}</h3>
              <p title={student.id} className="mt-1.5 truncate font-mono text-[11px] text-[#7D8C8A]">{student.id}</p>
            </div>
            {student.skills ? <div className="space-y-2.5 rounded-xl bg-[#F8FAF6] p-3.5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B6A]">Perfil de conocimientos</p>
              {MATH_SKILLS.map((skill) => <ProgressBar key={skill.id} size="sm" label={skill.label} value={student.skills[skill.id] ?? 0} />)}
            </div> : <div className="flex min-h-28 items-start gap-3 rounded-xl bg-[#F8FAF6] p-4">
              <span className="mt-0.5 text-[#7D8C8A]"><Icon name="clipboard" className="h-4 w-4" /></span>
              <p className="text-xs leading-relaxed text-[#7D8C8A]">Sin diagnóstico publicado todavía.</p>
            </div>}
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-[#E6EAE3] px-5 py-3">
            <span className="text-xs text-[#7D8C8A]">Aprendizaje en grupo</span>
            <Button to={'/sessions?' + new URLSearchParams({ courseId: course.id, studentId: student.id })} variant="subtle" size="sm" icon="video">Sus salas</Button>
          </footer>
        </li>)}
      </ul>
    </section>)}
  </div>
}

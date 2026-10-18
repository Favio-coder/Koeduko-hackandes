import { Alert, Badge, Button, Card, Icon } from '@/components/ui'
import { Select } from '@/components/ui/Field'
import { statusLabels, typeOptions } from '../utils/forms'

const STATES = {
  draft: { tone: 'warning', icon: 'edit', accent: 'bg-[#FFF5DA] text-[#8A631D]' },
  published: { tone: 'brand', icon: 'clipboard', accent: 'bg-[#E9F8EA] text-[#2A7A35]' },
  closed: { tone: 'neutral', icon: 'calendar', accent: 'bg-[#F0F3EF] text-[#5A6B6A]' },
  finalized: { tone: 'forest', icon: 'check', accent: 'bg-[#304744] text-white' },
}

export function TeacherCourseHeader() {
  return <header className="relative overflow-hidden rounded-3xl border border-[#D8E8D5] bg-[#E9F8EA] p-6 sm:p-8">
    <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-52 w-52 rounded-full border-[28px] border-[#DDF0D9] opacity-60" />
    <div className="relative">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#2A7A35]"><Icon name="clipboard" className="h-4 w-4" />Curso · Espacio docente</p>
      <h1 className="text-3xl font-bold tracking-tight text-[#304744]">Evaluaciones</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5A6B6A]">Diseña evaluaciones y descubre la evidencia de aprendizaje de tu curso.</p>
    </div>
  </header>
}

/** Presentación del listado docente. Las operaciones permanecen en AssessmentsPage. */
export default function TeacherCourseOverview({ data, filter, onFilterChange, busy, onCreate, onRefresh, onOpen }) {
  const visible = data.assessments.filter((assessment) => !filter || assessment.id === filter)
  const metrics = [
    { label: 'Evaluaciones', value: data.assessments.length, icon: 'clipboard', caption: 'En tus cursos' },
    { label: 'Borradores', value: data.assessments.filter((item) => item.status === 'draft').length, icon: 'edit', caption: 'En preparación' },
    { label: 'Publicadas', value: data.assessments.filter((item) => item.status === 'published').length, icon: 'calendar', caption: 'Con estado publicado' },
    { label: 'Finalizadas', value: data.assessments.filter((item) => item.status === 'finalized').length, icon: 'check', caption: 'Con corrección completa' },
  ]

  return <div className="space-y-6">
    <dl aria-label="Resumen de evaluaciones" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {metrics.map((metric) => <div key={metric.label} className="flex items-start gap-3 rounded-2xl border border-[#E6EAE3] bg-white p-4 sm:p-5">
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F8EA] text-[#2A7A35] sm:inline-flex">
          <Icon name={metric.icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <dt className="text-xs font-semibold text-[#5A6B6A]">{metric.label}</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight text-[#304744] tabular-nums">{metric.value}</dd>
          <p className="mt-1 text-[11px] text-[#7D8C8A]">{metric.caption}</p>
        </div>
      </div>)}
    </dl>

    <section aria-label="Herramientas de evaluación" className="rounded-2xl border border-[#E6EAE3] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Select label="Filtrar por evaluación" value={filter} onChange={onFilterChange} options={[
            { value: '', label: 'Todas las evaluaciones' },
            ...data.assessments.map((assessment) => ({ value: assessment.id, label: assessment.title })),
          ]} />
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="secondary" icon="refresh" disabled={busy} onClick={onRefresh}>Actualizar</Button>
          <Button icon="plus" disabled={!data.courses.length || busy} onClick={onCreate}>Crear evaluación</Button>
        </div>
      </div>
    </section>

    {!data.courses.length && <Alert tone="info" title="Sin cursos autorizados">
      Un administrador debe habilitar tu curso y su matrícula en el módulo de evaluaciones.
    </Alert>}

    <section aria-labelledby="teacher-assessments-title" className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="teacher-assessments-title" className="text-lg font-bold tracking-tight text-[#304744]">Tus evaluaciones</h2>
        <span className="text-xs font-medium text-[#5A6B6A]">{visible.length} {visible.length === 1 ? 'evaluación' : 'evaluaciones'}</span>
      </div>
      {!data.assessments.length && <Card className="border-dashed" padding="lg">
        <div className="mx-auto flex max-w-sm flex-col items-center py-6 text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#E9F8EA] text-[#2A7A35]"><Icon name="clipboard" className="h-6 w-6" /></span>
          <h3 className="text-lg font-bold text-[#304744]">Aún no hay evaluaciones</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#5A6B6A]">Crea tu primera evaluación con preguntas y estudiantes reales.</p>
        </div>
      </Card>}
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {visible.map((assessment) => {
          const status = STATES[assessment.status] || STATES.closed
          const course = data.courses.find((item) => item.id === assessment.courseId)
          const type = typeOptions.find((item) => item.value === assessment.type)?.label
          return <article key={assessment.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E6EAE3] bg-white shadow-[0_1px_3px_rgba(48,71,68,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[#B7E8B5] hover:shadow-[0_8px_24px_rgba(48,71,68,0.07)]">
            <div className="flex-1 space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className={'grid h-10 w-10 shrink-0 place-items-center rounded-xl ' + status.accent}><Icon name={status.icon} className="h-5 w-5" /></span>
                <Badge tone={status.tone} dot>{statusLabels[assessment.status] || assessment.status}</Badge>
              </div>
              <div>
                {type && <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7D8C8A]">{type}</p>}
                <h3 className="break-words text-lg font-bold leading-snug tracking-tight text-[#304744]">{assessment.title}</h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#5A6B6A]"><Icon name="clipboard" className="h-4 w-4 shrink-0 text-[#7D8C8A]" /><span className="min-w-0 break-words">{course?.name}</span></p>
              </div>
              <dl className="flex flex-wrap gap-x-5 gap-y-3 rounded-xl bg-[#F8FAF6] p-3 text-xs">
                {Array.isArray(assessment.studentIds) && <div><dt className="text-[#7D8C8A]">Asignados</dt><dd className="mt-1 font-semibold text-[#304744]">{assessment.studentIds.length} estudiantes</dd></div>}
                {assessment.durationMinutes !== undefined && <div><dt className="text-[#7D8C8A]">Duración</dt><dd className="mt-1 font-semibold text-[#304744]">{assessment.durationMinutes ? assessment.durationMinutes + ' min' : 'Hasta el cierre'}</dd></div>}
                {assessment.maxScore !== undefined && <div><dt className="text-[#7D8C8A]">Puntaje máximo</dt><dd className="mt-1 font-semibold text-[#304744]">{assessment.maxScore} puntos</dd></div>}
              </dl>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6EAE3] px-5 py-4 sm:px-6">
              <p className="flex min-w-0 items-start gap-2 text-xs text-[#5A6B6A]"><Icon name="calendar" className="h-4 w-4 shrink-0 text-[#7D8C8A]" /><span><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#7D8C8A]">Cierre:</span>{new Date(assessment.endsAt).toLocaleString()}</span></p>
              <Button variant={assessment.status === 'draft' ? 'secondary' : 'subtle'} icon={assessment.status === 'draft' ? 'edit' : 'chart'} disabled={busy} onClick={() => onOpen(assessment)}>
                {assessment.status === 'draft' ? 'Editar borrador' : 'Ver resultados'}
              </Button>
            </footer>
          </article>
        })}
      </div>
    </section>
  </div>
}

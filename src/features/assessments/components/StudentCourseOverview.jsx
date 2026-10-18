import { Alert, Badge, Button, Icon } from '@/components/ui'
import { Select } from '@/components/ui/Field'
import { statusLabels, typeOptions } from '../utils/forms'

const STATES = {
  published: { tone: 'brand', icon: 'clipboard', accent: 'bg-[#E9F8EA] text-[#2A7A35]' },
  closed: { tone: 'neutral', icon: 'calendar', accent: 'bg-[#F0F3EF] text-[#5A6B6A]' },
  finalized: { tone: 'forest', icon: 'check', accent: 'bg-[#304744] text-white' },
}

export function StudentCourseHeader() {
  return <header className="relative overflow-hidden rounded-3xl border border-[#D8E8D5] bg-[#E9F8EA] p-6 sm:p-8">
    <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-52 w-52 rounded-full border-[28px] border-[#DDF0D9] opacity-60" />
    <div className="relative">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#2A7A35]"><Icon name="clipboard" className="h-4 w-4" />Tu curso · Aprender y compartir</p>
      <h1 className="text-3xl font-bold tracking-tight text-[#304744]">Evaluaciones</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5A6B6A]">Cada respuesta nos ayuda a conocer cómo aprendes. ¡Vamos paso a paso!</p>
    </div>
  </header>
}

/** Solo presentación. La disponibilidad y los intentos se validan en el flujo existente. */
export default function StudentCourseOverview({ data, filter, onFilterChange, busy, onGrades, onRefresh, onOpen }) {
  const visible = data.assessments.filter((assessment) => !filter || assessment.id === filter)
  return <div className="space-y-6">
    <section aria-label="Herramientas de mi curso" className="rounded-2xl border border-[#E6EAE3] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Select label="Filtrar por evaluación" value={filter} onChange={onFilterChange} options={[
            { value: '', label: 'Todas las evaluaciones' },
            ...data.assessments.map((assessment) => ({ value: assessment.id, label: assessment.title })),
          ]} />
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="secondary" icon="refresh" disabled={busy} onClick={onRefresh}>Actualizar</Button>
          <Button icon="chart" disabled={busy} onClick={onGrades}>Mis calificaciones</Button>
        </div>
      </div>
    </section>

    {!data.courses.length && <Alert tone="info" title="Sin cursos autorizados">
      Un administrador debe habilitar tu curso y su matrícula en el módulo de evaluaciones.
    </Alert>}

    <section aria-labelledby="student-assessments-title" className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 id="student-assessments-title" className="text-lg font-bold tracking-tight text-[#304744]">Mis evaluaciones</h2>
          <p className="mt-1 text-xs text-[#7D8C8A]">Las actividades que tu docente te ha asignado.</p>
        </div>
        <span className="shrink-0 rounded-full border border-[#E6EAE3] bg-white px-3 py-1 text-xs font-semibold text-[#5A6B6A]">{visible.length} {visible.length === 1 ? 'evaluación' : 'evaluaciones'}</span>
      </div>
      {!data.assessments.length && <div className="rounded-3xl border border-dashed border-[#D8E8D5] bg-white p-8 text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#E9F8EA] text-[#2A7A35]"><Icon name="clipboard" className="h-6 w-6" /></span>
        <h3 className="text-lg font-bold text-[#304744]">Aún no hay evaluaciones</h3>
        <p className="mt-2 text-sm text-[#5A6B6A]">Aquí aparecerán las evaluaciones que tu docente te asigne.</p>
      </div>}
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {visible.map((assessment) => {
          const status = STATES[assessment.status] || STATES.closed
          const course = data.courses.find((item) => item.id === assessment.courseId)
          const type = typeOptions.find((item) => item.value === assessment.type)?.label
          return <article key={assessment.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E6EAE3] bg-white shadow-[0_1px_3px_rgba(48,71,68,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[#B7E8B5] hover:shadow-[0_8px_24px_rgba(48,71,68,0.07)]">
            <div className="flex-1 space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className={'grid h-11 w-11 shrink-0 place-items-center rounded-xl ' + status.accent}><Icon name={status.icon} className="h-5 w-5" /></span>
                <Badge tone={status.tone} dot>{statusLabels[assessment.status] || assessment.status}</Badge>
              </div>
              <div>
                {type && <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7D8C8A]">{type}</p>}
                <h3 className="break-words text-lg font-bold leading-snug tracking-tight text-[#304744]">{assessment.title}</h3>
                <p className="mt-2 text-sm text-[#5A6B6A]">{course?.name}</p>
              </div>
              <div className="flex flex-wrap items-start gap-x-5 gap-y-3 rounded-xl bg-[#F8FAF6] p-3.5">
                <div className="flex min-w-0 items-start gap-2">
                  <Icon name="calendar" className="mt-0.5 h-4 w-4 shrink-0 text-[#7D8C8A]" />
                  <p className="text-xs leading-relaxed text-[#304744]"><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#7D8C8A]">Cierre:</span>{new Date(assessment.endsAt).toLocaleString()}</p>
                </div>
                {assessment.durationMinutes !== undefined && <p className="text-xs leading-relaxed text-[#304744]"><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#7D8C8A]">Duración</span>{assessment.durationMinutes ? assessment.durationMinutes + ' min' : 'Hasta el cierre'}</p>}
              </div>
            </div>
            <footer className="flex justify-end border-t border-[#E6EAE3] px-5 py-4 sm:px-6">
              <Button variant={assessment.status === 'published' ? 'primary' : 'secondary'} icon="chevronRight" iconPosition="right" disabled={busy} onClick={() => onOpen(assessment)} className="w-full sm:w-auto">Abrir evaluación</Button>
            </footer>
          </article>
        })}
      </div>
    </section>
  </div>
}

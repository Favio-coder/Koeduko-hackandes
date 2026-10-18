import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, ProgressBar } from '@/components/ui'
import { focusRing } from '@/components/ui/tokens'
import { MATH_SKILLS } from '@/shared/constants/contracts'
import MatchingGroupList from '../components/MatchingGroupList'
import { MIN_HELPER_SCORE, MIN_SUPPORT_GAP } from '../data/matchingConfig'
import MatchingClassroom from '../components/MatchingClassroom'
import { useMatchingPreview } from '../hooks/useMatchingPreview'

const STEPS = [
  { title: 'Revisar perfiles', hint: 'Abre un estudiante y consulta sus habilidades.' },
  { title: 'Formar grupos', hint: 'El motor propone parejas y tríos por evidencia.' },
  { title: 'Confirmar y ver resultados', hint: 'Revisa el detalle antes de decidir.' },
]

/** Misma tarjeta de métrica que el dashboard: icono, etiqueta y cifra. */
function StatCard({ label, value, icon, hint }) {
  return (
    <Card padding="md" className="flex items-start gap-3.5">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E9F8EA] text-[#2A7A35]">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6B6A]">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#304744]">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-[#7D8C8A]">{hint}</p>}
      </div>
    </Card>
  )
}

function skillTone(value) {
  if (value >= MIN_HELPER_SCORE) return 'brand'
  if (value >= 0.5) return 'forest'
  if (value >= MIN_SUPPORT_GAP) return 'warning'
  return 'danger'
}

/** Perfil del estudiante plegable: nombre en el resumen y barras por habilidad. */
function StudentCard({ student }) {
  const name = student.displayName || student.studentId
  const skills = MATH_SKILLS.filter(({ id }) => Number.isFinite(student.skills?.[id]))
  const total = skills.reduce((sum, { id }) => sum + student.skills[id], 0)
  const avg = skills.length ? Math.round((total / skills.length) * 100) : null
  return (
    <li>
      <details className="group overflow-hidden rounded-2xl border border-[#E6EAE3] bg-white transition hover:border-[#B7E8B5] hover:shadow-[0_8px_24px_rgba(48,71,68,0.08)]">
        <summary
          className={`flex cursor-pointer items-center gap-3 bg-[#F8FAF6] px-4 py-3.5 text-sm font-bold text-[#304744] transition-colors hover:bg-[#E9F8EA] ${focusRing}`}
        >
          <Avatar name={name} size="sm" />
          {name}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {avg !== null && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#2A7A35] ring-1 ring-inset ring-[#B7E8B5]">
                {avg}%
              </span>
            )}
            <Icon name="chevronDown" className="h-4 w-4 text-[#7D8C8A] transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="space-y-3 border-t border-[#E6EAE3] px-4 py-4">
          {skills.map(({ id, label }) => (
            <ProgressBar
              key={id}
              label={label}
              value={student.skills[id]}
              size="sm"
              tone={skillTone(student.skills[id])}
            />
          ))}
          <p className="pt-1 text-[11px] leading-relaxed text-[#7D8C8A]">
            Los apoyos requieren {Math.round(MIN_HELPER_SCORE * 100)}% o más y una brecha mínima de{' '}
            {Math.round(MIN_SUPPORT_GAP * 100)} puntos.
          </p>
        </div>
      </details>
    </li>
  )
}

/** Recibe datos por contrato y espera la acción del docente para agrupar. */
export default function MatchingPage(props) {
  if (props.assessmentResults !== undefined || props.knowledgeProfiles !== undefined) {
    return <MatchingWorkspace {...props} />
  }
  return <MatchingClassroom>{({ data, scope }) =>
    <MatchingWorkspace {...props} assessmentResults={data} storageScope={scope} />
  }</MatchingClassroom>
}

function MatchingWorkspace({ assessmentResults, knowledgeProfiles, assessmentId, forbiddenPairs, storageScope }) {
  const input = assessmentResults === undefined ? knowledgeProfiles : assessmentResults
  const selectedAssessmentId = assessmentId ?? assessmentResults?.assessmentId
  const { students, usingDemo, result, loading, error, storageWarning, generate } = useMatchingPreview(input, { assessmentId: selectedAssessmentId, forbiddenPairs, storageScope })
  const query = storageScope ? '?' + new URLSearchParams({ courseId: storageScope.courseId, assessmentId: storageScope.assessmentId }) : ''
  const resultsUrl = '/matching/results' + query
  const skillCount = MATH_SKILLS.filter(({ id }) => students.length > 0 && students.every((student) => Number.isFinite(student.skills?.[id]))).length
  const grouped = result?.status === 'optimal'
  const currentStep = grouped ? 2 : students.length >= 2 ? 1 : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Herramientas docentes"
        title="Emparejamiento"
        description="Revisa los perfiles del aula y forma grupos donde cada estudiante pueda apoyar y aprender."
        badge={
          <Badge tone={usingDemo ? 'brand' : 'neutral'} dot>
            {usingDemo ? 'Datos de demostración' : 'Evaluación recibida'}
          </Badge>
        }
        actions={
          <Button to={resultsUrl} variant="secondary" icon="chart" iconPosition="right">
            Ver último resultado
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ol
          aria-label="Pasos del emparejamiento"
          className="grid gap-3 rounded-2xl border border-[#E6EAE3] bg-white p-4 shadow-[0_1px_3px_rgba(48,71,68,0.08),0_1px_2px_rgba(48,71,68,0.04)] sm:grid-cols-3 lg:col-span-2"
        >
          {STEPS.map((step, index) => {
            const done = index < currentStep
            const active = index === currentStep
            return (
              <li
                key={step.title}
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  active ? 'border-[#B7E8B5] bg-[#E9F8EA]' : 'border-[#E6EAE3] bg-[#F8FAF6]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    done ? 'bg-[#304744] text-white' : active ? 'bg-[#2A7A35] text-white' : 'bg-white text-[#7D8C8A] ring-1 ring-inset ring-[#E6EAE3]'
                  }`}
                >
                  {done ? <Icon name="check" className="h-4 w-4" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#304744]">{step.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[#5A6B6A]">{step.hint}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <Card title="Umbrales del motor" variant="sunken" padding="sm">
          <ul className="space-y-2.5 text-sm text-[#5A6B6A]">
            <li className="flex items-center justify-between gap-3">
              <span>Apoyo mínimo</span>
              <Badge tone="brand" size="sm">{Math.round(MIN_HELPER_SCORE * 100)}%</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Brecha mínima</span>
              <Badge tone="warning" size="sm">{Math.round(MIN_SUPPORT_GAP * 100)} puntos</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Decisión final</span>
              <Badge tone="neutral" size="sm">Docente</Badge>
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Estudiantes"
          value={students.length}
          icon="users"
          hint={usingDemo ? 'Datos de demostración compartidos' : 'Recibidos de la evaluación'}
        />
        <StatCard
          label="Habilidades"
          value={skillCount}
          icon="clipboard"
          hint="Habilidades comparables de la evaluación"
        />
        <StatCard
          label="Grupos propuestos"
          value={grouped ? result.groups.length : '—'}
          icon="sparkles"
          hint={grouped ? 'Listos para revisar' : 'Espera la acción Agrupar'}
        />
      </div>

      <Card
        title="Estudiantes"
        description={`${students.length} ${students.length === 1 ? 'estudiante recibido' : 'estudiantes recibidos'}`}
        actions={
          <Button onClick={generate} loading={loading} disabled={students.length < 2} icon="sparkles">
            Agrupar
          </Button>
        }
      >
        <p className="mb-4 text-xs text-[#5A6B6A]">
          {usingDemo ? 'Datos de prueba de shared/lib/demoData.' : 'Resultados recibidos de evaluación.'}{' '}
          Abre un estudiante para ver sus habilidades.
        </p>
        {students.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Estudiantes recibidos">
            {students.map((student) => (
              <StudentCard key={student.studentId} student={student} />
            ))}
          </ul>
        )}
        {!error && students.length === 0 && (
          <EmptyState title="No hay estudiantes" description="Se necesitan resultados de evaluación para agrupar." />
        )}
        {!error && students.length === 1 && (
          <EmptyState title="Falta un compañero" description="Se necesitan al menos dos estudiantes para generar un grupo." />
        )}
        {!result && !loading && students.length >= 2 && (
          <p className="mt-4 rounded-xl border border-[#B7E8B5] bg-[#E9F8EA] px-4 py-3 text-sm font-medium text-[#2A7A35]">
            Pulsa Agrupar para calcular los grupos con estos estudiantes.
          </p>
        )}
      </Card>

      {loading && <LoadingState label="Calculando grupos…" />}
      {error && <ErrorState error={error} />}
      {storageWarning && (
        <p role="status" className="rounded-xl border border-[#B7E8B5] bg-[#E9F8EA] p-3 text-sm text-[#2A7A35]">
          {storageWarning}
        </p>
      )}
      {result?.status === 'infeasible' && (
        <ErrorState error="No se puede agrupar a todos respetando las restricciones recibidas." />
      )}
      {result?.status === 'insufficient_evidence' && (
        <EmptyState title="Falta evidencia comparable" description="No hay habilidades evaluadas con evidencia para todo el grupo." />
      )}
      {result?.status === 'optimal' && (
        <section className="space-y-4" aria-labelledby="proposal-title">
          <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[#B7E8B5] p-5 [background-image:linear-gradient(120deg,#E9F8EA,#F8FAF6)]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">Propuesta lista para revisar</p>
              <h2 id="proposal-title" className="mt-1 text-lg font-bold tracking-tight text-[#304744]">Propuesta de grupos</h2>
              <p className="mt-0.5 text-sm text-[#5A6B6A]">{result.groups.length} grupos · {students.length} estudiantes</p>
            </div>
            <Button to={resultsUrl} state={{ matchingResult: result, resultOwnerId: storageScope?.ownerId }} icon="chart">
              Ver resultados
            </Button>
          </header>
          <MatchingGroupList groups={result.groups} />
          <p className="text-xs leading-relaxed text-[#7D8C8A]">
            Propuesta para revisión docente. Las diferencias de puntaje no garantizan aprendizaje.
          </p>
        </section>
      )}
    </div>
  )
}

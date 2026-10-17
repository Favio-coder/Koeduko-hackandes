import { Badge, Button, Card, ProgressBar } from '@/components/ui'
import Alert from '@/components/ui/Alert'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { DEMO_STUDENTS } from '@/shared/lib/demoData'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 1 (feature/auth-dashboard)
 *
 * Ruta real: `/students` (registrada en `src/app/router.jsx`, solo rol docente).
 *
 * Esta es la pantalla que le toca completar a quien siga con el CRUD de
 * estudiantes y aulas (tarea 1.1 / 1.2 de docs/TEAM_TASKS.md). Hoy muestra
 * `DEMO_STUDENTS` —los mismos datos ficticios que ya usa `TeacherDashboard`—
 * para que la vista sea navegable y el layout quede validado.
 *
 * Qué falta implementar aquí (nada de esto se hace desde el diseño):
 * - Cargar los estudiantes reales del aula (`students` del `classroom` del
 *   docente) con el hook de lafeature; manejar `loading` con `LoadingState`
 *   y `error` con `ErrorState` + reintento.
 * - Alta / edición / baja de estudiante (CRUD) con confirmación en `Modal`.
 * - Enlace al perfil del estudiante (tarea 1.7).
 * - Paginación o búsqueda cuando el aula supere ~30 estudiantes.
 *
 * Contrato de datos: ver `docs/FIRESTORE_SCHEMA.md` (colección `students`).
 * La autoridad la validan las Firestore Security Rules, no el frontend.
 */

/** Etiquetas legibles de las destrezas del contrato (fallback si cambia el set). */
const SKILL_LABELS = {
  addition: 'Adición',
  subtraction: 'Resta',
  multiplication: 'Multiplicación',
  division: 'División',
}

export default function StudentsPage() {
  const students = DEMO_STUDENTS

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Docencia"
        title="Estudiantes"
        description="Listado de estudiantes del aula con su perfil de conocimientos."
        badge={<Badge tone="brand">{students.length} estudiantes</Badge>}
        actions={
          <>
            <Button to="/assessments" variant="secondary" icon="clipboard" className="w-full sm:w-auto">
              Diagnóstico
            </Button>
            <Button icon="plus" className="w-full sm:w-auto">
              Nuevo estudiante
            </Button>
          </>
        }
      />

      <Alert tone="info" title="Pantalla en construcción">
        Hoy se muestran datos ficticios de demostración. El CRUD real (lectura de
        <code className="mx-1 rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">students</code>
        del aula, alta, edición y baja) queda a cargo del desarrollador de
        autenticación y dashboard.
      </Alert>

      <Card title="Listado" description="Nivel de dominio por destreza del contrato." padding="sm">
        {/* Responsive: tarjetas en 1 columna (móvil) · 2 (tablet) · 3 (escritorio) */}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => (
            <li
              key={student.id}
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

              <div className="space-y-2.5 border-t border-[#E6EAE3] pt-3">
                {Object.entries(student.skills).map(([skill, value]) => (
                  <ProgressBar
                    key={skill}
                    size="sm"
                    label={SKILL_LABELS[skill] ?? skill}
                    value={value}
                  />
                ))}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[#E6EAE3] pt-3">
                <Button to="/sessions" variant="ghost" size="sm" icon="video">
                  Sus salas
                </Button>
                <Button variant="secondary" size="sm" icon="edit" className="ml-auto">
                  Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <p className="flex items-center gap-2 text-xs text-[#7D8C8A]">
        <Icon name="info" className="h-4 w-4 shrink-0" />
        Los botones «Nuevo estudiante» y «Editar» son visuales: aún no ejecutan ninguna acción.
      </p>
    </div>
  )
}
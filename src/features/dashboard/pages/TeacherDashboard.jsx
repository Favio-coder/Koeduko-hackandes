import { Badge, Button, Card, ProgressBar } from '@/components/ui'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import { DEMO_STUDENTS } from '@/shared/lib/demoData'
import { useAuth } from '@/contexts/AuthContext'

/** Tarjeta de métrica: cifra grande + etiqueta + icono. */
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

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const firstName = (profile?.displayName || 'docente').split(' ')[0]

  const stats = [
    { label: 'Estudiantes', value: DEMO_STUDENTS.length, icon: 'users', hint: 'En el aula' },
    { label: 'Sesiones activas', value: 1, icon: 'video', hint: 'En curso' },
    { label: 'Parejas formadas', value: 2, icon: 'users', hint: 'Por complementariedad' },
  ]

  const shortcuts = [
    { to: '/assessments', label: 'Diagnosticar estudiantes', icon: 'clipboard', variant: 'primary' },
    { to: '/matching', label: 'Formar parejas', icon: 'sparkles', variant: 'secondary' },
    { to: '/sessions', label: 'Gestionar salas', icon: 'video', variant: 'secondary' },
  ]

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <header className="flex flex-col gap-4 rounded-2xl border border-[#E6EAE3] bg-white p-4 shadow-[0_1px_3px_rgba(48,71,68,0.08)] sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-center gap-4">
          <Avatar name={profile?.displayName || 'Docente'} size="md" />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight text-[#304744] sm:text-2xl">
              ¡Hola, {firstName}! 👋
            </h2>
            <p className="mt-1 text-sm text-[#5A6B6A]">
              Gestiona tus estudiantes y acompaña su aprendizaje.
            </p>
          </div>
        </div>
        <Badge tone="neutral" dot className="self-start sm:ml-auto sm:self-center">
          Datos de demostración
        </Badge>
      </header>

      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Accesos rápidos */}
      <Card title="Accesos rápidos" description="Puntos de entrada al flujo principal del MVP.">
        <div className="grid gap-3 sm:grid-cols-3">
          {shortcuts.map((s) => (
            <Button key={s.to} to={s.to} variant={s.variant} icon={s.icon} className="w-full">
              {s.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Estudiantes */}
      <Card
        title="Estudiantes registrados"
        description="Datos ficticios de demostración."
        padding="sm"
        actions={
          <Button to="/assessments" variant="ghost" size="sm">
            Ver diagnóstico
          </Button>
        }
      >
        <ul className="divide-y divide-[#E6EAE3]">
          {DEMO_STUDENTS.map((student) => (
            <li key={student.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={student.displayName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#304744]">
                    {student.displayName}
                  </p>
                  <p className="truncate font-mono text-xs text-[#7D8C8A]">{student.id}</p>
                </div>
              </div>
              <div className="w-full sm:w-44">
                <ProgressBar value={student.skills.addition} label="Adición" />
              </div>
            </li>
          ))}
        </ul>
      </Card>

    </div>
  )
}
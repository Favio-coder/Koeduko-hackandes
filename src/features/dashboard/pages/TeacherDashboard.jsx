import { Link } from 'react-router-dom'
import { Button, Card, ProgressBar } from '@/components/ui'
import { DEMO_STUDENTS } from '@/shared/lib/demoData'
import { useAuth } from '@/contexts/AuthContext'

export default function TeacherDashboard() {
  const { profile } = useAuth()

  const stats = [
    { label: 'Estudiantes', value: DEMO_STUDENTS.length },
    { label: 'Sesiones activas', value: 1 },
    { label: 'Parejas formadas', value: 2 },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Hola, {profile?.displayName || 'docente'}
        </h1>
        {/* <p className="mt-1 text-sm text-slate-600">
          Panel docente. Los datos mostrados son ficticios para la demostracion.
        </p> */}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card
        title="Accesos rapidos"
        description="Puntos de entrada al flujo principal del MVP."
      >
        <div className="flex flex-wrap gap-3">
          <Button to="/assessments">Diagnosticar estudiantes</Button>
          <Button to="/matching" variant="secondary">
            Formar parejas
          </Button>
          <Button to="/sessions" variant="secondary">
            Gestionar sesiones
          </Button>
        </div>
      </Card>

      <Card title="Estudiantes registrados" description="Datos ficticios de demostracion.">
        <ul className="divide-y divide-slate-100">
          {DEMO_STUDENTS.map((student) => (
            <li key={student.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{student.displayName}</p>
                <p className="text-xs text-slate-500">{student.id}</p>
              </div>
              <div className="w-40">
                <ProgressBar
                  value={student.skills.addition}
                  label="Adicion"
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-slate-400">
        Conoce el flujo completo del MVP en{' '}
        <Link to="/sessions" className="text-indigo-600 underline">
          las sesiones de aprendizaje
        </Link>
        .
      </p>
    </div>
  )
}

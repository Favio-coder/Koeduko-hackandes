/**
 * DemoAccess — accesos directos del login para la demostración.
 *
 * Dos caminos, uno por cada rol:
 * - Docente: entra con la cuenta de la demo (sin escribir nada).
 * - Estudiante: lleva al registro; la cuenta nueva se crea con rol estudiante
 *   y el servidor la matricula sola en el curso de matemática.
 */
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { DEMO_TEACHER } from '../demoAccount'

export default function DemoAccess({ onTeacherDemo, busy = false }) {
  return (
    <section
      aria-label="Accesos de demostración"
      className="mt-6 rounded-2xl border border-dashed border-[#B7E8B5] bg-[#F4FBF4] p-3.5"
    >
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">
        <Icon name="sparkles" className="h-4 w-4" aria-hidden="true" />
        Demostración
      </p>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <Button
          size="sm"
          icon="users"
          loading={busy}
          disabled={busy}
          onClick={onTeacherDemo}
        >
          Ingresa como docente
        </Button>
        <Button to="/register" variant="secondary" size="sm" icon="koala">
          Ingresa como estudiante
        </Button>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-[#5A6B6A]">
        <span className="font-semibold text-[#304744]">Docente:</span> entra directo con la cuenta
        de la demo ({DEMO_TEACHER.email}).{' '}
        <span className="font-semibold text-[#304744]">Estudiante:</span> crea tu cuenta y te
        asignamos automáticamente al curso de matemática.
      </p>
    </section>
  )
}

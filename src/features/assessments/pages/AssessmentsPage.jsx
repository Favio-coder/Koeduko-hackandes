import { Alert, Card } from '@/components/ui'
import { DEMO_STUDENTS, toKnowledgeProfiles } from '@/shared/lib/demoData'
import { MATH_SKILLS } from '@/shared/constants/contracts'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 2 (feature/matching-engine)
 * Archivo de arranque. Sustituir por la implementacion real:
 *   features/assessments/services/assessmentService.js
 * Ver docs/API_CONTRACTS.md seccion "Assessments".
 *
 * Solo presentación: mismos datos y misma tabla.
 */
export default function AssessmentsPage() {
  const profiles = toKnowledgeProfiles(DEMO_STUDENTS)

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">Curso</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#304744] sm:text-3xl">
          Diagnóstico
        </h2>
        <p className="mt-1.5 text-sm text-[#5A6B6A]">
          Evaluación inicial de la competencia «Resuelve problemas de cantidad» (5to de primaria).
        </p>
      </header>

      <Alert tone="info" title="Interfaz mínima pendiente">
        Este archivo es un punto de partida para el desarrollador 2. Debe implementar: carga de
        items, registro de respuestas, cálculo de perfiles y persistencia en{' '}
        <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">knowledgeProfiles</code>.
      </Alert>

      <Card
        title="Perfiles de conocimiento"
        description="Datos ficticios de demostración."
        padding="sm"
        actions={
          <span className="rounded-full bg-[#E9F8EA] px-2.5 py-1 text-xs font-semibold text-[#2A7A35]">
            {profiles.length} estudiantes
          </span>
        }
      >
        {/* Scroll horizontal contenido: la tabla no desborda la página */}
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">
              Perfil de conocimiento por estudiante y destreza matemática
            </caption>
            <thead>
              <tr className="border-b border-[#E6EAE3] text-xs uppercase tracking-wide text-[#5A6B6A]">
                <th scope="col" className="py-2.5 pr-4 font-semibold">
                  Estudiante
                </th>
                {MATH_SKILLS.map((s) => (
                  <th key={s.id} scope="col" className="px-2 py-2.5 text-right font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.studentId} className="border-b border-[#E6EAE3] last:border-0">
                  <th scope="row" className="py-2.5 pr-4 font-semibold text-[#304744]">
                    {p.displayName}
                  </th>
                  {MATH_SKILLS.map((s) => (
                    <td key={s.id} className="px-2 py-2.5 text-right tabular-nums text-[#5A6B6A]">
                      {p.skills[s.id].toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
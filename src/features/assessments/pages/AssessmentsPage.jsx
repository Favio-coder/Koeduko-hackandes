import { Card } from '@/components/ui'
import { DEMO_STUDENTS, toKnowledgeProfiles } from '@/shared/lib/demoData'
import { MATH_SKILLS } from '@/shared/constants/contracts'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 2 (feature/matching-engine)
 * Archivo de arranque. Sustituir por la implementacion real:
 *   features/assessments/services/assessmentService.js
 * Ver docs/API_CONTRACTS.md seccion "Assessments".
 */
export default function AssessmentsPage() {
  const profiles = toKnowledgeProfiles(DEMO_STUDENTS)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Diagnostico</h1>
        <p className="mt-1 text-sm text-slate-600">
          Evaluacion inicial de la competencia «Resuelve problemas de cantidad» (5to de primaria).
        </p>
      </header>

      <Card
        title="Interfaz minima pendiente"
        description="Este archivo es un punto de partida para el desarrollador 2."
      >
        <p className="text-sm text-slate-600">
          Debe implementar: carga de items, registro de respuestas, calculo de perfiles de
          conocimiento y persistencia en <code>knowledgeProfiles</code>.
        </p>
      </Card>

      <Card title="Perfiles de conocimiento (datos ficticios)">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2">Estudiante</th>
                {MATH_SKILLS.map((s) => (
                  <th key={s.id} className="py-2">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.studentId} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{p.displayName}</td>
                  {MATH_SKILLS.map((s) => (
                    <td key={s.id} className="py-2 text-slate-600">
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
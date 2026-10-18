import { useEffect, useState } from 'react'
import { Alert, Card } from '@/components/ui'
import { fetchClassInsights } from '../services/classInsightsService'

/**
 * «Lo que más cuesta en tus salas»: el acumulado de todas las salas cerradas del docente, por capacidad, de la que más cuesta a la
 * que menos. Solo conteos de alumnos (con evidencia / parcial / sin evidencia): sirve para decidir qué reforzar en clase. Es evidencia
 * formativa, nunca una nota. Sin salas cerradas todavía, o si falla, la tarjeta no aparece.
 *
 * @param {{ fetchInsights?: typeof fetchClassInsights }} props
 */
export default function ClassInsights({ fetchInsights = fetchClassInsights }) {
  const [insights, setInsights] = useState(null)

  useEffect(() => {
    let active = true
    fetchInsights()
      .then((data) => active && setInsights(data?.sessions > 0 ? data : null))
      .catch(() => active && setInsights(null))
    return () => {
      active = false
    }
  }, [fetchInsights])

  if (!insights) return null
  const rows = insights.capacities.filter((capacity) => capacity.total > 0)

  return (
    <Card title="Lo que más cuesta en tus salas" description={`${insights.sessions} ${insights.sessions === 1 ? 'sala cerrada' : 'salas cerradas'} · ${insights.students} ${insights.students === 1 ? 'participación' : 'participaciones'}`}>
      <ul className="space-y-3">
        {rows.map((capacity) => (
          <li key={capacity.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="min-w-0 break-words font-medium text-[#304744]">{capacity.nombre}</span>
              <span className="shrink-0 text-xs text-[#5A6B6A]">
                {capacity.con} con evidencia · {capacity.parcial} parcial · {capacity.sin} sin evidencia
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#E8EFE6]" role="img" aria-label={`${capacity.sinPct}% sin evidencia suficiente`}>
              <div className="h-full rounded-full bg-[#F2B84B]" style={{ width: `${capacity.sinPct}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <Alert tone="info" compact className="mt-4">Evidencia formativa para decidir qué reforzar: la calificación la decide el docente.</Alert>
    </Card>
  )
}

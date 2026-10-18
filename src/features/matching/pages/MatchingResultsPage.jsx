import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, EmptyState } from '@/components/ui'
import MatchingGroupList from '../components/MatchingGroupList'
import { readMatchingResult, validateSavedMatching } from '../services/matchingResultStorage'

function loadSnapshot(routeResult) {
  if (routeResult) {
    try { return { result: validateSavedMatching(routeResult), error: null } }
    catch { /* Recuperar la última propuesta válida de esta pestaña. */ }
  }
  return readMatchingResult()
}

/** Muestra una propuesta ya generada. No ejecuta el algoritmo. */
export default function MatchingResultsPage({ assessmentId }) {
  const location = useLocation()
  const [snapshot] = useState(() => loadSnapshot(location.state?.matchingResult))
  const [filter, setFilter] = useState('all')
  const result = assessmentId && snapshot.result?.assessmentId !== assessmentId ? null : snapshot.result
  const groups = result?.groups ?? []
  const students = groups.reduce((total, group) => total + group.size, 0)
  const pairs = groups.filter((group) => group.size === 2).length
  const trios = groups.length - pairs

  return (
    <section className="space-y-6 text-[#304744]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Resultados de emparejamiento</h1>
          <p className="mt-1 text-sm text-[#5A6B6A]">Último agrupamiento generado en esta pestaña.</p>
        </div>
        <Button to="/matching" variant="secondary">Volver a estudiantes</Button>
      </header>
      {!result ? <div className="space-y-4 rounded-3xl border border-[#E6EAE3] bg-white p-6">
        <EmptyState title="Aún no hay agrupamiento" description={snapshot.error || 'Ve a Estudiantes y pulsa Agrupar para generar una propuesta.'} />
        <Button to="/matching">Preparar estudiantes</Button>
      </div> : <>
        <dl className="grid grid-cols-3 gap-3">
          {[['Estudiantes', students], ['Parejas', pairs], ['Tríos', trios]].map(([label, count]) => <div key={label} className="rounded-2xl border border-[#E6EAE3] bg-white p-4">
            <dt className="text-xs text-[#5A6B6A]">{label}</dt><dd className="mt-1 text-2xl font-bold">{count}</dd>
          </div>)}
        </dl>
        <p className="text-xs text-[#5A6B6A]">{result.source?.containsSimulatedData ? 'Datos de prueba compartidos' : 'Resultados de evaluación'} · {result.assessmentId}</p>
        <div role="group" aria-label="Filtrar grupos" className="flex flex-wrap gap-2">
          {[['all', 'Todos', groups.length], ['pairs', 'Parejas', pairs], ['trios', 'Tríos', trios]].map(([value, label, count]) =>
            <Button key={value} variant={filter === value ? 'subtle' : 'secondary'} onClick={() => setFilter(value)} aria-pressed={filter === value} disabled={count === 0}>{label} ({count})</Button>
          )}
        </div>
        <MatchingGroupList groups={groups} filter={filter} />
      </>}
    </section>
  )
}

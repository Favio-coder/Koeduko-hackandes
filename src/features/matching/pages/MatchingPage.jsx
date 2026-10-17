import { Card, EmptyState } from '@/components/ui'
import { useMatchingPreview } from '../hooks/useMatchingPreview'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 2 (feature/matching-engine)
 * Debe consumir features/matching/algorithms/matchingAlgorithm.js
 * Ver docs/API_CONTRACTS.md seccion "Matching".
 */
export default function MatchingPage() {
  const { profiles, error, loading } = useMatchingPreview()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Emparejamiento</h1>
        <p className="mt-1 text-sm text-slate-600">
          Formacion de parejas por conocimientos complementarios.
        </p>
      </header>

      {loading && <p className="text-sm text-slate-500">Cargando perfiles...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card title="Estado del modulo" description="Pendiente: desarrollador 2">
        {profiles.length === 0 ? (
          <EmptyState
            title="Sin perfiles de conocimiento"
            description="Ejecuta el diagnostico para generar los perfiles que alimentan el emparejamiento."
          />
        ) : (
          <p className="text-sm text-slate-600">
            {profiles.length} perfiles disponibles. La generacion de parejas se implementa en{' '}
            <code>features/matching/algorithms/matchingAlgorithm.js</code>.
          </p>
        )}
      </Card>
    </div>
  )
}
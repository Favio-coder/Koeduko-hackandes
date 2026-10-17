import { Card, EmptyState } from '@/components/ui'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 2 (feature/matching-engine)
 * Debe listar los resultados persistidos en `matchingResults`.
 */
export default function MatchingResultsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Resultados de emparejamiento</h1>
        <p className="mt-1 text-sm text-slate-600">
          Parejas generadas y su puntuacion de complementariedad.
        </p>
      </header>

      <Card title="Pendiente: desarrollador 2">
        <EmptyState
          title="Aun no hay resultados"
          description="Los resultados apareceran aqui una vez implementado el algoritmo de emparejamiento."
        />
      </Card>
    </div>
  )
}
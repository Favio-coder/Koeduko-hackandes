import { Button, Card, EmptyState } from '@/components/ui'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 2 (feature/matching-engine)
 * Debe listar los resultados persistidos en `matchingResults`.
 *
 * Solo presentación.
 */
export default function MatchingResultsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">
            Docencia
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#304744] sm:text-3xl">
            Resultados de emparejamiento
          </h2>
          <p className="mt-1.5 text-sm text-[#5A6B6A]">
            Parejas generadas y su puntuación de complementariedad.
          </p>
        </div>
        <Button to="/matching" variant="secondary" icon="arrowRight" className="w-full sm:w-auto">
          Volver al emparejamiento
        </Button>
      </header>

      <Card title="Pendiente: desarrollador 2" padding="sm">
        <EmptyState
          icon="chart"
          title="Aún no hay resultados"
          description="Los resultados aparecerán aquí una vez implementado el algoritmo de emparejamiento."
        />
      </Card>
    </div>
  )
}
import { Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import Icon from '@/components/ui/Icon'
import { useMatchingPreview } from '../hooks/useMatchingPreview'

/**
 * PUNTO DE EXTENSION - DESARROLLADOR 2 (feature/matching-engine)
 * Debe consumir features/matching/algorithms/matchingAlgorithm.js
 * Ver docs/API_CONTRACTS.md seccion "Matching".
 *
 * Solo presentación: mismo hook, mismos estados, mismo contenido.
 */
export default function MatchingPage() {
  const { profiles, error, loading } = useMatchingPreview()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">
            Docencia
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#304744] sm:text-3xl">
            Emparejamiento
          </h2>
          <p className="mt-1.5 text-sm text-[#5A6B6A]">
            Formación de parejas por conocimientos complementarios.
          </p>
        </div>
        <Button to="/matching/results" variant="secondary" icon="chart" className="w-full sm:w-auto">
          Ver resultados
        </Button>
      </header>

      {loading && <LoadingState label="Cargando perfiles..." compact />}
      {error && <ErrorState error={error} compact />}

      {!loading && (
        <Card title="Estado del módulo" description="Pendiente: desarrollador 2">
          {profiles.length === 0 ? (
            <EmptyState
              icon="users"
              title="Sin perfiles de conocimiento"
              description="Ejecuta el diagnóstico para generar los perfiles que alimentan el emparejamiento."
              action={
                <Button to="/assessments" icon="clipboard">
                  Ir al diagnóstico
                </Button>
              }
            />
          ) : (
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F8EA] text-[#2A7A35]">
                <Icon name="users" className="h-5 w-5" />
              </span>
              <p className="text-sm text-[#5A6B6A]">
                {profiles.length} perfiles disponibles. La generación de parejas se implementa en{' '}
                <code className="rounded bg-[#F8FAF6] px-1.5 py-0.5 font-mono text-xs">
                  features/matching/algorithms/matchingAlgorithm.js
                </code>
                .
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
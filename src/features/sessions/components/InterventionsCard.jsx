import { Badge, Card } from '@/components/ui'
import { describeEvidence, metaOf, timeAgo } from '../lib/describeIntervention'

/**
 * Lo que dijo el tutor, lo mas reciente arriba, y por que lo dijo en palabras simples.
 * Las intervenciones llegan ya ordenadas desde Firestore; aqui no se reordenan.
 *
 * @param {{ items: object[], nowMs: number }} props `nowMs` entra por parametro (sin Date.now() al renderizar).
 */
export default function InterventionsCard({ items = [], nowMs }) {
  return (
    <Card title="Lo que dijo el tutor" description="Cuándo intervino y por qué.">
      {items.length === 0 ? (
        <p className="text-sm text-[#5A6B6A]">El tutor todavía no ha intervenido.</p>
      ) : (
        <ol className="space-y-4" aria-label="Intervenciones del tutor, la más reciente primero">
          {items.map((item) => {
            const meta = metaOf(item.signal)
            const why = describeEvidence(item)
            const when = timeAgo(item.createdMs, nowMs)
            return (
              <li key={item.id} className="min-w-0 rounded-xl bg-[#F8FAF6] p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={meta.tone} size="sm">
                    {meta.label}
                  </Badge>
                  {when && <span className="text-xs text-[#7D8C8A]">{when}</span>}
                </div>
                <p className="mt-2 break-words text-sm font-medium text-[#304744]">{item.message}</p>
                {why && <p className="mt-1.5 break-words text-xs text-[#5A6B6A]">Porque: {why}</p>}
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

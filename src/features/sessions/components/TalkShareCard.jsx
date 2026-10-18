import { Badge, Card, ProgressBar } from '@/components/ui'
import { formatSpan } from '../lib/describeIntervention'

/**
 * Quien habla: una barra por participante con su porcentaje de la conversacion reciente. El calculo
 * lo hace el servidor (live/view); aqui solo se dibuja. Quien nunca hablo aparece en 0 %, que es
 * justo lo que el tutor detecta.
 *
 * @param {{ view: { windowSec?: number, totalSpeechSec?: number, participants?: object[] } }} props
 */
export default function TalkShareCard({ view }) {
  const participants = view?.participants ?? []
  const span = formatSpan(view?.windowSec)

  return (
    <Card title="Quién habla" description={span ? `Reparto de la palabra en los últimos ${span}.` : 'Reparto de la palabra.'}>
      {participants.length === 0 ? (
        <p className="text-sm text-[#5A6B6A]">Todavía no hay participantes en la reunión.</p>
      ) : (
        <ul className="space-y-4" aria-label="Reparto de la palabra por estudiante">
          {participants.map((person) => (
            <li key={person.key} className="min-w-0">
              <ProgressBar
                label={person.name}
                value={(person.sharePct ?? 0) / 100}
                valueLabel={`${person.sharePct ?? 0}%`}
                tone={person.sharePct === 0 ? 'neutral' : 'brand'}
              />
              {person.speaking && (
                <Badge tone="success" size="sm" dot className="mt-1.5">
                  Hablando ahora
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

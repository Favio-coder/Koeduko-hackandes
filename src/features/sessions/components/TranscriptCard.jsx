import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui'

/** Un color por hablante, estable segun el orden en que aparecen. Mismo tono de marca que el resto. */
const SPEAKER_DOTS = ['bg-[#4CDB59]', 'bg-[#2A7A9B]', 'bg-[#D9A441]', 'bg-[#B4544E]', 'bg-[#7D8C8A]']

/**
 * La conversacion: las ultimas lineas de transcripcion, cada una con su hablante. Se desplaza sola
 * hacia lo mas reciente y avisa a los lectores de pantalla cuando llega texto nuevo.
 *
 * @param {{ lines: { key: string, name: string, text: string, t?: number }[] }} props
 */
export default function TranscriptCard({ lines = [] }) {
  const scroller = useRef(null)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const speakers = [...new Set(lines.map((line) => line.key))]

  return (
    <Card title="Conversación" description={`Últimas ${lines.length || 20} frases, con quién las dijo.`}>
      {lines.length === 0 ? (
        <p className="text-sm text-[#5A6B6A]">Todavía nadie ha hablado.</p>
      ) : (
        <ol
          ref={scroller}
          aria-live="polite"
          aria-label="Transcripción de la reunión"
          className="max-h-72 space-y-3 overflow-y-auto pr-1"
        >
          {lines.map((line, index) => (
            <li key={`${line.key}-${line.t ?? index}-${index}`} className="flex min-w-0 gap-2.5">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SPEAKER_DOTS[speakers.indexOf(line.key) % SPEAKER_DOTS.length]}`}
              />
              <p className="min-w-0 break-words text-sm text-[#304744]">
                <span className="font-semibold">{line.name}: </span>
                {line.text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

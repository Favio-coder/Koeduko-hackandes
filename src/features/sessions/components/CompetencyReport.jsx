import { Alert, Badge, Card } from '@/components/ui'
import { COMPETENCY_NAME, FORMATIVE_NOTE } from '@/shared/constants/contracts'
import { clock, closeNotes, stateMeta } from '../lib/competency'

/**
 * Reporte de cierre: por estudiante, las cuatro capacidades de la competencia con su estado y hasta dos
 * citas textuales (con el minuto en que se dijeron). Es EVIDENCIA FORMATIVA: la calificacion es del
 * docente, y eso se dice siempre arriba. Nunca se muestra una nota (AD/A/B/C).
 *
 * @param {{ report: object, steps?: object }} props
 */
export default function CompetencyReport({ report, steps }) {
  const students = report?.estudiantes ?? []
  const notes = closeNotes(steps)

  return (
    <section aria-label="Evidencia por competencias" className="min-w-0 space-y-4">
      <Card
        title="Evidencia por competencias"
        description={`${report?.competencia?.nombre ?? COMPETENCY_NAME} · Currículo Nacional, primaria`}
        variant="accent"
        className="border-[#B7E8B5]"
      >
        <Alert tone="info" compact>
          {FORMATIVE_NOTE}
        </Alert>
        {report?.problema?.text && <p className="mt-3 break-words text-sm text-[#5A6B6A]">Problema: {report.problema.text}</p>}
        {notes.map((note) => (
          <Alert key={note} tone="warning" compact className="mt-3">
            {note}
          </Alert>
        ))}
      </Card>

      {students.length === 0 ? (
        <Card title="Sin participantes">
          <p className="text-sm text-[#5A6B6A]">No se registró a nadie hablando en esta sesión, así que no hay evidencia que mostrar.</p>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {students.map((student) => (
            <Card
              key={student.key}
              title={student.name}
              description={`Habló ${student.resumen?.talkPct ?? 0}% del tiempo · ${student.resumen?.turns ?? 0} ${student.resumen?.turns === 1 ? 'turno' : 'turnos'}`}
              className="min-w-0"
            >
              <ul className="space-y-4" aria-label={`Capacidades de ${student.name}`}>
                {student.capacidades.map((capability) => {
                  const meta = stateMeta(capability.estado)
                  return (
                    <li key={capability.id} className="min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-semibold text-[#304744]">{capability.nombre}</p>
                        <Badge tone={meta.tone} size="sm" className="shrink-0">
                          {meta.label}
                        </Badge>
                      </div>
                      {capability.nota && <p className="mt-1 break-words text-xs text-[#5A6B6A]">{capability.nota}</p>}
                      {capability.evidencias?.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {capability.evidencias.map((evidence) => (
                            <li key={`${evidence.t}-${evidence.cita}`} className="break-words rounded-lg bg-[#F8FAF6] px-3 py-2 text-xs text-[#304744]">
                              <span className="mr-1.5 font-mono text-[#7D8C8A]">{clock(evidence.t)}</span>«{evidence.cita}»
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

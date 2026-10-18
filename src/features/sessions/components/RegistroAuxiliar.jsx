import { useState } from 'react'
import { Alert, Button, Card } from '@/components/ui'
import { printReport } from '../lib/reportDocument'
import { BIMESTRES, CAPABILITY_COLUMN, GRADES, REGISTRO_NOTE, downloadRegistroAuxiliar } from '../lib/registroAuxiliar'

const SHORT = Object.freeze({ traduce: 'Traduce', comunica: 'Comunica', 'usa-estrategias': 'Usa estrategias', argumenta: 'Argumenta' })

/**
 * «Descargar registro auxiliar (Excel)»: lleva la evidencia del reporte al formato del registro auxiliar de Matemática (una hoja
 * por bimestre) para que el docente lo tenga listo. KoEduko aporta evidencia, NO calificativos: los AD/A/B/C solo se escriben si el
 * docente los elige aquí; LOGRO queda siempre vacío.
 *
 * @param {{ report: object, sessionId: string, download?: typeof downloadRegistroAuxiliar }} props
 */
export default function RegistroAuxiliar({ report, sessionId, download = downloadRegistroAuxiliar, print = printReport }) {
  const students = report?.estudiantes ?? []
  const [bimestre, setBimestre] = useState(1)
  const [grades, setGrades] = useState({})
  const [state, setState] = useState({ phase: 'idle', message: '' })

  if (students.length === 0) return null

  const setGrade = (studentKey, capabilityId, value) =>
    setGrades((current) => ({ ...current, [studentKey]: { ...current[studentKey], [capabilityId]: value } }))

  const handleDownload = async () => {
    setState({ phase: 'working', message: '' })
    try {
      const name = await download({ report, sessionId, bimestre, grades })
      setState({ phase: 'done', message: `Listo: ${name ?? 'registro descargado'}.` })
    } catch {
      setState({ phase: 'error', message: 'No se pudo generar el Excel. Inténtalo de nuevo.' })
    }
  }

  const handlePrint = () => {
    try {
      print({ report, sessionId })
      setState({ phase: 'done', message: 'Se abrió el reporte: en el diálogo de impresión elige «Guardar como PDF».' })
    } catch (error) {
      setState({ phase: 'error', message: error?.message || 'No se pudo abrir el reporte.' })
    }
  }

  return (
    <Card title="Descargas para el docente" description="La evidencia de esta sesión: registro auxiliar de Matemática (Excel) y reporte para imprimir o guardar como PDF.">
      <Alert tone="info" compact>{REGISTRO_NOTE}</Alert>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="text-sm font-semibold text-[#304744]">
          Bimestre
          <select
            value={bimestre}
            onChange={(event) => setBimestre(Number(event.target.value))}
            className="mt-1 block rounded-xl border border-[#D7E0D5] bg-white px-3 py-2 text-sm font-normal text-[#304744]"
          >
            {BIMESTRES.map((n) => (
              <option key={n} value={n}>{`Bimestre ${n}`}</option>
            ))}
          </select>
        </label>
        <Button icon="download" loading={state.phase === 'working'} disabled={state.phase === 'working'} onClick={handleDownload}>
          Descargar registro auxiliar (Excel)
        </Button>
        <Button variant="secondary" icon="external" onClick={handlePrint}>
          Descargar reporte (PDF)
        </Button>
      </div>

      <details className="mt-4 rounded-xl border border-[#E8EFE6] px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-[#304744]">Calificativos (opcional): solo lo que tú elijas se escribe en el Excel</summary>
        <div className="mt-3 space-y-4">
          {students.map((student) => (
            <fieldset key={student.key} className="min-w-0">
              <legend className="text-sm font-semibold text-[#304744]">{student.name}</legend>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.keys(CAPABILITY_COLUMN).map((capabilityId) => (
                  <label key={capabilityId} className="text-xs text-[#5A6B6A]">
                    {SHORT[capabilityId]}
                    <select
                      aria-label={`${SHORT[capabilityId]} de ${student.name}`}
                      value={grades[student.key]?.[capabilityId] ?? ''}
                      onChange={(event) => setGrade(student.key, capabilityId, event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-[#D7E0D5] bg-white px-2 py-1.5 text-sm text-[#304744]"
                    >
                      <option value="">—</option>
                      {GRADES.map((grade) => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </details>

      {state.phase === 'done' && <Alert tone="success" compact className="mt-3">{state.message}</Alert>}
      {state.phase === 'error' && <Alert tone="error" compact className="mt-3">{state.message}</Alert>}
    </Card>
  )
}

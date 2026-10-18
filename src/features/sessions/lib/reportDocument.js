/**
 * Reporte de la sesión como documento imprimible (A4) para guardar como PDF. Sin dependencias: se arma un HTML autónomo y el
 * navegador lo imprime o lo guarda como PDF. Es EVIDENCIA FORMATIVA: nunca una nota; la calificación es del docente.
 *
 * Todo lo que viene de la sesión (nombres, citas) se escapa: una cita es lo que dijo un niño, jamás se inserta como HTML.
 */

import { clock } from './competency'

export const REPORT_NOTE = 'Evidencia formativa. Los calificativos los decide el docente antes de registrarlos en el SIAGIE.'

const STATE_LABEL = Object.freeze({ 'con evidencia': 'Con evidencia', 'evidencia parcial': 'Evidencia parcial', 'sin evidencia suficiente': 'Sin evidencia suficiente' })

export const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const dateText = (date) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)

/** @param {{ report: object, sessionId: string, now?: Date }} input @returns {string} documento HTML completo */
export function reportHtml({ report, sessionId, now = new Date() }) {
  const students = Array.isArray(report?.estudiantes) ? report.estudiantes : []
  const body = students
    .map((student) => {
      const rows = (student.capacidades ?? [])
        .map((capability) => {
          const quotes = (capability.evidencias ?? [])
            .map((evidence) => `<li><span class="min">${escapeHtml(clock(evidence.t))}</span> «${escapeHtml(evidence.cita)}»</li>`)
            .join('')
          return `<tr><td class="cap">${escapeHtml(capability.nombre)}</td><td class="state">${escapeHtml(STATE_LABEL[capability.estado] ?? capability.estado)}</td><td>${quotes ? `<ul>${quotes}</ul>` : '<span class="muted">—</span>'}${capability.nota ? `<p class="muted">${escapeHtml(capability.nota)}</p>` : ''}</td></tr>`
        })
        .join('')
      return `<section class="student"><h2>${escapeHtml(student.name)}</h2><p class="muted">Habló ${escapeHtml(student.resumen?.talkPct ?? 0)}% del tiempo · ${escapeHtml(student.resumen?.turns ?? 0)} turnos</p><table><thead><tr><th>Capacidad</th><th>Estado</th><th>Evidencia (minuto de la sesión)</th></tr></thead><tbody>${rows}</tbody></table></section>`
    })
    .join('')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Evidencia por competencias · ${escapeHtml(sessionId)}</title>
<style>
  @page { size: A4; margin: 16mm }
  body { font-family: system-ui, Arial, sans-serif; color: #223348; font-size: 12px; line-height: 1.45 }
  h1 { font-size: 20px; margin: 0 0 2px } h2 { font-size: 15px; margin: 18px 0 2px }
  .muted { color: #5a6b6a; margin: 2px 0 } .note { background: #fff4dd; border: 1px solid #f2d79a; padding: 8px 10px; border-radius: 6px; margin: 10px 0 }
  table { width: 100%; border-collapse: collapse; margin-top: 6px } th, td { border: 1px solid #d7e0d5; padding: 6px 8px; vertical-align: top; text-align: left }
  th { background: #eaf2f8 } td.cap { width: 34% } td.state { width: 16%; font-weight: 600 } ul { margin: 0; padding-left: 16px } .min { font-family: monospace; color: #7d8c8a }
  .student { break-inside: avoid } footer { margin-top: 18px; font-size: 11px; color: #5a6b6a }
</style></head><body>
<h1>Evidencia por competencias</h1>
<p class="muted">${escapeHtml(report?.competencia?.nombre ?? 'Resuelve problemas de cantidad')} · Currículo Nacional, primaria</p>
${report?.problema?.text ? `<p><strong>Problema:</strong> ${escapeHtml(report.problema.text)}</p>` : ''}
<p class="note">${escapeHtml(REPORT_NOTE)}</p>
${body || '<p class="muted">No se registró a nadie hablando en esta sesión, así que no hay evidencia que mostrar.</p>'}
<footer>Fuente: KoEduko, sesión ${escapeHtml(sessionId)}, ${escapeHtml(dateText(now))}.</footer>
</body></html>`
}

/** Abre el documento en otra pestaña y abre el diálogo de imprimir (allí se elige «Guardar como PDF»). */
export function printReport({ report, sessionId, now = new Date(), open = (...args) => window.open(...args) }) {
  const win = open('', '_blank')
  if (!win) throw new Error('El navegador bloqueó la ventana del reporte.')
  win.document.open()
  win.document.write(reportHtml({ report, sessionId, now }))
  win.document.close()
  win.focus()
  win.print()
}

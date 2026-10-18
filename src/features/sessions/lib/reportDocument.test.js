import { describe, expect, it, vi } from 'vitest'
import { REPORT_NOTE, escapeHtml, printReport, reportHtml } from './reportDocument'

const NOW = new Date(2026, 9, 18, 9, 0, 0)
const report = {
  competencia: { nombre: 'Resuelve problemas de cantidad' },
  problema: { text: 'Hay 7 bolsas con 10 caramelos cada una.' },
  estudiantes: [
    {
      key: 'ana', name: 'Ana Torres', resumen: { talkPct: 62, turns: 4 },
      capacidades: [
        { id: 'traduce', nombre: 'Traduce cantidades a expresiones numéricas', estado: 'con evidencia', evidencias: [{ t: 24, cita: 'siete por diez' }] },
        { id: 'argumenta', nombre: 'Argumenta relaciones numéricas y operaciones', estado: 'sin evidencia suficiente', evidencias: [], nota: 'Mostró dificultad.' },
      ],
    },
  ],
}

describe('reportHtml', () => {
  it('has the competency, the problem, each student with the state of each capability, the quote with its minute and the source', () => {
    const html = reportHtml({ report, sessionId: 'accept-mem-1', now: NOW })
    expect(html).toContain('Evidencia por competencias')
    expect(html).toContain('Hay 7 bolsas con 10 caramelos cada una.')
    expect(html).toContain('Ana Torres')
    expect(html).toContain('Con evidencia')
    expect(html).toContain('Sin evidencia suficiente')
    expect(html).toContain('0:24')
    expect(html).toContain('«siete por diez»')
    expect(html).toContain('Fuente: KoEduko, sesión accept-mem-1, 18/10/2026.')
  })

  it('states that it is formative evidence and never shows a grade', () => {
    const html = reportHtml({ report, sessionId: 's1', now: NOW })
    expect(html).toContain(REPORT_NOTE)
    expect(html.replace(REPORT_NOTE, '')).not.toMatch(/\b(AD|Nota:|Calificación:)\b/)
  })

  it('escapes everything that comes from the session: a quote is what a child said, never HTML', () => {
    const hostile = { estudiantes: [{ key: 'x', name: '<img src=x onerror=alert(1)>', resumen: {}, capacidades: [{ id: 'traduce', nombre: 'T', estado: 'con evidencia', evidencias: [{ t: 1, cita: '<script>alert("x")</script>' }] }] }], problema: { text: '<b>hola</b>' } }
    const html = reportHtml({ report: hostile, sessionId: '<id>', now: NOW })
    expect(html).not.toMatch(/<script>|<img |<b>hola/)
    expect(html).toContain('&lt;script&gt;')
    expect(escapeHtml(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;')
  })

  it('works with an empty or missing report', () => {
    expect(reportHtml({ report: { estudiantes: [] }, sessionId: 's', now: NOW })).toContain('No se registró a nadie hablando')
    expect(() => reportHtml({ report: null, sessionId: 's', now: NOW })).not.toThrow()
  })
})

describe('printReport', () => {
  it('writes the document in a new window and opens the print dialog (where the PDF is saved)', () => {
    const win = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() }
    printReport({ report, sessionId: 's1', now: NOW, open: () => win })
    expect(win.document.write).toHaveBeenCalledWith(expect.stringContaining('Evidencia por competencias'))
    expect(win.print).toHaveBeenCalledTimes(1)
  })

  it('explains it when the browser blocks the window', () => {
    expect(() => printReport({ report, sessionId: 's1', open: () => null })).toThrow(/bloque/)
  })
})

import ExcelJS from 'exceljs'
import { describe, expect, it, vi } from 'vitest'
import { BIMESTRES, REGISTRO_NOTE, buildRegistroWorkbook, downloadRegistroAuxiliar, observationsFor, registroFileName } from './registroAuxiliar'

const NOW = new Date(2026, 9, 18, 9, 0, 0)
const report = {
  problema: { text: 'Hay 7 bolsas con 10 caramelos cada una. ¿Cuántos caramelos hay en total?' },
  estudiantes: [
    {
      key: 'ana torres',
      name: 'Ana Torres',
      capacidades: [
        { id: 'traduce', nombre: 'Traduce cantidades a expresiones numéricas', estado: 'con evidencia', evidencias: [{ t: 24, cita: 'siete por diez' }] },
        { id: 'comunica', nombre: 'Comunica su comprensión sobre números y operaciones', estado: 'evidencia parcial', evidencias: [{ t: 65, cita: 'creo que es mucho' }] },
        { id: 'usa-estrategias', nombre: 'Usa estrategias de estimación y cálculo', estado: 'sin evidencia suficiente', evidencias: [] },
        { id: 'argumenta', nombre: 'Argumenta relaciones numéricas y operaciones', estado: 'sin evidencia suficiente', evidencias: [] },
      ],
    },
    { key: 'luis perez', name: 'Luis Pérez', capacidades: [{ id: 'traduce', nombre: 'Traduce cantidades a expresiones numéricas', estado: 'sin evidencia suficiente', evidencias: [] }] },
  ],
}

async function roundTrip(options) {
  const buffer = await buildRegistroWorkbook({ ExcelJS, report, sessionId: 'accept-mem-1', now: NOW, ...options }).xlsx.writeBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  return wb
}

describe('registro auxiliar', () => {
  it('writes the name in B6 and leaves the grades C6:F6 and LOGRO G6 empty when the teacher chose nothing', async () => {
    const sheet = (await roundTrip()).getWorksheet('Bimestre 1')
    expect(sheet.getCell('B6').value).toBe('Ana Torres')
    expect(sheet.getCell('B7').value).toBe('Luis Pérez')
    for (const cell of ['C6', 'D6', 'E6', 'F6', 'G6']) expect(sheet.getCell(cell).value).toBeNull()
  })

  it('writes ONLY the grades the teacher chose, in the right capability column', async () => {
    const sheet = (await roundTrip({ grades: { 'ana torres': { traduce: 'A', argumenta: 'B', comunica: 'X' } } })).getWorksheet('Bimestre 1')
    expect(sheet.getCell('C6').value).toBe('A')
    expect(sheet.getCell('D6').value).toBeNull() // «X» no es un calificativo
    expect(sheet.getCell('E6').value).toBeNull()
    expect(sheet.getCell('F6').value).toBe('B')
    expect(sheet.getCell('G6').value).toBeNull() // LOGRO: siempre del docente
    expect(sheet.getCell('C7').value).toBeNull() // otro estudiante sin elección
  })

  it('puts in OBSERVACIONES the state of each capability, one short quote with its minute, and the source', async () => {
    const text = (await roundTrip()).getWorksheet('Bimestre 1').getCell('W6').value
    expect(text).toContain('Traduce: con evidencia — «siete por diez» (min 0:24)')
    expect(text).toContain('Comunica: evidencia parcial — «creo que es mucho» (min 1:05)')
    expect(text).toContain('Usa estrategias: sin evidencia suficiente')
    expect(text).toContain('sin evidencia suficiente')
    expect(text).toContain('Fuente: KoEduko, sesión accept-mem-1, 18/10/2026')
  })

  it('fills only the chosen bimestre and keeps the format of the others (headers, merges, validation, LOGRO columns)', async () => {
    const wb = await roundTrip({ bimestre: 3 })
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4'])
    expect(wb.getWorksheet('Bimestre 3').getCell('B6').value).toBe('Ana Torres')
    expect(wb.getWorksheet('Bimestre 1').getCell('B6').value).toBeNull()
    const one = wb.getWorksheet('Bimestre 1')
    expect(one.getCell('A1').value).toBe('REGISTRO AUXILIAR DE EVALUACIÓN · MATEMÁTICA · BIMESTRE 1')
    expect(one.getCell('C4').value).toBe('1. CANTIDAD')
    expect(one.getCell('G5').value).toBe('LOGRO')
    expect(one.getCell('W4').value).toBe('OBSERVACIONES')
    expect(one.getCell('C6').dataValidation).toMatchObject({ type: 'list', formulae: ['"AD,A,B,C"'] })
    expect(one.views[0]).toMatchObject({ state: 'frozen', ySplit: 5 })
  })

  it('shows the formative note, and never writes a real name from a template (there is none)', async () => {
    const sheet = (await roundTrip()).getWorksheet('Bimestre 1')
    expect(sheet.getCell('A44').value).toBe(REGISTRO_NOTE)
    expect(REGISTRO_NOTE).toMatch(/Los calificativos los decide el docente antes de registrarlos en el SIAGIE/)
    const names = []
    sheet.getColumn('B').eachCell((cell, row) => row >= 6 && row < 44 && cell.value && names.push(cell.value))
    expect(names).toEqual(['Ana Torres', 'Luis Pérez'])
  })

  it('falls back to bimestre 1 for an invalid one, and names the file after the session and the bimestre', async () => {
    expect((await roundTrip({ bimestre: 9 })).getWorksheet('Bimestre 1').getCell('B6').value).toBe('Ana Torres')
    expect(registroFileName('accept-mem-1', 2)).toBe('registro-auxiliar-accept-mem-1-bimestre2.xlsx')
    expect(registroFileName('a/b c', 1)).toBe('registro-auxiliar-a_b_c-bimestre1.xlsx')
    expect(BIMESTRES).toEqual([1, 2, 3, 4])
  })

  it('tolerates an empty report and a student without quotes', () => {
    expect(() => buildRegistroWorkbook({ ExcelJS, report: { estudiantes: [] }, sessionId: 's', now: NOW })).not.toThrow()
    expect(() => buildRegistroWorkbook({ ExcelJS, report: null, sessionId: 's', now: NOW })).not.toThrow()
    expect(observationsFor({ capacidades: [] }, { sessionId: 's1', now: NOW })).toBe('Fuente: KoEduko, sesión s1, 18/10/2026')
  })

  it('downloadRegistroAuxiliar builds the file and hands it to the saver with the right name', async () => {
    const save = vi.fn()
    await downloadRegistroAuxiliar({ report, sessionId: 'accept-mem-1', bimestre: 2, grades: {}, now: NOW, load: async () => ({ default: ExcelJS }), save })
    const [buffer, name] = save.mock.calls[0]
    expect(name).toBe('registro-auxiliar-accept-mem-1-bimestre2.xlsx')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    expect(wb.getWorksheet('Bimestre 2').getCell('B6').value).toBe('Ana Torres')
  })
})

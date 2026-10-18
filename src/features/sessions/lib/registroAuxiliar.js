/**
 * Registro auxiliar de evaluación de Matemática (Excel), llenado con la evidencia del reporte de cierre.
 *
 * Reproduce la ESTRUCTURA del formato que usan los docentes (una hoja por bimestre; por competencia sus cuatro capacidades y una
 * columna LOGRO; observaciones al final). La plantilla original NO está en el repositorio: trae nombres reales de alumnos y no se
 * versiona; aquí solo se arma la misma estructura.
 *
 * Regla de oro: KoEduko aporta EVIDENCIA, no calificativos. Las columnas de capacidad (AD/A/B/C) quedan vacías salvo que el docente
 * haya elegido un calificativo en pantalla, y LOGRO queda siempre vacío: lo decide el docente antes de registrarlo en el SIAGIE.
 */

import { clock } from './competency'

export const REGISTRO_NOTE = 'Evidencia formativa. Los calificativos los decide el docente antes de registrarlos en el SIAGIE.'
export const GRADES = Object.freeze(['AD', 'A', 'B', 'C'])
export const BIMESTRES = Object.freeze([1, 2, 3, 4])
export const FIRST_STUDENT_ROW = 6
const LAST_ROW_WITH_VALIDATION = 42

/** Columna de cada capacidad que documenta KoEduko (competencia 1, «Cantidad»). */
export const CAPABILITY_COLUMN = Object.freeze({ traduce: 'C', comunica: 'D', 'usa-estrategias': 'E', argumenta: 'F' })

const COMPETENCIES = Object.freeze([
  { title: '1. CANTIDAD', fill: 'FFF8DFD8', first: 'C', last: 'G', capacities: ['Traduce\ncantidades a\nexpresiones\nnuméricas', 'Comunica su\ncomprensión\nsobre números\ny operaciones', 'Usa\nestrategias de\nestimación y\ncálculo', 'Argumenta\nrelaciones\nnuméricas y\noperaciones'] },
  { title: '2. REGULARIDAD, EQUIVALENCIA Y CAMBIO', fill: 'FFE0E8F7', first: 'H', last: 'L', capacities: ['Traduce datos\na expresiones\nalgebraicas y\ngráficas', 'Comunica su\ncomprensión de\nrelaciones\nalgebraicas', 'Usa\nestrategias\npara hallar\nequivalencias\ny reglas\ngenerales', 'Argumenta\nrelaciones de\ncambio y\nequivalencia'] },
  { title: '3. FORMA, MOVIMIENTO Y LOCALIZACIÓN', fill: 'FFDDF0E7', first: 'M', last: 'Q', capacities: ['Modela objetos\ncon formas\ngeométricas y\ntransformaciones', 'Comunica su\ncomprensión de\nformas y\nrelaciones\ngeométricas', 'Usa\nestrategias\npara medir y\norientarse en\nel espacio', 'Argumenta\nrelaciones\ngeométricas'] },
  { title: '4. GESTIÓN DE DATOS E INCERTIDUMBRE', fill: 'FFF7E8C8', first: 'R', last: 'V', capacities: ['Representa\ndatos con\ngráficos y\nmedidas\nestadísticas o\nprobabilísticas', 'Comunica\nconceptos\nestadísticos y\nprobabilísticos', 'Recopila y\nprocesa datos\ncon\nestrategias y\nprocedimientos', 'Sustenta\nconclusiones\ncon\ninformación\nobtenida'] },
])

const columnLetters = (first, last) => {
  const out = []
  for (let c = first.charCodeAt(0); c <= last.charCodeAt(0); c += 1) out.push(String.fromCharCode(c))
  return out
}

export const registroFileName = (sessionId, bimestre) => `registro-auxiliar-${String(sessionId).replace(/[^A-Za-z0-9_-]/g, '_')}-bimestre${bimestre}.xlsx`

const dateText = (date) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)

const SHORT_LABEL = Object.freeze({ traduce: 'Traduce', comunica: 'Comunica', 'usa-estrategias': 'Usa estrategias', argumenta: 'Argumenta' })

const STATE_LABEL = Object.freeze({ 'con evidencia': 'con evidencia', 'evidencia parcial': 'evidencia parcial', 'sin evidencia suficiente': 'sin evidencia suficiente' })

/**
 * Texto de OBSERVACIONES de un estudiante: por capacidad su estado y, si hay, una cita corta con el minuto; y la fuente.
 * @param {{ capacidades?: { id: string, nombre?: string, estado: string, evidencias?: { t: number, cita: string }[] }[] }} student
 */
export function observationsFor(student, { sessionId, now }) {
  const lines = (student.capacidades ?? [])
    .filter((capability) => CAPABILITY_COLUMN[capability.id])
    .map((capability) => {
      const first = capability.evidencias?.[0]
      const quote = first && first.cita ? ` — «${String(first.cita).slice(0, 80)}» (min ${clock(first.t)})` : ''
      const label = SHORT_LABEL[capability.id] ?? capability.id
      return `${label}: ${STATE_LABEL[capability.estado] ?? capability.estado}${quote}`
    })
  lines.push(`Fuente: KoEduko, sesión ${sessionId}, ${dateText(now)}`)
  return lines.join('\n')
}

function styleSheet(ws, { bimestre }) {
  ws.getColumn('A').width = 7
  ws.getColumn('B').width = 39
  for (const { first, last } of COMPETENCIES) for (const c of columnLetters(first, last)) ws.getColumn(c).width = c === last ? 12 : 15
  ws.getColumn('W').width = 60

  ws.mergeCells('A1:W1')
  ws.getCell('A1').value = `REGISTRO AUXILIAR DE EVALUACIÓN · MATEMÁTICA · BIMESTRE ${bimestre}`
  ws.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } }
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } }
  ws.getCell('A1').alignment = { vertical: 'middle' }
  ws.getRow(1).height = 34

  ws.mergeCells('A2:W2')
  ws.getCell('A2').value = 'Institución educativa: ____________________   |   Grado: ______   |   Sección: ____   |   Año: ______   |   Docente: ____________________'
  ws.getCell('A2').font = { size: 11, color: { argb: 'FF254760' } }
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2F8' } }

  ws.mergeCells('A4:B4')
  ws.getCell('A4').value = 'ESTUDIANTES'
  ws.getCell('A4').font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } }
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getCell('A5').value = 'ESTUDIANTES'

  for (const competency of COMPETENCIES) {
    ws.mergeCells(`${competency.first}4:${competency.last}4`)
    const head = ws.getCell(`${competency.first}4`)
    head.value = competency.title
    head.font = { bold: true, size: 11, color: { argb: 'FF223348' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: competency.fill } }
    head.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    const letters = columnLetters(competency.first, competency.last)
    letters.forEach((letter, i) => {
      const cell = ws.getCell(`${letter}5`)
      cell.value = i === letters.length - 1 ? 'LOGRO' : competency.capacities[i]
      cell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: i === letters.length - 1 ? 90 : 90, wrapText: true }
    })
  }
  ws.mergeCells('W4:W5')
  ws.getCell('W4').value = 'OBSERVACIONES'
  ws.getCell('W4').font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  ws.getCell('W4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } }
  ws.getCell('W4').alignment = { horizontal: 'center', vertical: 'middle' }

  ws.getRow(4).height = 38
  ws.getRow(5).height = 150
  for (let r = FIRST_STUDENT_ROW; r <= LAST_ROW_WITH_VALIDATION; r += 1) {
    ws.getCell(`A${r}`).value = r - FIRST_STUDENT_ROW + 1
    for (const competency of COMPETENCIES) {
      const letters = columnLetters(competency.first, competency.last)
      letters.forEach((letter, i) => {
        const cell = ws.getCell(`${letter}${r}`)
        if (i < 4) {
          // El docente puede elegir AD/A/B/C directamente en el Excel.
          cell.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${GRADES.join(',')}"`] }
          cell.alignment = { horizontal: 'center' }
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF2F7' } }
          cell.font = { bold: true, size: 11 }
          cell.alignment = { horizontal: 'center' }
        }
      })
    }
    ws.getCell(`W${r}`).alignment = { vertical: 'top', wrapText: true }
  }
  ws.views = [{ state: 'frozen', ySplit: 5 }]
}

/**
 * Arma el libro. Solo se llena la hoja del bimestre elegido; las demás quedan con el formato y vacías.
 *
 * @param {{
 *   ExcelJS: any,
 *   report: { estudiantes?: object[] },
 *   sessionId: string,
 *   bimestre?: number,
 *   grades?: Record<string, Record<string, string>>,   calificativos que el DOCENTE eligió: { [claveEstudiante]: { [idCapacidad]: 'AD'|'A'|'B'|'C' } }
 *   now?: Date,
 * }} input
 */
export function buildRegistroWorkbook({ ExcelJS, report, sessionId, bimestre = 1, grades = {}, now = new Date() }) {
  const selected = BIMESTRES.includes(bimestre) ? bimestre : 1
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'KoEduko'

  for (const n of BIMESTRES) styleSheet(workbook.addWorksheet(`Bimestre ${n}`), { bimestre: n })

  const sheet = workbook.getWorksheet(`Bimestre ${selected}`)
  const students = Array.isArray(report?.estudiantes) ? report.estudiantes : []
  students.forEach((student, index) => {
    const row = FIRST_STUDENT_ROW + index
    sheet.getCell(`B${row}`).value = student.name || student.key
    for (const [capabilityId, column] of Object.entries(CAPABILITY_COLUMN)) {
      const grade = grades?.[student.key]?.[capabilityId]
      // SOLO lo que el docente eligio: KoEduko nunca propone ni deduce un calificativo.
      sheet.getCell(`${column}${row}`).value = GRADES.includes(grade) ? grade : null
    }
    sheet.getCell(`G${row}`).value = null // LOGRO: lo decide el docente
    sheet.getCell(`W${row}`).value = observationsFor(student, { sessionId, now })
    sheet.getRow(row).height = Math.max(21, 15 * (String(sheet.getCell(`W${row}`).value).split('\n').length))
  })

  const noteRow = Math.max(FIRST_STUDENT_ROW + students.length + 1, LAST_ROW_WITH_VALIDATION + 2)
  sheet.mergeCells(`A${noteRow}:W${noteRow}`)
  sheet.getCell(`A${noteRow}`).value = REGISTRO_NOTE
  sheet.getCell(`A${noteRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4DD' } }
  sheet.getCell(`A${noteRow}`).font = { italic: true }

  return workbook
}

/** Genera el .xlsx y lo descarga en el navegador. exceljs se carga solo al pedirlo (pesa: no entra al paquete principal). */
export async function downloadRegistroAuxiliar({ report, sessionId, bimestre, grades, now = new Date(), load = () => import('exceljs'), save } = {}) {
  const module = await load()
  const ExcelJS = module.default ?? module
  const workbook = buildRegistroWorkbook({ ExcelJS, report, sessionId, bimestre, grades, now })
  const buffer = await workbook.xlsx.writeBuffer()
  const name = registroFileName(sessionId, bimestre ?? 1)

  if (save) return save(buffer, name)
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
  return name
}

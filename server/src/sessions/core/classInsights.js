/**
 * Acumulado de lo que pasa en TODAS las salas de un docente. PURO.
 *
 * Cada vez que se cierra una sala se suma su reporte aqui (conteos por habilidad y por capacidad: con evidencia / parcial / sin
 * evidencia). Sirve para dos cosas:
 *  - el docente ve de un vistazo que capacidades cuestan mas en sus salas (no tiene que abrir sala por sala);
 *  - el tutor, en una sala nueva, sabe que fue lo mas dificil en las otras y puede orientar mejor su pregunta.
 *
 * Solo conteos: no guarda nombres, citas ni transcripciones. Evidencia formativa, nunca una nota.
 */

import { CAPABILITIES, EVIDENCE_STATE } from './competencies.js'
import { SKILL_LABELS } from './memoryText.js'

export const INSIGHTS_VERSION = 1

const STATE_KEY = Object.freeze({
  [EVIDENCE_STATE.WITH]: 'con',
  [EVIDENCE_STATE.PARTIAL]: 'parcial',
  [EVIDENCE_STATE.NONE]: 'sin',
})

const ALL = '_todas'
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

export const emptyInsights = () => ({ v: INSIGHTS_VERSION, sessions: 0, students: 0, skills: {} })

const emptyBucket = () => Object.fromEntries(CAPABILITIES.map((c) => [c.id, { con: 0, parcial: 0, sin: 0 }]))

/** Copia defensiva: tolera un documento viejo, vacio o malformado. */
function clean(insights) {
  const base = emptyInsights()
  if (!isObject(insights)) return base
  base.sessions = count(insights.sessions)
  base.students = count(insights.students)
  for (const [skill, caps] of Object.entries(isObject(insights.skills) ? insights.skills : {})) {
    if (!isObject(caps)) continue
    base.skills[skill] = emptyBucket()
    for (const { id } of CAPABILITIES) {
      const c = isObject(caps[id]) ? caps[id] : {}
      base.skills[skill][id] = { con: count(c.con), parcial: count(c.parcial), sin: count(c.sin) }
    }
  }
  return base
}

/** Suma un reporte de cierre. Devuelve un acumulado nuevo; el anterior queda igual. */
export function addReport(insights, report) {
  const next = clean(insights)
  const students = Array.isArray(report?.estudiantes) ? report.estudiantes : []
  if (students.length === 0) return next

  next.sessions += 1
  next.students += students.length
  const skill = typeof report?.problema?.skillId === 'string' && report.problema.skillId ? report.problema.skillId : ALL
  next.skills[skill] ??= emptyBucket()
  for (const student of students) {
    for (const capability of student.capacidades ?? []) {
      const key = STATE_KEY[capability.estado]
      const bucket = next.skills[skill][capability.id]
      if (key && bucket) bucket[key] += 1
    }
  }
  return next
}

/** Suma los conteos de una o todas las habilidades. */
function totalsFor(insights, skillId) {
  const data = clean(insights)
  const skills = skillId && data.skills[skillId] ? [data.skills[skillId]] : Object.values(data.skills)
  return CAPABILITIES.map(({ id, nombre }) => {
    const sum = skills.reduce((acc, bucket) => ({ con: acc.con + bucket[id].con, parcial: acc.parcial + bucket[id].parcial, sin: acc.sin + bucket[id].sin }), { con: 0, parcial: 0, sin: 0 })
    const total = sum.con + sum.parcial + sum.sin
    return { id, nombre, ...sum, total, sinPct: total > 0 ? Math.round((sum.sin / total) * 100) : 0 }
  })
}

/** Para el docente: por capacidad, cuantos alumnos con evidencia / parcial / sin, de mas a menos dificil. */
export function summaryForTeacher(insights) {
  const data = clean(insights)
  const capacities = totalsFor(data, null).sort((a, b) => b.sinPct - a.sinPct || b.sin - a.sin)
  const skills = Object.keys(data.skills).filter((s) => s !== ALL).map((id) => ({ id, nombre: SKILL_LABELS[id] ?? id }))
  return { sessions: data.sessions, students: data.students, capacities, skills }
}

/** MIN de observaciones para afirmar algo de las otras salas: con menos es ruido. */
export const MIN_OBSERVATIONS = 3

/**
 * Una linea para el tutor: que fue lo mas dificil en OTRAS salas para esta habilidad. Sin cifras. Vacia si no hay datos suficientes
 * o si nada destaca. Es contexto para orientar la pregunta, no una etiqueta para nadie.
 */
export function describeInsights(insights, skillId) {
  const rows = totalsFor(insights, skillId).filter((r) => r.total >= MIN_OBSERVATIONS)
  if (rows.length === 0) return ''
  const hardest = rows.reduce((top, r) => (r.sinPct > top.sinPct ? r : top))
  if (hardest.sinPct < 50) return ''
  const topic = SKILL_LABELS[skillId] ?? 'matemática'
  return `En otras salas de este curso, lo que más ha costado en ${topic} es: ${hardest.nombre.toLowerCase()}.`
}

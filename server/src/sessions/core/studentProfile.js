/**
 * Perfil estructurado y determinista por estudiante.
 * Solo conteos: por habilidad, cuantas sesiones y cuantos estados; por senal, cuantas veces aparecio.
 * Puro: sin reloj, sin red, sin Firebase. No muta la entrada.
 *
 * `report` es un elemento de report.estudiantes (close-session). La habilidad de la sesion
 * no vive ahi: se lee de report.skillId o report.problema.skillId. Si llega el reporte
 * completo y trae un solo estudiante, se usa ese. Una pareja completa no se mezcla en un perfil.
 */

export const PROFILE_VERSION = 1

/** Senales del motor (signals.js). El resto (CLASIFICADOR, etc.) no entra al perfil. */
export const PROFILE_SIGNALS = Object.freeze(['STUCK', 'SILENT_PEER', 'DOMINANCE', 'WRONG_ANSWER', 'CORRECT_ANSWER'])

const MAX_COUNT = 10000
const STEP = 0.2

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const clampCount = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(MAX_COUNT, Math.floor(n))
}

const emptySkill = () => ({ sessions: 0, conEvidencia: 0, parcial: 0, sinEvidencia: 0 })

/** @returns {{ v: number, sessions: number, skills: object, signals: object }} */
export function emptyProfile() {
  return { v: PROFILE_VERSION, sessions: 0, skills: {}, signals: {} }
}

function cloneSkills(skills) {
  if (!isObject(skills)) return {}
  const next = {}
  for (const [id, bucket] of Object.entries(skills)) {
    if (!id || !isObject(bucket)) continue
    next[id] = {
      sessions: clampCount(bucket.sessions),
      conEvidencia: clampCount(bucket.conEvidencia),
      parcial: clampCount(bucket.parcial),
      sinEvidencia: clampCount(bucket.sinEvidencia),
    }
  }
  return next
}

function cloneSignals(signals) {
  if (!isObject(signals)) return {}
  const next = {}
  for (const type of PROFILE_SIGNALS) {
    const count = clampCount(signals[type])
    if (count > 0) next[type] = count
  }
  return next
}

function cloneProfile(profile) {
  if (!isObject(profile)) return emptyProfile()
  return {
    v: PROFILE_VERSION,
    sessions: clampCount(profile.sessions),
    skills: cloneSkills(profile.skills),
    signals: cloneSignals(profile.signals),
  }
}

function skillIdOf(report) {
  const id = report?.skillId ?? report?.problema?.skillId ?? report?.problem?.skillId
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

/** Un estudiante, nunca una pareja mezclada. */
function studentOf(report) {
  if (!isObject(report)) return null
  if (Array.isArray(report.estudiantes)) {
    return report.estudiantes.length === 1 && isObject(report.estudiantes[0]) ? report.estudiantes[0] : null
  }
  if (Array.isArray(report.capacidades) || report.key || report.resumen) return report
  return null
}

function signalsOf(student) {
  const found = []
  const caps = Array.isArray(student?.capacidades) ? student.capacidades : []
  for (const cap of caps) {
    const list = cap?.señales ?? cap?.senales
    if (!Array.isArray(list)) continue
    for (const signal of list) {
      const type = String(signal ?? '').toUpperCase()
      if (PROFILE_SIGNALS.includes(type)) found.push(type)
    }
  }
  return found
}

function addState(bucket, estado) {
  const state = String(estado ?? '').toLowerCase()
  if (state.includes('sin evidencia')) bucket.sinEvidencia = clampCount(bucket.sinEvidencia + 1)
  else if (state.includes('parcial')) bucket.parcial = clampCount(bucket.parcial + 1)
  else if (state.includes('con evidencia')) bucket.conEvidencia = clampCount(bucket.conEvidencia + 1)
}

/**
 * Suma una sesion. Devuelve un perfil nuevo; `previous` queda igual.
 * Entrada malformada: devuelve una copia del perfil anterior, sin sumar y sin lanzar.
 *
 * @param {object} [previous]
 * @param {object} [report] elemento de estudiantes, o el reporte completo de un solo estudiante
 */
export function profileFromReport(previous = emptyProfile(), report = {}) {
  const profile = cloneProfile(previous)
  const student = studentOf(report)
  if (!student) return profile

  profile.sessions = clampCount(profile.sessions + 1)

  const skillId = skillIdOf(report) ?? skillIdOf(student)
  if (skillId) {
    const bucket = profile.skills[skillId] ?? emptySkill()
    bucket.sessions = clampCount(bucket.sessions + 1)
    const caps = Array.isArray(student.capacidades) ? student.capacidades : []
    for (const cap of caps) addState(bucket, cap?.estado)
    profile.skills[skillId] = bucket
  }

  for (const type of signalsOf(student)) {
    profile.signals[type] = clampCount((profile.signals[type] ?? 0) + 1)
  }
  return profile
}

/** Un paso hacia abajo, nunca mas del 20 % del valor base. */
function stepDown(base) {
  if (!Number.isFinite(base)) return base
  const delta = Math.abs(base) * STEP
  const next = base - delta
  return Math.min(base + delta, Math.max(base - delta, next))
}

/**
 * Tabla fija, no aprendizaje. Cada ajuste es un solo paso y esta acotado al 20 % del valor base.
 * Un perfil vacio (o sin senales) devuelve un config igual al base. No toca cooldownSec ni disabledSignals.
 *
 * - SILENT_PEER: baja silentPeerRatio y minPresenceSec. Quien ya se callo se nota antes, sin acusar al instante.
 * - DOMINANCE: baja dominanceRatio. Quien ya acaparo la palabra se nota antes.
 * - STUCK en la habilidad pedida, con mas "sin evidencia" que "con evidencia": achica windowSec.
 *   La confusion repetida en esa habilidad no espera la ventana completa.
 *
 * @param {object} [baseConfig]
 * @param {object} [profile]
 * @param {{ skillId?: string }} [options]
 */
export function adjustConfig(baseConfig = {}, profile = emptyProfile(), { skillId } = {}) {
  const cfg = isObject(baseConfig) ? baseConfig : {}
  const next = { ...cfg }
  const signals = cloneSignals(profile?.signals)
  const skill = skillId && isObject(profile?.skills) ? cloneSkills(profile.skills)[skillId] : null

  if (signals.SILENT_PEER >= 1) {
    if (Number.isFinite(cfg.silentPeerRatio)) next.silentPeerRatio = stepDown(cfg.silentPeerRatio)
    if (Number.isFinite(cfg.minPresenceSec)) next.minPresenceSec = stepDown(cfg.minPresenceSec)
  }
  if (signals.DOMINANCE >= 1 && Number.isFinite(cfg.dominanceRatio)) {
    next.dominanceRatio = stepDown(cfg.dominanceRatio)
  }
  if (signals.STUCK >= 1 && skill && skill.sinEvidencia > skill.conEvidencia && Number.isFinite(cfg.windowSec)) {
    next.windowSec = stepDown(cfg.windowSec)
  }

  next.cooldownSec = cfg.cooldownSec
  next.disabledSignals = cfg.disabledSignals
  return next
}

const sentence = (text) => (text.endsWith('.') ? text : `${text}.`)

/**
 * Una a tres frases factuales, en espanol, sin cifras y sin nombres.
 * No interpola texto del reporte: solo elige frases fijas a partir de conteos.
 *
 * @param {object} [profile]
 * @param {{ skillId?: string }} [options]
 * @returns {string}
 */
export function describeProfile(profile = emptyProfile(), { skillId } = {}) {
  const signals = cloneSignals(profile?.signals)
  const skill = skillId && isObject(profile?.skills) ? cloneSkills(profile.skills)[skillId] : null
  const phrases = []

  if (signals.SILENT_PEER >= 1) phrases.push(sentence('Suele participar poco cuando trabaja en pareja'))
  if (signals.DOMINANCE >= 1) phrases.push(sentence('Suele ocupar casi toda la conversacion'))
  if (signals.STUCK >= 1) phrases.push(sentence('Se traba con frecuencia al plantear el problema'))
  if (phrases.length < 3 && signals.WRONG_ANSWER > signals.CORRECT_ANSWER) {
    phrases.push(sentence('Se equivoca mas seguido de lo que acierta'))
  }
  if (phrases.length < 3 && skill && skill.sinEvidencia > skill.conEvidencia) {
    phrases.push(sentence('En esta habilidad falta evidencia de lo que sabe'))
  }

  return phrases.slice(0, 3).join(' ') || 'Sin patrones claros aun.'
}

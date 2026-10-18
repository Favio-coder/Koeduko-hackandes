/**
 * Roles de una sala segun el diagnostico: quien puede guiar, quien esta aprendiendo y de que tema. PURO.
 *
 * El algoritmo de emparejamiento arma parejas por complementariedad, pero esa informacion no llegaba al tutor: sabia
 * "hablan de multiplicacion" y nada de quien la domina. Con esto el tutor puede preguntar mejor (pedirle a quien domina el
 * tema que lo explique con sus palabras, o a quien lo esta aprendiendo que cuente que parte no ve).
 *
 * Es una pista para orientar la pregunta, NUNCA una etiqueta que el nino vea: se guarda en un documento solo del servidor
 * y el tutor tiene prohibido decir el nivel, "guia" o "aprendiz" de alguien.
 */

import { displayName } from './interventionPolicy.js'
import { SKILL_LABELS } from './memoryText.js'
import { normalizeName } from './participants.js'

export const ROLE = Object.freeze({ GUIDE: 'guia', LEARNER: 'aprendiz', PEER: 'par' })

/** Diferencia minima de dominio (0-1) para hablar de guia y aprendiz; menos que eso es un nivel parecido. */
export const MIN_GAP = 0.15

const isMastery = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

/**
 * @param {{
 *   members: { studentId: string, displayName?: string }[],
 *   mastery: Record<string, number|null|undefined>,   // dominio (0-1) de cada estudiante en el tema
 *   skillId: string|null,
 * }} input
 * @returns {{ topic: string, roles: Record<string, { role: string, mastery: number|null }> } | null}
 *   `roles` va por nombre normalizado (el mismo que usa el motor para identificar a cada persona en Meet).
 */
export function rolesOf({ members = [], mastery = {}, skillId = null }) {
  if (!skillId || !Array.isArray(members) || members.length < 2) return null
  const people = members
    .map((member) => ({ key: normalizeName(member?.displayName), mastery: isMastery(mastery[member?.studentId]) ? mastery[member.studentId] : null }))
    .filter((person) => person.key)
  const known = people.filter((person) => person.mastery !== null).sort((a, b) => b.mastery - a.mastery)
  if (people.length < 2 || known.length < 2) return null

  const top = known[0]
  const bottom = known.at(-1)
  const spread = top.mastery - bottom.mastery
  const roleOf = (person) => {
    if (person.mastery === null || spread < MIN_GAP) return ROLE.PEER
    if (person === top) return ROLE.GUIDE
    if (person === bottom) return ROLE.LEARNER
    return ROLE.PEER
  }
  return { topic: skillId, roles: Object.fromEntries(people.map((person) => [person.key, { role: roleOf(person), mastery: person.mastery }])) }
}

/** Busca la entrada de una persona de Meet: por nombre exacto o, si el nombre en Meet cambia un poco, por el primer nombre. */
export function roleEntryFor(context, participantKey) {
  const roles = context?.roles
  if (!roles || !participantKey) return null
  if (roles[participantKey]) return roles[participantKey]
  const first = String(participantKey).split(' ')[0]
  const matches = Object.entries(roles).filter(([key]) => key.split(' ')[0] === first)
  return matches.length === 1 ? matches[0][1] : null
}

/**
 * Linea para el prompt del tutor, sin cifras. Solo con personas que estan en la sala. Vacia si no hay nada util.
 * @param {{ topic?: string, roles?: object }|null} context
 * @param {string[]} present claves de las personas en la sala
 */
export function describeRoles(context, present = []) {
  if (!context?.roles) return ''
  const topic = SKILL_LABELS[context.topic] ?? 'este tema'
  const here = present.map((key) => ({ key, entry: roleEntryFor(context, key) })).filter((p) => p.entry)
  if (here.length < 2) return ''
  const name = (p) => displayName(p.key) ?? p.key

  const guides = here.filter((p) => p.entry.role === ROLE.GUIDE).map(name)
  const learners = here.filter((p) => p.entry.role === ROLE.LEARNER).map(name)
  if (guides.length === 0 || learners.length === 0) return `Según el diagnóstico, tienen un nivel parecido en ${topic}: conviene que se expliquen entre ellos.`
  return `Según el diagnóstico, ${guides.join(' y ')} maneja mejor ${topic} y ${learners.join(' y ')} lo está aprendiendo.`
}

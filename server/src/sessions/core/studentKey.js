import { createHash } from 'node:crypto'
import { foldText } from './text.js'

/**
 * Clave con la que se recuerda a un estudiante entre sesiones. Pura y determinista.
 *
 *  - Si el participante esta enlazado a un estudiante (su uid de Firebase Auth), la clave ES ese uid.
 *  - Si no, "<scope>:<hash>", donde scope es el classroomId de la sesion o, si no tiene, el uid del
 *    docente que la creo, y hash es sha256(scope + nombre normalizado) recortado a 16 hex.
 *
 * Nunca incluye el correo ni el nombre: el nombre de Meet puede ser el nombre completo de un nino
 * y esta clave termina en un servicio externo. El hash es PSEUDONIMO, no anonimo: los nombres son
 * faciles de adivinar, asi que quien conozca el scope podria comprobar un nombre concreto. Por eso
 * el scope va dentro del hash (el mismo nombre en dos aulas da claves distintas).
 *
 * @param {{ studentId?: string|null, participantKey?: string|null, scope?: string|null }} input
 * @returns {string|null} null si no hay con que armarla (sin uid, sin nombre o sin scope)
 */
export function studentKeyOf({ studentId = null, participantKey = null, scope = null }) {
  if (typeof studentId === 'string' && studentId.trim()) return studentId.trim()

  const name = foldText(String(participantKey ?? ''))
  const owner = typeof scope === 'string' ? scope.trim() : ''
  if (!name || !owner) return null

  const digest = createHash('sha256').update(`${owner}\u0000${name}`).digest('hex').slice(0, 16)
  return `${owner}:${digest}`
}

/**
 * Nombre del campo de live/state.memory donde se cachea lo recordado de un estudiante durante la sesion.
 * Un uid o un "<scope>:<hash>" solo difieren de un nombre de campo seguro en el ":", que se reemplaza.
 */
export const memoryCacheKey = (studentKey) => String(studentKey).replace(/[^A-Za-z0-9_-]/g, '_')

/** El scope de una sesion: su aula, o el docente que la creo. */
export const memoryScopeOf = (session) => session?.classroomId ?? session?.createdBy ?? null

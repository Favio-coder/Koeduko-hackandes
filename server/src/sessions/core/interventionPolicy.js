/**
 * Politica pedagogica del tutor. PURA: sin red ni reloj. Decide como se le habla al estudiante
 * y rechaza cualquier mensaje que rompa las reglas, venga de Gemini o no.
 *
 * Reglas (skill tutor-agent): maximo 2 oraciones y 220 caracteres, nunca la respuesta, una
 * pregunta socratica sobre el problema actual, y nombrar al destinatario.
 */

import { extractNumbers } from './spanishNumbers.js'
import { foldText } from './text.js'

export const MAX_SENTENCES = 2
export const MAX_CHARS = 220

/** Como se nombra a un grupo cuando la senal no tiene un destinatario (STUCK, GROUP_SILENCE). */
export const GROUP_ADDRESSEE = 'Chicos'
const GROUP_WORDS = ['chicos', 'chicas', 'equipo', 'grupo', 'ambos', 'todos']

const MATH_WORDS = ['problema', 'ejercicio', 'operacion', 'cuenta', 'pregunta']
const MIN_TOPIC_WORD = 4

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1)

/**
 * Nombre con el que se le habla a alguien, a partir de la clave normalizada ("luis rojas" -> "Luis").
 * Si el segundo termino es una sola letra ("estudiante b") se conserva: es parte del nombre.
 * Las claves vienen sin tildes: es el limite de no guardar el nombre original.
 */
export function displayName(participantKey) {
  const words = String(participantKey ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  if (words.length >= 2 && words[1].length === 1) return `${capitalize(words[0])} ${words[1].toUpperCase()}`
  return capitalize(words[0])
}

/** A quien va dirigido: el nombre de la persona o el grupo. */
export const addresseeOf = (signal) => displayName(signal?.participantKey) ?? GROUP_ADDRESSEE

/** true si el texto contiene la respuesta esperada, en digitos o en palabras. */
export function revealsAnswer(text, expectedAnswer) {
  if (!Number.isFinite(expectedAnswer)) return false
  return extractNumbers(String(text ?? '')).some((n) => Math.abs(n - expectedAnswer) < 1e-9)
}

/** Limpia lo que el modelo suele agregar: saltos de linea, comillas, negritas, etiquetas. */
export function cleanMessage(text) {
  return String(text ?? '')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:tutor(?: koeduko)?|mensaje)\s*:\s*/i, '')
    .replace(/^["'«“]+|["'»”]+$/g, '')
    .trim()
}

function sentenceCount(text) {
  const protectedText = text.replace(/(?<=\d)[.,](?=\d)/g, '\u0001')
  return protectedText.split(/(?<=[.!?])\s+/).filter((part) => /[\p{L}\p{N}]/u.test(part)).length
}

function mentionsAddressee(text, addressee) {
  const folded = foldText(text)
  const name = foldText(addressee)
  if (folded.includes(name)) return true
  return name === foldText(GROUP_ADDRESSEE) && GROUP_WORDS.some((word) => new RegExp(`\\b${word}\\b`).test(folded))
}

function mentionsProblem(text, problemText) {
  const folded = foldText(text)
  if (MATH_WORDS.some((word) => folded.includes(word))) return true
  const topic = foldText(problemText).match(/[a-z0-9]+/g) ?? []
  const words = new Set(folded.match(/[a-z0-9]+/g) ?? [])
  return topic.some((word) => (word.length >= MIN_TOPIC_WORD || /^\d+$/.test(word)) && words.has(word))
}

/**
 * Valida un mensaje ya limpio.
 *
 * @param {string} text
 * @param {{ addressee: string, expectedAnswer?: number|null, problemText?: string|null }} context
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateMessage(text, { addressee, expectedAnswer = null, problemText = null }) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'empty' }
  if (text.length > MAX_CHARS) return { ok: false, reason: 'too-long' }
  if (/[\n\r]|[*_`#]/.test(text)) return { ok: false, reason: 'format' }
  if (sentenceCount(text) > MAX_SENTENCES) return { ok: false, reason: 'too-many-sentences' }
  if (!text.includes('?')) return { ok: false, reason: 'no-question' }
  if (!mentionsAddressee(text, addressee)) return { ok: false, reason: 'missing-addressee' }
  if (revealsAnswer(text, expectedAnswer)) return { ok: false, reason: 'reveals-answer' }
  if (problemText && !mentionsProblem(text, problemText)) return { ok: false, reason: 'off-topic' }
  return { ok: true }
}

/** Texto del problema apto para citarlo: no debe traer la respuesta ni ser larguisimo. */
function quotableProblem(problem) {
  const text = String(problem?.text ?? '').trim()
  if (!text || text.length > 70 || revealsAnswer(text, problem?.expectedAnswer)) return null
  return text
}

/**
 * Mensaje determinista para cuando Gemini falla, tarda o responde algo invalido: la demo nunca
 * queda muda. Siempre es una pregunta, nombra al destinatario y no revela nada.
 */
export function fallbackMessage(signal, { problem = null } = {}) {
  const name = addresseeOf(signal)
  const quoted = quotableProblem(problem)
  const theProblem = quoted ? `«${quoted}»` : 'el problema'

  switch (signal?.type) {
    case 'SILENT_PEER':
      return `${name}, ¿cómo explicarías tú con tus palabras ${theProblem}?`
    case 'DOMINANCE':
      return `${name}, ¿qué te gustaría preguntarle a tu compañero sobre ${theProblem} antes de seguir?`
    case 'STUCK':
      return `${name}, ¿qué datos de ${theProblem} ya tienen y cuál les falta para avanzar?`
    case 'GROUP_SILENCE':
      return `${name}, ¿qué parte de ${theProblem} les gustaría revisar juntos?`
    case 'WRONG_ANSWER':
      return `${name}, ¿cómo podrían comprobar ese resultado paso a paso en ${theProblem}?`
    case 'CORRECT_ANSWER':
      return `${name}, ¿cómo le explicarías a tu compañero por qué ese resultado funciona en ${theProblem}?`
    default:
      return `${name}, ¿qué opinan ustedes de ${theProblem}?`
  }
}

const GUIDANCE = {
  SILENT_PEER: 'Invita a la persona que casi no ha hablado a explicar con sus palabras, por ejemplo: "Luis, ¿cómo lo explicarías tú?".',
  DOMINANCE: 'Pide a quien habla mucho que le pregunte algo a su compañero antes de seguir.',
  STUCK: 'Da una pista de nivel 1: reformula el problema o pregunta qué datos tienen.',
  GROUP_SILENCE: 'Dejaron de hablar. No supongas que no saben: pregunta qué parte quieren revisar juntos.',
  WRONG_ANSWER: 'Pide que verifiquen un paso concreto, sin decir de forma tajante que está mal.',
  CORRECT_ANSWER: 'Pide que el otro compañero explique por qué ese resultado funciona. No digas el número.',
}

export const SYSTEM_INSTRUCTION = [
  'Eres el Tutor KoEduko. Acompañas a dos niños de 10 a 11 años de Perú que resuelven un problema de matemática juntos en una videollamada.',
  'Responde SOLO con el mensaje que les diras, en español de Perú, sin comillas, etiquetas ni explicaciones.',
  'Reglas obligatorias:',
  `- Máximo ${MAX_SENTENCES} oraciones y menos de ${MAX_CHARS} caracteres.`,
  '- NUNCA des la respuesta final ni el resultado numérico, y no digas de forma tajante si un número está bien o mal.',
  '- Haz una pregunta socrática sobre el problema actual.',
  '- Empieza nombrando al destinatario.',
  '- Promueve que se expliquen entre ellos: tú no eres el protagonista.',
  '- Tono cálido y breve. Sin emojis, listas ni markdown.',
].join('\n')

function evidenceLine(signal) {
  const e = signal.evidence ?? {}
  switch (signal.type) {
    case 'SILENT_PEER':
    case 'DOMINANCE':
      return `Participación en la conversación: ${JSON.stringify(e.shares ?? {})}.`
    case 'WRONG_ANSWER':
      return `Su respuesta fue: ${(e.numbers ?? []).join(', ')}. (No digas cuál es la correcta.)`
    case 'CORRECT_ANSWER':
      return 'Su respuesta coincide con la correcta. (No digas el número.)'
    case 'STUCK':
      return `Dijeron ${e.markers ?? 'varias'} frases que indican confusión.`
    case 'GROUP_SILENCE':
      return `Llevan ${e.silenceSec ?? 'varios'} segundos sin hablar.`
    default:
      return ''
  }
}

/**
 * Arma el prompt. La respuesta esperada NUNCA se incluye: un modelo no puede revelar lo que no sabe.
 *
 * @param {{ signal: object, problem?: object|null, transcriptTail?: { k: string, x: string }[] }} input
 * @returns {{ systemInstruction: string, userPrompt: string }}
 */
export function buildInterventionPrompt({ signal, problem = null, transcriptTail = [] }) {
  const quoted = quotableProblem(problem)
  const lines = [
    `Señal detectada: ${signal.type}`,
    `Destinatario: ${addresseeOf(signal)}`,
    GUIDANCE[signal.type] ? `Qué hacer: ${GUIDANCE[signal.type]}` : '',
    `Problema actual: ${quoted ?? (problem ? '(texto no disponible)' : '(no hay un problema definido)')}`,
    evidenceLine(signal),
  ]
  if (transcriptTail.length > 0) {
    lines.push('Conversación reciente:')
    lines.push(...transcriptTail.map(({ k, x }) => `- ${displayName(k) ?? k}: ${x}`))
  }
  lines.push('Escribe el mensaje.')
  return { systemInstruction: SYSTEM_INSTRUCTION, userPrompt: lines.filter(Boolean).join('\n') }
}

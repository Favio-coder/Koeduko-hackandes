import {
  addresseeOf,
  buildHintPrompt,
  buildInterventionPrompt,
  cleanMessage,
  fallbackHint,
  fallbackMessage,
  validateHint,
  validateMessage,
} from './core/interventionPolicy.js'
import { DEFAULT_TIMEOUT_MS } from './adapters/gemini.js'

class TutorTimeoutError extends Error {
  constructor(ms) {
    super(`El tutor no respondio en ${ms} ms.`)
    this.name = 'TutorTimeoutError'
  }
}

/** Corta una promesa que tarda de mas, aunque el adaptador no respete el limite. */
function withTimeout(promise, ms) {
  let timer
  const limit = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new TutorTimeoutError(ms)), ms)
  })
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer))
}

/**
 * Mecanismo comun del tutor, para intervenciones en vivo y pistas bajo demanda: pide el texto a
 * Gemini con tiempo limite, lo limpia y lo valida con la politica. Si no hay generador, Gemini falla,
 * tarda mas de `timeoutMs` o responde algo que rompe la politica, devuelve el mensaje de respaldo:
 * el tutor nunca queda mudo.
 *
 * @returns {Promise<{ message: string, source: 'gemini'|'fallback', reason: string|null }>}
 */
async function composeWithFallback({ buildPrompt, validate, fallback, generate, timeoutMs }) {
  if (!generate) return { message: fallback(), source: 'fallback', reason: 'no-generator' }

  try {
    const { systemInstruction, userPrompt } = buildPrompt()
    const raw = await withTimeout(generate({ systemInstruction, userPrompt, timeoutMs }), timeoutMs)
    const message = cleanMessage(raw)
    const check = validate(message)
    if (check.ok) return { message, source: 'gemini', reason: null }
    return { message: fallback(), source: 'fallback', reason: `invalid:${check.reason}` }
  } catch (error) {
    const reason = error?.name === 'TutorTimeoutError' ? 'timeout' : (error?.reason ?? 'error')
    return { message: fallback(), source: 'fallback', reason }
  }
}

/**
 * Redacta la intervencion de una senal. Gemini solo REDACTA: que se intervenga y a quien lo decidio
 * el motor.
 *
 * @param {{
 *   signal: object, problem?: object|null, transcriptTail?: { k: string, x: string }[], memoryNotes?: string[],
 *   generate?: ((input: { systemInstruction: string, userPrompt: string, timeoutMs: number }) => Promise<string>)|null,
 *   timeoutMs?: number,
 * }} input
 */
export function composeIntervention({ signal, problem = null, transcriptTail = [], memoryNotes = [], style = null, generate = null, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return composeWithFallback({
    buildPrompt: () => buildInterventionPrompt({ signal, problem, transcriptTail, memoryNotes, style }),
    validate: (message) =>
      validateMessage(message, {
        addressee: addresseeOf(signal),
        expectedAnswer: problem?.expectedAnswer ?? null,
        problemText: problem?.text || null,
      }),
    fallback: () => fallbackMessage(signal, { problem }),
    generate,
    timeoutMs,
  })
}

/**
 * Redacta la pista que pide un estudiante desde la pantalla del tutor (ask-tutor). Usa el mismo
 * adaptador, la misma politica y el mismo respaldo que la intervencion en vivo.
 *
 * @param {{ question: string, problem?: object|null, generate?: Function|null, timeoutMs?: number }} input
 */
export function composeHint({ question, problem = null, generate = null, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return composeWithFallback({
    buildPrompt: () => buildHintPrompt({ question, problem }),
    validate: (message) => validateHint(message, { expectedAnswer: problem?.expectedAnswer ?? null }),
    fallback: () => fallbackHint({ problem }),
    generate,
    timeoutMs,
  })
}

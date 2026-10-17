import { buildInterventionPrompt, addresseeOf, cleanMessage, fallbackMessage, validateMessage } from './core/interventionPolicy.js'
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
 * Redacta la intervencion. Gemini solo REDACTA: que se intervenga y a quien lo decidio el motor.
 * Si Gemini falla, tarda mas de `timeoutMs`, no hay key o responde algo que rompe la politica
 * (mas de 2 oraciones, la respuesta, sin nombre, fuera de tema...), se usa el mensaje determinista.
 *
 * @param {{
 *   signal: object, problem?: object|null, transcriptTail?: { k: string, x: string }[],
 *   generate?: ((input: { systemInstruction: string, userPrompt: string, timeoutMs: number }) => Promise<string>)|null,
 *   timeoutMs?: number,
 * }} input
 * @returns {Promise<{ message: string, source: 'gemini'|'fallback', reason: string|null }>}
 */
export async function composeIntervention({ signal, problem = null, transcriptTail = [], generate = null, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const fallback = () => fallbackMessage(signal, { problem })
  if (!generate) return { message: fallback(), source: 'fallback', reason: 'no-generator' }

  try {
    const { systemInstruction, userPrompt } = buildInterventionPrompt({ signal, problem, transcriptTail })
    const raw = await withTimeout(generate({ systemInstruction, userPrompt, timeoutMs }), timeoutMs)
    const message = cleanMessage(raw)
    const check = validateMessage(message, {
      addressee: addresseeOf(signal),
      expectedAnswer: problem?.expectedAnswer ?? null,
      problemText: problem?.text || null,
    })
    if (check.ok) return { message, source: 'gemini', reason: null }
    return { message: fallback(), source: 'fallback', reason: `invalid:${check.reason}` }
  } catch (error) {
    const reason = error?.name === 'TutorTimeoutError' ? 'timeout' : (error?.reason ?? 'error')
    return { message: fallback(), source: 'fallback', reason }
  }
}

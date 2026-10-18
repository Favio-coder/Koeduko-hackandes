/**
 * Memoria por estudiante sobre AtomicMemory, por HTTP directo (sin @atomicmemory/sdk). Sin process.env:
 * la URL y la key llegan por parametro, y fetch es inyectable para probar sin red.
 *
 * Interfaz comun con el respaldo en Firestore:
 *   remember(studentKey, text, { timeoutMs? }) -> { ok: boolean, reason?: string }   (nunca lanza)
 *   recall(studentKey, query, { timeoutMs? })  -> string[]                           (nunca lanza; [] si falla o tarda)
 *
 * POR QUE NO EL SDK. @atomicmemory/sdk 1.1.1 arrastra @huggingface/transformers -> onnxruntime-node + sharp
 * (binarios nativos): ~277 MB en node_modules (limite de una funcion de Vercel: 250 MB descomprimida), ~1000
 * lineas nuevas de lockfile y 3 vulnerabilidades altas, todo para llamar a DOS endpoints. Ademas el quickstart
 * del SDK no funciona tal cual: omite `await client.initialize()`, `ingest` exige `mode` (sin el, 422 "missing
 * field `conversation`") y este despliegue exige `contentClass`.
 *
 * Contrato verificado contra https://api.atomicstrata.ai/v1 (18-oct-2026), con `Authorization: Bearer <key>`:
 *  - POST /memories/ingest/quick  { user_id, conversation, source_site, source_url, skip_extraction: true, content_class: "summary" }
 *      -> 201 { stored_memory_ids: [...], memories_stored, ... }.  Sin content_class: 502 "refuses raw/unstamped content".
 *  - POST /memories/search/fast   { user_id, query, limit }
 *      -> 200 { count, memories: [{ id, content, created_at, score, similarity, ... }], ... }
 * Guardamos con skip_extraction y content_class "summary": el texto ya es un resumen factual corto y no queremos
 * que un LLM lo reescriba ni que pase por extraccion.
 */

export const RECALL_TIMEOUT_MS = 2000
export const REMEMBER_TIMEOUT_MS = 4000
export const MAX_NOTES = 3
export const MAX_NOTE_CHARS = 240
export const MAX_REMEMBER_CHARS = 500
export const SOURCE_SITE = 'koeduko-tutor'

/** Saca los textos de una respuesta de `search`, sin confiar en su forma. */
export function notesFromSearch(response, { max = MAX_NOTES, maxChars = MAX_NOTE_CHARS } = {}) {
  const memories = Array.isArray(response?.memories) ? response.memories : []
  const seen = new Set()
  const notes = []
  for (const item of memories) {
    if (typeof item?.content !== 'string') continue
    const text = item.content.replace(/\s+/g, ' ').trim().slice(0, maxChars)
    if (!text || seen.has(text)) continue
    seen.add(text)
    notes.push(text)
    if (notes.length >= max) break
  }
  return notes
}

/**
 * @param {{
 *   apiUrl: string, apiKey: string, fetchImpl?: typeof fetch, logger?: { info: Function },
 * }} options
 */
export function createAtomicMemory({ apiUrl, apiKey, fetchImpl = globalThis.fetch, logger = { info() {} } }) {
  const base = `${String(apiUrl ?? '').replace(/\/+$/, '')}/v1`

  /** POST JSON con limite de tiempo real. Devuelve { ok, status, json }; status 0 = sin respuesta. */
  async function post(path, body, timeoutMs) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const json = response.ok ? await response.json().catch(() => null) : null
      return { ok: response.ok, status: response.status, json }
    } catch {
      return { ok: false, status: 0, timedOut: controller.signal.aborted, json: null }
    } finally {
      clearTimeout(timer)
    }
  }

  // Solo un codigo: nunca el texto, la clave de estudiante ni la API key.
  const reasonOf = ({ status, timedOut }) => (timedOut ? 'timeout' : status === 0 ? 'network' : `http:${status}`)

  return {
    name: 'atomicmemory',

    async remember(studentKey, text, { timeoutMs = REMEMBER_TIMEOUT_MS } = {}) {
      const content = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
      if (!studentKey || !content || content.length > MAX_REMEMBER_CHARS) return { ok: false, reason: 'invalid' }

      const result = await post(
        '/memories/ingest/quick',
        { user_id: studentKey, conversation: content, source_site: SOURCE_SITE, source_url: '', skip_extraction: true, content_class: 'summary' },
        timeoutMs,
      )
      if (result.ok) return { ok: true }
      logger.info('atomicMemory: remember fallo', { reason: reasonOf(result) })
      return { ok: false, reason: reasonOf(result) }
    },

    async recall(studentKey, query, { timeoutMs = RECALL_TIMEOUT_MS } = {}) {
      if (!studentKey || typeof query !== 'string' || !query.trim()) return []

      const result = await post('/memories/search/fast', { user_id: studentKey, query: query.trim(), limit: MAX_NOTES }, timeoutMs)
      if (!result.ok) {
        logger.info('atomicMemory: recall fallo', { reason: reasonOf(result) })
        return []
      }
      return notesFromSearch(result.json)
    },
  }
}

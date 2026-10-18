/**
 * CORS para los endpoints que llama el navegador (start-session-bot, ask-tutor).
 *
 * - Lista EXACTA de origenes: nunca "*" y nunca se refleja el origen que llega. Siempre se permite
 *   el servidor de desarrollo (localhost:5173); el del frontend desplegado sale de ALLOWED_ORIGINS.
 * - Las llamadas sin cabecera Origin (curl, otros servidores) no pasan por aqui: no llevan CORS.
 * - La autenticacion no depende de CORS: el endpoint exige un Bearer que el navegador no adjunta solo.
 */

export const DEV_ORIGIN = 'http://localhost:5173'
export const ALLOWED_METHODS = 'POST, OPTIONS'
export const ALLOWED_HEADERS = 'Authorization, Content-Type'
const PREFLIGHT_MAX_AGE_SEC = '600'

/** "https://a.app, https://b.app/" -> ["https://a.app", "https://b.app"]. Ignora "*" y lo que no sea http(s). */
export function parseAllowedOrigins(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter((item) => {
      try {
        const url = new URL(item)
        return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === item
      } catch {
        return false
      }
    })
}

/**
 * Pone las cabeceras CORS si el origen esta permitido y atiende el preflight (OPTIONS).
 *
 * @param {{ method?: string, headers?: Record<string, string|undefined> }} req
 * @param {{ setHeader: Function, status: Function }} res
 * @param {{ allowedOrigins?: string[] }} options
 * @returns {{ preflight: boolean }} preflight=true: ya se respondio y el handler debe terminar
 */
export function handleCors(req, res, { allowedOrigins = [] } = {}) {
  const origin = req.headers?.origin
  if (!origin) return { preflight: false }

  res.setHeader('Vary', 'Origin')
  const allowed = new Set([DEV_ORIGIN, ...allowedOrigins])
  const isPreflight = req.method === 'OPTIONS'

  if (!allowed.has(origin)) {
    if (isPreflight) {
      res.status(403).end()
      return { preflight: true }
    }
    return { preflight: false } // sin Access-Control-Allow-Origin: el navegador no deja leer la respuesta
  }

  res.setHeader('Access-Control-Allow-Origin', origin)
  if (!isPreflight) return { preflight: false }

  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS)
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS)
  res.setHeader('Access-Control-Max-Age', PREFLIGHT_MAX_AGE_SEC)
  res.status(204).end()
  return { preflight: true }
}

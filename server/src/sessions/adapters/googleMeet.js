/**
 * Google: tokens OAuth y creacion de espacios de Meet. Sin process.env: todo llega por parametro y fetch es inyectable.
 * Nunca registra tokens ni el secreto del cliente. Los errores llevan solo el estado HTTP y el codigo corto de Google.
 *
 * Contrato (documentacion oficial de Google):
 *   POST https://oauth2.googleapis.com/token   grant_type=authorization_code | refresh_token
 *   POST https://meet.googleapis.com/v2/spaces  { config: { accessType: "OPEN" | "TRUSTED" | "RESTRICTED" } }
 *        -> { name, meetingUri, meetingCode, config }   scope: meetings.space.created
 */

export const TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const MEET_SPACES_URL = 'https://meet.googleapis.com/v2/spaces'
const TIMEOUT_MS = 6000

export class GoogleApiError extends Error {
  constructor(message, { status = 0, code = null } = {}) {
    super(message)
    this.name = 'GoogleApiError'
    this.status = status
    this.code = code
  }
}

async function call(url, init, { fetchImpl, timeoutMs = TIMEOUT_MS }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetchImpl(url, { ...init, signal: controller.signal })
  } catch {
    throw new GoogleApiError('No se pudo conectar con Google.', { status: 0, code: controller.signal.aborted ? 'timeout' : 'network' })
  } finally {
    clearTimeout(timer)
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const raw = body?.error
    const code = typeof raw === 'string' ? raw : (raw?.status ?? null)
    throw new GoogleApiError(`Google respondio ${response.status}.`, { status: response.status, code: typeof code === 'string' && /^[A-Za-z0-9_]{1,60}$/.test(code) ? code : null })
  }
  return body ?? {}
}

const form = (data) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() })

/** Cambia el codigo del callback por tokens. @returns {Promise<{ refreshToken: string|null, scope: string }>} */
export async function exchangeCode({ clientId, clientSecret, redirectUri, code, fetchImpl = globalThis.fetch }) {
  const body = await call(TOKEN_URL, form({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code, grant_type: 'authorization_code' }), { fetchImpl })
  return { refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null, scope: typeof body.scope === 'string' ? body.scope : '' }
}

/** Access token de corta vida a partir del refresh token. @returns {Promise<string>} */
export async function refreshAccessToken({ clientId, clientSecret, refreshToken, fetchImpl = globalThis.fetch }) {
  const body = await call(TOKEN_URL, form({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }), { fetchImpl })
  if (typeof body.access_token !== 'string' || !body.access_token) throw new GoogleApiError('Google no devolvio un access token.', { status: 200 })
  return body.access_token
}

/**
 * Crea un espacio de Meet. Con OPEN entra cualquiera que tenga el enlace, sin sala de espera (asi el bot no necesita que
 * lo admitan). @returns {Promise<{ meetingUrl: string, meetingCode: string|null }>}
 */
export async function createSpace({ accessToken, accessType = 'OPEN', fetchImpl = globalThis.fetch }) {
  const body = await call(
    MEET_SPACES_URL,
    { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ config: { accessType } }) },
    { fetchImpl },
  )
  if (typeof body.meetingUri !== 'string' || !/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(body.meetingUri)) {
    throw new GoogleApiError('Google devolvio un enlace de Meet invalido.', { status: 200 })
  }
  return { meetingUrl: body.meetingUri, meetingCode: typeof body.meetingCode === 'string' ? body.meetingCode : null }
}

/**
 * Piezas puras de la conexion con Google (OAuth del docente). Sin red ni reloj: el reloj y el secreto entran por parametro.
 *
 * El docente conecta su cuenta UNA vez; el servidor guarda el refresh token (solo servidor) y con el crea las reuniones de
 * Google Meet de sus salas. El navegador nunca ve el token ni el secreto del cliente.
 *
 * `state` protege el flujo contra falsificacion (CSRF): va firmado con HMAC y lleva el uid del docente y un vencimiento, asi el
 * callback sabe de quien es el codigo sin confiar en nada que venga del navegador.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created'
export const STATE_TTL_MS = 10 * 60 * 1000

const b64 = (value) => Buffer.from(value).toString('base64url')

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url')

/** @returns {string} estado firmado: `<payload>.<firma>` */
export function signState({ uid, ret = null, nowMs, secret }) {
  if (typeof uid !== 'string' || !uid || typeof secret !== 'string' || !secret) throw new TypeError('uid y secret son obligatorios.')
  const payload = b64(JSON.stringify({ uid, ret, exp: nowMs + STATE_TTL_MS }))
  return `${payload}.${sign(payload, secret)}`
}

/** @returns {{ uid: string, ret: string|null } | null} null si esta alterado, vencido o mal formado. Nunca lanza. */
export function verifyState(state, { nowMs, secret }) {
  if (typeof state !== 'string' || typeof secret !== 'string' || !secret) return null
  const [payload, signature, extra] = state.split('.')
  if (!payload || !signature || extra !== undefined) return null

  const expected = Buffer.from(sign(payload, secret))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  try {
    const { uid, ret, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof uid !== 'string' || !uid || !Number.isFinite(exp) || nowMs > exp) return null
    return { uid, ret: typeof ret === 'string' ? ret : null }
  } catch {
    return null
  }
}

/** URL a la que se manda al docente para que autorice. `access_type=offline` + `prompt=consent` => devuelve refresh token. */
export function buildAuthUrl({ clientId, redirectUri, state }) {
  const url = new URL(GOOGLE_AUTH_URL)
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: MEET_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString()
  return url.toString()
}

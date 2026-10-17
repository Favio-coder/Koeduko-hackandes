/**
 * Errores de dominio. Cada uno lleva un codigo que el borde HTTP traduce a un status.
 * `expose: true` marca mensajes escritos por nosotros, sin datos sensibles: son los
 * unicos cuyo texto se escribe en logs y respuestas.
 */

export class SessionBotError extends Error {
  /** @param {'invalid-argument'|'not-found'|'failed-precondition'|'unavailable'|'internal'} code */
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'SessionBotError'
    this.code = code
    this.expose = true
    Object.assign(this, details)
  }
}

export class AuthError extends Error {
  /** @param {'unauthenticated'|'permission-denied'} code */
  constructor(code, message) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.expose = true
  }
}

/** Falta o es invalida una variable de entorno. Solo lleva nombres, nunca valores. */
export class ConfigError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`Configuracion incompleta: ${problems.join(', ')}`)
    this.name = 'ConfigError'
    this.code = 'server-misconfigured'
    this.expose = true
    this.problems = problems
  }
}

const HTTP_STATUS = {
  unauthenticated: 401,
  'permission-denied': 403,
  'invalid-argument': 400,
  'not-found': 404,
  'failed-precondition': 409,
  unavailable: 503,
  internal: 500,
  'server-misconfigured': 500,
}

/** Status HTTP para un error. Lo desconocido es 500. */
export function httpStatusFor(error) {
  return HTTP_STATUS[error?.code] ?? 500
}

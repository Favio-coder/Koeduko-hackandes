export class TimeoutError extends Error {
  constructor(ms) {
    super(`No respondio en ${ms} ms.`)
    this.name = 'TimeoutError'
  }
}

/**
 * Corta una promesa que tarda de mas, aunque la libreria de abajo no respete ningun limite.
 * La operacion original puede seguir corriendo; aqui solo se deja de esperarla.
 */
export function withTimeout(promise, ms) {
  let timer
  const limit = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
  })
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer))
}

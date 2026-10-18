/**
 * Logger JSON a stdout/stderr (los logs de Vercel los indexan). Quien llama decide que
 * datos pasar: nunca claves, tokens ni cuerpos de peticion.
 *
 * `level` y `message` van AL FINAL del objeto para que ningun dato pueda pisarlos (un `message`
 * dentro de `data` borraba el texto del log: ya paso dos veces).
 */
function write(stream, level, message, data) {
  stream(JSON.stringify({ ...data, level, message }))
}

export const consoleLogger = {
  info: (message, data) => write(console.log, 'info', message, data),
  warn: (message, data) => write(console.warn, 'warn', message, data),
  error: (message, data) => write(console.error, 'error', message, data),
}

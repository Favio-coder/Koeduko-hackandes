/**
 * Logger JSON a stdout/stderr (los logs de Vercel los indexan). Quien llama decide que
 * datos pasar: nunca claves, tokens ni cuerpos de peticion.
 */
function write(stream, level, message, data) {
  stream(JSON.stringify({ level, message, ...data }))
}

export const consoleLogger = {
  info: (message, data) => write(console.log, 'info', message, data),
  warn: (message, data) => write(console.warn, 'warn', message, data),
  error: (message, data) => write(console.error, 'error', message, data),
}

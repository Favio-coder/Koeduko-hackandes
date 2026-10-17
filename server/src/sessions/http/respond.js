import { httpStatusFor } from '../errors.js'

const SERVER_MISCONFIGURED = 'Configuracion del servidor incompleta.'

/**
 * Responde con un error. Solo se devuelve el mensaje de errores escritos por nosotros
 * (`expose`); la configuracion faltante y cualquier otro error salen genericos, y el
 * detalle util queda unicamente en el log. Nunca se registra el cuerpo de la peticion.
 *
 * @param {{ status: Function }} res
 * @param {unknown} error
 * @param {{ error: Function }} logger
 * @param {string} label  prefijo del log, p. ej. "startSessionBot"
 */
export function sendError(res, error, logger, label) {
  const status = httpStatusFor(error)
  logger.error(`${label}: peticion fallida`, {
    name: error?.name ?? 'Error',
    code: error?.code ?? null,
    status,
    ...(error?.expose === true ? { detail: error.message } : {}),
    ...(error?.botId ? { botId: error.botId } : {}),
  })

  if (error?.code === 'server-misconfigured') {
    return res.status(status).json({ error: error.code, message: SERVER_MISCONFIGURED })
  }
  if (error?.expose === true) {
    return res.status(status).json({
      error: error.code,
      message: error.message,
      ...(error.botId ? { botId: error.botId } : {}),
    })
  }
  return res.status(500).json({ error: 'internal', message: 'Error interno.' })
}

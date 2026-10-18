import { useEffect } from 'react'
import { postToServer } from '@/services/serverApi'

export const HEARTBEAT_EVERY_MS = 20_000

/**
 * Latido de la sala: mientras la pantalla esta abierta y el tutor esta en la reunion, avisa al servidor cada ~20 s para que
 * reevalue aunque nadie hable (el silencio no genera eventos de Recall). El servidor limita a una evaluacion cada 15 s por sala
 * sin importar cuantas pantallas esten abiertas, asi que abrir varias no cuesta mas. Un fallo se ignora: el latido es una
 * ayuda, nunca debe molestar. Se pausa con la pestana oculta.
 *
 * @param {string|undefined} sessionId
 * @param {{ enabled?: boolean, send?: (body: object) => Promise<unknown>, everyMs?: number }} [options]
 */
export function useSessionHeartbeat(sessionId, { enabled = true, send, everyMs = HEARTBEAT_EVERY_MS } = {}) {
  useEffect(() => {
    if (!sessionId || !enabled) return undefined
    const ping = send ?? ((body) => postToServer('/api/tick', body, { subject: 'el servidor de sesiones' }))

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      Promise.resolve(ping({ sessionId })).catch(() => {})
    }, everyMs)
    return () => clearInterval(timer)
  }, [sessionId, enabled, send, everyMs])
}

/**
 * Vista de la sesion en vivo para la interfaz. Pura: sin Firebase, sin reloj.
 *
 * Por que existe: un onSnapshot sobre live/state cobra UNA lectura por cada cambio entregado a
 * cada espectador, y ese documento cambia con cada evento (~2,5 por segundo). Esta vista, en
 * cambio, se escribe solo cuando el motor evalua (como mucho cada ~5 s), asi que cada espectador
 * recibe ~12 veces menos actualizaciones. Ademas, el navegador no repite la logica del motor:
 * recibe el reparto de habla ya calculado.
 */

import { displayName } from './interventionPolicy.js'
import { talkTimeFromState } from './liveState.js'

export const VIEW_VERSION = 1

/** Cuantas lineas de transcripcion ve la interfaz. */
export const VIEW_TRANSCRIPTS = 20

const round1 = (value) => Math.round(value * 10) / 10

/**
 * @param {import('./liveState.js').LiveState} state
 * @param {{ windowSec: number }} cfg
 * @returns {{
 *   v: number, t: number, windowSec: number, totalSpeechSec: number,
 *   participants: { key: string, name: string, sharePct: number, talkSec: number, speaking: boolean, presentSec: number }[],
 *   transcripts: { key: string, name: string, text: string, t: number }[],
 * }}
 */
export function viewOf(state, cfg) {
  const now = state.lastT
  const keys = state.presence.map((p) => p.k).sort()
  const since = Object.fromEntries(state.presence.map((p) => [p.k, p.s]))
  const talk = talkTimeFromState(state, { from: now - cfg.windowSec, to: now, participants: keys })
  const total = keys.reduce((sum, key) => sum + talk[key], 0)
  const nameOf = (key) => displayName(key) ?? key

  return {
    v: VIEW_VERSION,
    t: now,
    windowSec: cfg.windowSec,
    totalSpeechSec: round1(total),
    participants: keys.map((key) => ({
      key,
      name: nameOf(key),
      sharePct: total > 0 ? Math.round((talk[key] / total) * 100) : 0,
      talkSec: round1(talk[key]),
      speaking: state.speaker?.k === key,
      presentSec: round1(now - since[key]),
    })),
    transcripts: state.transcripts.slice(-VIEW_TRANSCRIPTS).map(({ k, e, x }) => ({ key: k, name: nameOf(k), text: x, t: round1(e) })),
  }
}

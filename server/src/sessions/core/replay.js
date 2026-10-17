import { detectSignals, selectInterventions } from './signals.js'

/**
 * Reproduce una sesion grabada: avanza `now` cada `stepSec` segundos, detecta senales y aplica
 * cooldown acumulando las intervenciones elegidas. Puro: sirve para tests, la demo de respaldo
 * y para afinar umbrales.
 *
 * @returns {{ now: number, signals: object[], selected: object[] }[]}
 */
export function replaySignals(events, { problem = null, config = {}, stepSec = 5, fromSec = 0, toSec } = {}) {
  const lastEventT = Math.max(0, ...events.map((e) => (e.type === 'transcript' ? (e.tEnd ?? e.t) : e.t)))
  const end = toSec ?? lastEventT
  const steps = Math.floor((end - fromSec) / stepSec + 1e-9)
  const history = []

  return Array.from({ length: steps + 1 }, (_, i) => {
    const now = fromSec + i * stepSec
    const signals = detectSignals(events, now, { problem, config })
    const selected = selectInterventions(signals, history, now, config)
    selected.forEach((signal) => history.push({ type: signal.type, participantKey: signal.participantKey, t: now }))
    return { now, signals, selected }
  })
}

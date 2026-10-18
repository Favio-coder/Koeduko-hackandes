/**
 * Aprendizaje del tutor a partir de lo que paso despues de cada intervencion. Puro y determinista (el azar viene de
 * una semilla), asi se puede probar y repetir.
 *
 * Cada intervencion se redacta con un ESTILO. Por estudiante y por senal se cuenta cuantas veces se uso cada estilo y
 * cuantas veces mejoro la situacion (ver interventionOutcome.js). Con esos conteos se elige el estilo siguiente:
 *  1. primero se prueba cada estilo MIN_TRIES veces (explorar);
 *  2. despues se elige el de mejor tasa suavizada, y un EXPLORE_RATE de las veces otro, para no quedarse atascado;
 *  3. lo viejo pesa menos (DECAY): lo que le servia hace 10 sesiones no manda sobre lo de ayer.
 * Los conteos viven en el perfil del estudiante (`profile.styles`). No hay modelo entrenado ni datos del nino: solo conteos.
 */

import { OUTCOME } from './interventionOutcome.js'

export const STYLES = Object.freeze(['pregunta', 'pista', 'paso'])

/** Instruccion de estilo que se agrega al prompt. */
export const STYLE_GUIDE = Object.freeze({
  pregunta: 'Estilo: una sola pregunta abierta que le haga explicar con sus palabras lo que está pensando.',
  pista: 'Estilo: una pista corta sobre qué dato mirar del problema, y luego una pregunta.',
  paso: 'Estilo: pide un único paso concreto (qué operación o qué números usar), nada más.',
})

export const MIN_TRIES = 2
export const EXPLORE_RATE = 0.15
export const DECAY = 0.9
/** Con el olvido, MIN_TRIES pruebas seguidas suman un poco menos de MIN_TRIES: este es el umbral real. */
const EXPLORED = MIN_TRIES * DECAY
const MAX_TRIES = 60

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const round2 = (n) => Math.round(n * 100) / 100

/** Numero estable en [0, 1) a partir de un texto (FNV-1a). */
export function seededUnit(seed) {
  let hash = 2166136261
  for (const char of String(seed)) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash / 4294967296
}

/** Conteos {tries, wins} de un estilo para una senal. Tolera perfiles viejos o malformados. */
export function statsOf(profile, signal, style) {
  const raw = isObject(profile?.styles) && isObject(profile.styles[signal]) ? profile.styles[signal][style] : null
  const tries = Number(raw?.tries)
  const wins = Number(raw?.wins)
  return { tries: Number.isFinite(tries) && tries > 0 ? tries : 0, wins: Number.isFinite(wins) && wins > 0 ? Math.min(wins, tries) : 0 }
}

/** Tasa de mejora suavizada: pocos datos no dan una tasa extrema. */
export const rateOf = ({ tries, wins }) => (wins + 1) / (tries + 2)

/**
 * Elige el estilo de la proxima intervencion.
 * @param {object|null} profile
 * @param {string} signal
 * @param {string} seed texto estable (sesion + senal + tiempo): el mismo contexto da la misma eleccion
 * @returns {{ style: string, reason: 'explore'|'exploit'|'random' }}
 */
export function chooseStyle(profile, signal, seed) {
  const unit = seededUnit(seed)
  const stats = STYLES.map((style) => ({ style, ...statsOf(profile, signal, style) }))

  const untried = stats.filter((s) => s.tries < EXPLORED)
  if (untried.length > 0) {
    const least = Math.min(...untried.map((s) => s.tries))
    const pool = untried.filter((s) => s.tries === least)
    return { style: pool[Math.floor(unit * pool.length)].style, reason: 'explore' }
  }
  if (unit < EXPLORE_RATE) {
    return { style: STYLES[Math.floor((unit / EXPLORE_RATE) * STYLES.length)], reason: 'random' }
  }
  const best = stats.reduce((top, s) => (rateOf(s) > rateOf(top) ? s : top))
  return { style: best.style, reason: 'exploit' }
}

/**
 * Suma un resultado al perfil. Devuelve un perfil nuevo. `unknown` y estilos desconocidos no cambian nada.
 * Antes de sumar, lo anterior de ese estilo se atenua (DECAY) para que pese mas lo reciente.
 */
export function recordOutcome(profile, { signal, style, outcome }) {
  const base = isObject(profile) ? profile : {}
  if (!STYLES.includes(style) || !signal) return base
  if (outcome !== OUTCOME.IMPROVED && outcome !== OUTCOME.NO_CHANGE) return base

  const current = statsOf(base, signal, style)
  const tries = Math.min(MAX_TRIES, round2(current.tries * DECAY + 1))
  const wins = round2(current.wins * DECAY + (outcome === OUTCOME.IMPROVED ? 1 : 0))
  const styles = isObject(base.styles) ? base.styles : {}
  return { ...base, styles: { ...styles, [signal]: { ...(isObject(styles[signal]) ? styles[signal] : {}), [style]: { tries, wins } } } }
}

/** Aplica varios resultados (los de un estudiante al cerrar la sesion). */
export const recordOutcomes = (profile, outcomes) => outcomes.reduce((next, outcome) => recordOutcome(next, outcome), profile)

/** Frase con lo aprendido, para el prompt ("le funciona mas..."). Vacia si aun no hay datos suficientes. */
export function describeLearning(profile, signal) {
  const stats = STYLES.map((style) => ({ style, ...statsOf(profile, signal, style) })).filter((s) => s.tries >= EXPLORED)
  if (stats.length === 0) return ''
  const best = stats.reduce((top, s) => (rateOf(s) > rateOf(top) ? s : top))
  if (rateOf(best) < 0.5) return ''
  return `Con este estudiante ha funcionado mejor el estilo ${best.style}.`
}

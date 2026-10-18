/**
 * Capa de decision sobre el estado incremental. Pura: sin Firebase, sin red, sin reloj.
 *
 * Por cada evento que llega al webhook (ver sessionStore.processLiveEvent):
 *   1. ingestEvent   -> absorbe el evento y dice si toca evaluar (throttle por tiempo de evento)
 *   2. evaluateDue   -> detecta senales, aplica prioridad y cooldown, y anota la intervencion
 * Solo la segunda necesita el problema actual, asi que solo ahi se lee la sesion de Firestore.
 */

import { judgeDue } from './conversationJudge.js'
import { applyEvent, emptyState, eventTime } from './liveState.js'
import { DEFAULT_CONFIG, detectSignalsFromState, selectInterventions } from './signals.js'

const mergeConfig = (config) => ({ ...DEFAULT_CONFIG, ...config })

/**
 * Traduce learningSessions/{id}.currentProblem ({ activityId, text, skillId }) y la respuesta esperada
 * (de learningSessions/{id}/private/answer) al problema que entiende el motor. Devuelve null si no hay problema o no tiene una respuesta numerica.
 */
export function problemFromSession(session, expectedAnswerOverride) {
  const current = session?.currentProblem
  if (!current || typeof current !== 'object') return null
  // La respuesta ya no viaja en el documento de la sesion (lo leen los estudiantes): llega aparte,
  // de private/answer. Una sesion vieja que aun la trae dentro sigue funcionando.
  const expectedAnswer = Number(expectedAnswerOverride ?? current.expectedAnswer)
  const activityId = current.activityId ?? current.id
  if (!Number.isFinite(expectedAnswer) || activityId === undefined || activityId === null) return null
  return {
    activityId: String(activityId),
    skillId: current.skillId ?? null,
    text: String(current.text ?? ''),
    expectedAnswer,
  }
}

/** Id de la actividad actual de la sesion, o null. */
export function activityIdOf(session) {
  const current = session?.currentProblem
  const id = current && typeof current === 'object' ? (current.activityId ?? current.id) : null
  return id === undefined || id === null ? null : String(id)
}

/** Intervenciones ya hechas, en el formato que espera selectInterventions. */
export const historyOf = (state) => state.interventions.map(({ type, k, t }) => ({ type, participantKey: k, t }))

/**
 * Paso 1. Absorbe el evento y decide si toca evaluar.
 * `now` es monotono (el mayor tiempo de evento visto): un transcript llega con su tEnd, que va
 * un poco por detras de los eventos de habla, y no debe hacer retroceder el reloj de la sesion.
 *
 * @returns {{ state: import('./liveState.js').LiveState, due: boolean }}
 */
export function ingestEvent(state, event, { eventId = null, config = {} } = {}) {
  const cfg = mergeConfig(config)
  const next = applyEvent(state, eventId ? { ...event, id: eventId } : event, cfg)
  const due = next !== state && (next.lastEvalT === null || next.lastT - next.lastEvalT >= cfg.evalEverySec)
  return { state: next, due }
}

/**
 * Paso 2. Evalua las senales en el tiempo de la sesion y anota la intervencion elegida (si hay)
 * para que el cooldown la recuerde. Cuando cambia el problema, recuerda desde cuando rige:
 * lo dicho antes no cuenta como respuesta.
 *
 * @returns {{ state: import('./liveState.js').LiveState, intervention: object|null, judge: boolean }}
 */
export function evaluateDue(state, { problem = null, config = {} } = {}) {
  const cfg = mergeConfig(config)
  const now = state.lastT

  const problemId = problem?.activityId ?? null
  const startedT = state.problem?.id === problemId ? state.problem.startedT : now
  const tracked = problemId === null ? null : { id: problemId, startedT }
  const engineProblem = problem && { ...problem, startedAtT: problem.startedAtT ?? startedT }

  // Sin ninguna persona en la sala (el evento que acaba de llegar fue la salida de la ultima) el tutor no habla: nadie lo oiria,
  // y la sesion se cierra sola. Se sigue anotando el tiempo evaluado para no reevaluar enseguida.
  const roomEmpty = !state.presence.some((p) => !cfg.botKeys.includes(p.k))
  if (roomEmpty) {
    return { state: { ...state, lastEvalT: now, problem: tracked }, intervention: null, judge: false }
  }

  const signals = detectSignalsFromState(state, now, { problem: engineProblem, config: cfg })
  const [intervention = null] = selectInterventions(signals, historyOf(state), now, cfg)

  const interventions = intervention
    ? [...state.interventions, { type: intervention.type, k: intervention.participantKey ?? null, t: now }].slice(-cfg.maxInterventions)
    : state.interventions

  // Si las reglas no dijeron nada, a veces toca que el observador lea la conversacion (sea del tema que sea).
  // La marca de tiempo viaja en la escritura del estado que ya se hace: no suma escrituras.
  const judge = !intervention && cfg.judgeEnabled !== false && judgeDue(state, cfg)
  const lastJudgeT = judge ? now : (state.lastJudgeT ?? null)

  return { state: { ...state, lastEvalT: now, lastJudgeT, problem: tracked, interventions }, intervention, judge }
}

/**
 * Conveniencia para tests y el reproductor: ingestEvent + evaluateDue con el mismo problema.
 *
 * @returns {{ state: import('./liveState.js').LiveState, evaluated: boolean, intervention: object|null }}
 */
export function processEvent(state, event, { eventId = null, problem = null, config = {} } = {}) {
  const ingested = ingestEvent(state, event, { eventId, config })
  if (!ingested.due) return { state: ingested.state, evaluated: false, intervention: null }
  const { state: evaluated, intervention } = evaluateDue(ingested.state, { problem, config })
  return { state: evaluated, evaluated: true, intervention }
}

/** Tiempo de sesion de un evento, reexportado para quien arma el reproductor. */
export { emptyState, eventTime }

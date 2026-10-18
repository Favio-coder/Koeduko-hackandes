import { buildClassifierPrompt, parseClassification } from './core/competencyClassifier.js'
import { buildCompetencyReport, doubtfulSentences, participantKeysOf } from './core/competencyEvidence.js'
import { activityIdOf } from './core/liveEngine.js'
import { memoryTextOf } from './core/memoryText.js'
import { DEFAULT_CONFIG } from './core/signals.js'
import { memoryScopeOf, studentKeyOf } from './core/studentKey.js'
import { SessionBotError } from './errors.js'
import { withTimeout } from './timeout.js'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export const LEAVE_TIMEOUT_MS = 4000
export const CLASSIFY_TIMEOUT_MS = 6000
export const REMEMBER_TIMEOUT_MS = 4000
export const SUMMARY_VERSION = 1

/** Un codigo corto de por que fallo un paso: nunca el mensaje, el texto ni datos del estudiante. */
const reasonOf = (error) => (error?.name === 'TimeoutError' ? 'timeout' : (error?.reason ?? error?.status ?? error?.name ?? 'error'))

/**
 * Cierra una sesion: saca al bot, arma el reporte de competencias, lo guarda, recuerda a cada estudiante
 * y marca la sesion como completada.
 *
 * NINGUN servicio externo puede romper el cierre. Cada paso externo (sacar al bot, clasificar frases con
 * Gemini, recordar en la memoria) tiene su propio limite de tiempo y, si falla, el cierre sigue; el
 * resumen guardado registra que paso con cada uno en `steps`. Solo un fallo de Firestore (leer lo
 * necesario o guardar el resumen) detiene el cierre: sin eso no hay nada que entregar.
 *
 * Costo en Firestore: lecturas = 1 sesion + 1 live/state + 1 por transcripcion guardada + 0-1 private/answer;
 * escrituras = 2 (summary/final y el estado de la sesion, en un lote). Una sesion ya cerrada cuesta 2 lecturas
 * (sesion + resumen) y ninguna escritura.
 *
 * @param {{
 *   sessionId: unknown,
 *   store: { getSession: Function, getLiveState: Function, getAnswer: Function, getTranscripts: Function, getSummary: Function, saveClosure: Function },
 *   memory?: { remember: (studentKey: string, text: string) => Promise<object> } | null,
 *   leaveBot?: ((bot: { id: string, region?: string }) => Promise<unknown>) | null,
 *   generate?: ((input: object) => Promise<string>) | null,
 *   logger: { info: Function },
 *   timeouts?: { leave?: number, classify?: number, remember?: number },
 * }} input
 */
export async function closeSession({ sessionId, store, memory = null, leaveBot = null, generate = null, logger, timeouts = {} }) {
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new SessionBotError('invalid-argument', 'sessionId es obligatorio.')
  }
  const limits = { leave: LEAVE_TIMEOUT_MS, classify: CLASSIFY_TIMEOUT_MS, remember: REMEMBER_TIMEOUT_MS, ...timeouts }

  const session = await store.getSession(sessionId)
  if (!session) throw new SessionBotError('not-found', 'La sesion no existe.')

  // Idempotente: cerrar dos veces no repite nada (ni saca al bot, ni gasta Gemini, ni duplica la memoria).
  if (session.status === 'completed') {
    const existing = await store.getSummary(sessionId)
    if (existing?.report) return { status: 'completed', alreadyClosed: true, report: existing.report, steps: existing.steps ?? {}, memory: [] }
  }

  const steps = { leaveCall: 'skipped', classifier: 'skipped', memory: { enabled: Boolean(memory), saved: 0, failed: 0, skipped: 0, failures: [] } }

  // 1. Sacar al bot de la reunion.
  if (leaveBot && session.bot?.id && session.bot.status !== 'done') {
    try {
      await withTimeout(leaveBot(session.bot), limits.leave)
      steps.leaveCall = 'ok'
    } catch (error) {
      steps.leaveCall = `failed:${reasonOf(error)}`
    }
  }

  // 2. Lo que paso en la sesion (Firestore: si esto falla, el cierre se detiene).
  const [state, transcripts] = await Promise.all([store.getLiveState(sessionId), store.getTranscripts(sessionId)])

  const bots = new Set(DEFAULT_CONFIG.botKeys)
  const humanTranscripts = transcripts.filter((tr) => !bots.has(tr.k))
  const totals = Array.isArray(state?.totals) ? state.totals.filter((t) => !bots.has(t.k)) : null
  const participants = (state?.presence ?? []).map((p) => p.k).filter((k) => !bots.has(k))

  // 3. El problema, con su respuesta (cacheada en el estado, o de private/answer; o, en sesiones viejas, del propio problema).
  const current = session.currentProblem
  const activityId = activityIdOf(session)
  let expectedAnswer = activityId !== null && state?.answer?.id === activityId ? state.answer.v : undefined
  if (activityId !== null && expectedAnswer === undefined) expectedAnswer = (await store.getAnswer(sessionId))?.expectedAnswer
  // Una sesion sin migrar todavia trae la respuesta dentro del problema.
  const candidate = expectedAnswer ?? current?.expectedAnswer
  const parsed = candidate === undefined || candidate === null || candidate === '' ? Number.NaN : Number(candidate)
  const answerValue = Number.isFinite(parsed) ? parsed : undefined
  const problem =
    activityId === null
      ? null
      : {
          activityId,
          skillId: current.skillId ?? null,
          text: String(current.text ?? ''),
          expectedAnswer: answerValue,
          startedAtT: state?.problem?.id === activityId ? state.problem.startedT : undefined,
        }

  // 4. Frases dudosas: Gemini solo clasifica; si falla o tarda, el reporte se queda con las reglas.
  const input = { transcripts: humanTranscripts, totals, participants, students: state?.students ?? [], problem, durationSec: state?.lastT ?? 0 }
  const doubtful = doubtfulSentences({ transcripts: humanTranscripts, studentKeys: participantKeysOf(input) })
  let labels = {}
  if (doubtful.length > 0 && !generate) {
    steps.classifier = 'no-generator'
  } else if (doubtful.length > 0) {
    try {
      const { systemInstruction, userPrompt } = buildClassifierPrompt({ problemText: problem?.text ?? '', sentences: doubtful })
      const raw = await withTimeout(
        generate({ systemInstruction, userPrompt, timeoutMs: limits.classify, generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 800 } }),
        limits.classify,
      )
      labels = parseClassification(raw, doubtful.map((d) => d.id))
      steps.classifier = Object.keys(labels).length > 0 ? 'ok' : 'no-labels'
    } catch (error) {
      steps.classifier = `failed:${reasonOf(error)}`
    }
  }

  const report = buildCompetencyReport({ ...input, labels })

  // 5. Recordar a cada estudiante (un texto corto y factual; nunca transcripciones ni nombres).
  const scope = memoryScopeOf(session)
  const remembered = []
  if (memory) {
    await Promise.all(
      report.estudiantes.map(async (student) => {
        const key = studentKeyOf({ studentId: student.studentId, participantKey: student.key, scope })
        const text = memoryTextOf({ sessionId, problem: report.problema, student })
        if (!key) {
          steps.memory.skipped += 1
          remembered.push({ name: student.name, ok: false, reason: 'no-key', text })
          return
        }
        try {
          const result = await withTimeout(memory.remember(key, text), limits.remember)
          if (result.ok) steps.memory.saved += 1
          else {
            steps.memory.failed += 1
            steps.memory.failures.push(result.reason ?? 'error')
          }
          remembered.push({ name: student.name, ok: Boolean(result.ok), via: result.via, ...(result.ok ? {} : { reason: result.reason }), text })
        } catch (error) {
          steps.memory.failed += 1
          steps.memory.failures.push(reasonOf(error))
          remembered.push({ name: student.name, ok: false, reason: reasonOf(error), text })
        }
      }),
    )
  }

  // 6. Guardar el resumen y cerrar (Firestore: si esto falla, el cierre falla).
  await store.saveClosure(sessionId, { v: SUMMARY_VERSION, sessionId, report, steps })

  logger.info('closeSession: sesion cerrada', {
    sessionId,
    students: report.estudiantes.length,
    transcripts: humanTranscripts.length,
    leaveCall: steps.leaveCall,
    classifier: steps.classifier,
    memorySaved: steps.memory.saved,
    memoryFailed: steps.memory.failed,
  })
  return { status: 'completed', alreadyClosed: false, report, steps, memory: remembered }
}

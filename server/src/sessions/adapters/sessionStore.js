import { canRequestBot } from '../core/botRequest.js'
import { activityIdOf, emptyState, evaluateDue, ingestEvent, problemFromSession } from '../core/liveEngine.js'
import { viewOf } from '../core/liveView.js'
import { isValidMeetUrl } from '../core/meetUrl.js'
import { DEFAULT_CONFIG } from '../core/signals.js'
import { SessionBotError } from '../errors.js'

const ALREADY_EXISTS = 6 // codigo gRPC de Firestore cuando create() encuentra el documento

/**
 * Eventos que SOLO actualizan el estado y no se guardan crudos en liveEvents. speech_on/speech_off
 * son el 87 % del trafico y el estado ya conserva los intervalos: guardarlos duplicaba las escrituras
 * (la cuota gratuita permite 20 000 al dia). Transcript, join y leave si se guardan.
 */
const STATE_ONLY_EVENTS = new Set(['speech_on', 'speech_off'])

/** Cuantas transcripciones recientes se le pasan al tutor como contexto. */
const TRANSCRIPT_TAIL = 8

/**
 * Acceso a Firestore para sesiones. Recibe db y FieldValue ya inicializados
 * (ver firebaseAdmin.js), asi se prueba con un doble sin Firebase.
 *
 * @param {{ db: any, FieldValue: { serverTimestamp: () => unknown } }} firebase
 */
export function createSessionStore({ db, FieldValue }) {
  const sessionRef = (sessionId) => db.doc(`learningSessions/${sessionId}`)

  return {
    /** Guarda un evento en vivo. El id determinista hace idempotente el reenvio de Recall. */
    async saveLiveEvent(sessionId, eventId, event) {
      await db
        .doc(`learningSessions/${sessionId}/liveEvents/${eventId}`)
        .set({ ...event, receivedAt: FieldValue.serverTimestamp() })
    },

    /**
     * Procesa un evento en vivo con el COSTO MINIMO de Firestore, sin leer nunca la ventana de
     * liveEvents. Una transaccion por evento:
     *   - 1 lectura  : learningSessions/{id}/live/state (estado incremental del motor)
     *   - 1 lectura  : la sesion, SOLO cuando toca evaluar (como mucho cada ~5 s) para traer el problema
     *   - 1 lectura  : private/answer, UNA vez por problema (se cachea en live/state.answer; no se relee)
     *   - 1 escritura: el estado actualizado (se omite si el evento no cambio nada)
     *   - 1 escritura: live/view para la interfaz, SOLO al evaluar (la pantalla recibe ~12 veces menos cambios
     *     que si leyera live/state, y cada cambio entregado a cada espectador cuenta como una lectura)
     *   - 1 escritura: el liveEvent crudo, salvo speech_on/off (id determinista: reenviarlo es idempotente)
     * Devuelve tambien las operaciones realmente ejecutadas (con reintentos) para medir la cuota.
     *
     * @returns {Promise<{ evaluated: boolean, intervention: object|null, context: object|null, ops: { reads: number, writes: number, attempts: number } }>}
     */
    async processLiveEvent(sessionId, eventId, event, { config = {} } = {}) {
      const stateRef = db.doc(`learningSessions/${sessionId}/live/state`)
      const viewRef = db.doc(`learningSessions/${sessionId}/live/view`)
      const answerRef = db.doc(`learningSessions/${sessionId}/private/answer`)
      const eventRef = db.doc(`learningSessions/${sessionId}/liveEvents/${eventId}`)
      const ops = { reads: 0, writes: 0, attempts: 0 }

      const outcome = await db.runTransaction(async (tx) => {
        ops.attempts += 1
        let writes = 0

        const stateSnap = await tx.get(stateRef)
        ops.reads += 1
        const before = stateSnap.exists ? stateSnap.data() : emptyState()
        const ingested = ingestEvent(before, event, { eventId, config })

        let state = ingested.state
        let intervention = null
        let context = null
        if (ingested.due) {
          const sessionSnap = await tx.get(sessionRef(sessionId))
          ops.reads += 1
          const session = sessionSnap.exists ? sessionSnap.data() : null

          // La respuesta esperada se lee UNA vez por problema y se cachea en el estado (solo servidor).
          const activityId = activityIdOf(session)
          if (activityId !== null && state.answer?.id !== activityId) {
            const answerSnap = await tx.get(answerRef)
            ops.reads += 1
            const stored = answerSnap.exists ? answerSnap.data()?.expectedAnswer : undefined
            const value = Number(stored ?? session.currentProblem.expectedAnswer) // lo ultimo: sesiones sin migrar
            state = { ...state, answer: { id: activityId, v: Number.isFinite(value) ? value : null } }
          }
          const problem = problemFromSession(session, state.answer?.v ?? undefined)
          const evaluated = evaluateDue(state, { problem, config })
          state = evaluated.state
          intervention = evaluated.intervention
          if (intervention) {
            context = {
              problem,
              transcriptTail: state.transcripts.slice(-TRANSCRIPT_TAIL).map(({ k, x }) => ({ k, x })),
              present: state.presence.map((p) => p.k),
            }
          }
        }

        if (state !== before) {
          tx.set(stateRef, state)
          writes += 1
        }
        if (ingested.due) {
          tx.set(viewRef, viewOf(state, { ...DEFAULT_CONFIG, ...config }))
          writes += 1
        }
        if (!STATE_ONLY_EVENTS.has(event.type)) {
          tx.set(eventRef, { ...event, receivedAt: FieldValue.serverTimestamp() })
          writes += 1
        }

        ops.writes = writes // solo cuentan las escrituras del intento que se confirmo
        return { evaluated: ingested.due, intervention, context }
      })

      return { ...outcome, ops }
    },

    /**
     * Crea la intervencion con un id determinista. create() falla si ya existe: eso significa
     * que otro intento ya la entrego, y no es un error.
     *
     * @returns {Promise<{ created: boolean }>}
     */
    async createIntervention(sessionId, interventionId, data) {
      try {
        await db
          .doc(`learningSessions/${sessionId}/agentInterventions/${interventionId}`)
          .create({ ...data, createdAt: FieldValue.serverTimestamp() })
        return { created: true }
      } catch (error) {
        if (error?.code === ALREADY_EXISTS) return { created: false }
        throw error
      }
    },

    /** Marca por donde se entrego una intervencion ya creada, p. ej. ['app', 'meet_chat'] (1 escritura). */
    async setDeliveredTo(sessionId, interventionId, deliveredTo) {
      await db.doc(`learningSessions/${sessionId}/agentInterventions/${interventionId}`).update({ deliveredTo })
    },

    /** Rol guardado en users/{uid}. El rol nunca se acepta del cliente. */
    async getUserRole(uid) {
      const snap = await db.doc(`users/${uid}`).get()
      return snap.exists ? (snap.data().role ?? null) : null
    },

    /**
     * Reserva el bot antes de llamar a Recall (intencion local persistida): un doble clic
     * no crea dos bots. Devuelve el meetingUrl guardado en la sesion, no uno del cliente.
     */
    async claimBot(sessionId, { region, nowMs }) {
      const ref = sessionRef(sessionId)
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) throw new SessionBotError('not-found', 'La sesion no existe.')

        const session = snap.data()
        if (!isValidMeetUrl(session.meetingUrl)) {
          throw new SessionBotError(
            'failed-precondition',
            'La sesion necesita un enlace valido de Google Meet (https://meet.google.com/abc-defg-hij).',
          )
        }
        if (!canRequestBot(session.bot, nowMs)) {
          throw new SessionBotError('failed-precondition', 'El tutor ya fue invitado a esta sesion.')
        }

        tx.update(ref, { bot: { id: null, status: 'requested', region, requestedAtMs: nowMs } })
        return { meetingUrl: session.meetingUrl.trim() }
      })
    },

    /** La sesion tal como esta guardada (1 lectura), o null si no existe. */
    async getSession(sessionId) {
      const snap = await sessionRef(sessionId).get()
      return snap.exists ? snap.data() : null
    },

    /** Guarda lo que le pregunto un estudiante al tutor y lo que se le respondio (1 escritura). */
    async addTutorInteraction(sessionId, data) {
      await db.collection(`learningSessions/${sessionId}/tutorInteractions`).add({ ...data, createdAt: FieldValue.serverTimestamp() })
    },

    async setBotId(sessionId, botId) {
      await sessionRef(sessionId).update({ 'bot.id': botId })
    },

    async markBotFailed(sessionId) {
      await sessionRef(sessionId).update({ 'bot.status': 'failed' })
    },
  }
}

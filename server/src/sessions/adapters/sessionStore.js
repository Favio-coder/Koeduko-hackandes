import { canRequestBot } from '../core/botRequest.js'
import { anchorOf, tickPlan } from '../core/heartbeat.js'
import { activityIdOf, emptyState, evaluateDue, ingestEvent, problemFromSession } from '../core/liveEngine.js'
import { viewOf } from '../core/liveView.js'
import { isValidMeetUrl } from '../core/meetUrl.js'
import { pickProblem } from '../core/problemBank.js'
import { rolesOf } from '../core/roles.js'
import { DEFAULT_CONFIG } from '../core/signals.js'
import { memoryCacheKey } from '../core/studentKey.js'
import { SessionBotError } from '../errors.js'

const ALREADY_EXISTS = 6 // codigo gRPC de Firestore cuando create() encuentra el documento

/**
 * Eventos que SOLO actualizan el estado y no se guardan crudos en liveEvents. speech_on/speech_off
 * son el 87 % del trafico y el estado ya conserva los intervalos: guardarlos duplicaba las escrituras
 * (la cuota gratuita permite 20 000 al dia). Transcript, join y leave si se guardan.
 */
const STATE_ONLY_EVENTS = new Set(['speech_on', 'speech_off'])

/** Tope de transcripciones que se leen al cerrar (una sesion de ~100 s tuvo 29; esto cubre horas). */
const MAX_CLOSE_TRANSCRIPTS = 2000
const MAX_CLOSE_INTERVENTIONS = 200
/** Id de documento seguro para una clave de estudiante (un uid o "<scope>:<hash>"). */
const profileDocId = memoryCacheKey

/** Cuantas transcripciones recientes se le pasan al tutor como contexto. */
const TRANSCRIPT_TAIL = 8
/** Frases recientes que lee el observador de la conversacion (un poco mas que el resto: necesita ver el hilo). */
const JUDGE_TAIL = 12
const BOT_KEYS = new Set(DEFAULT_CONFIG.botKeys)
/** Frases de personas que debe haber para cerrar sola una sala: una sala donde nadie hablo no genera reporte. */
const AUTO_CLOSE_MIN_TRANSCRIPTS = 3

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
    async processLiveEvent(sessionId, eventId, event, { config = {}, nowMs = Date.now() } = {}) {
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
        // Cada evento real deja el ancla del reloj: el latido (processTick) la usa para hacer correr el tiempo en el silencio.
        if (state !== before) state = { ...state, anchor: anchorOf(state, nowMs) }
        let intervention = null
        let context = null
        let judge = null
        let botEnteredCall = false
        if (ingested.due) {
          const sessionSnap = await tx.get(sessionRef(sessionId))
          ops.reads += 1
          const session = sessionSnap.exists ? sessionSnap.data() : null
          botEnteredCall = session?.bot?.status === 'requested'

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
              // Lo ya recordado de cada estudiante en ESTA sesion (cache en live/state): evita repetir el recall.
              memory: state.memory ?? {},
              transcriptTail: state.transcripts.slice(-TRANSCRIPT_TAIL).map(({ k, x }) => ({ k, x })),
              present: state.presence.map((p) => p.k),
            }
          } else if (evaluated.judge) {
            // Las reglas no dijeron nada: el observador lee la conversacion reciente (sin lecturas ni escrituras extra).
            judge = {
              problem,
              t: state.lastT,
              classContext: [session?.courseId, session?.assessmentTitle].filter((x) => typeof x === 'string' && x).join(' · ') || null,
              transcriptTail: state.transcripts.slice(-JUDGE_TAIL).map(({ k, x }) => ({ k, x })),
              present: state.presence.map((p) => p.k),
            }
          }
        }

        // Recall solo manda eventos cuando el bot ya entro y esta grabando: el primer evento prueba que esta en la llamada.
        // Sin esto la pantalla dice «admitelo en Meet» para siempre. Una sola vez, dentro de la transaccion que ya leyo la sesion.
        if (botEnteredCall) {
          tx.update(sessionRef(sessionId), { 'bot.status': 'in_call' })
          writes += 1
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

        // Se fue la ultima persona de una sala en la que de verdad se hablo: el bot sale solo (2 s despues, por su propia
        // configuracion) y no queda nadie que cierre. La sesion se cierra sola y genera el reporte y la memoria.
        const humansLeft = state.presence.filter((p) => !BOT_KEYS.has(p.k))
        const humanTalk = state.transcripts.filter((tr) => !BOT_KEYS.has(tr.k))
        const closeNow = event.type === 'leave' && humansLeft.length === 0 && humanTalk.length >= AUTO_CLOSE_MIN_TRANSCRIPTS

        ops.writes = writes // solo cuentan las escrituras del intento que se confirmo
        return { evaluated: ingested.due, intervention, context, judge, closeNow }
      })

      return { ...outcome, ops }
    },

    /**
     * Latido: evalua la sala con el reloj corriendo aunque no hayan llegado eventos (el silencio no genera ninguno). Calcula el
     * tiempo de sesion desde el ancla del ultimo evento real (core/heartbeat.js) y corre el mismo motor, con GROUP_SILENCE
     * encendida (solo el latido puede detectarla). Como maximo una evaluacion cada TICK_MIN_MS por sala, venga de cuantas
     * pantallas venga. Una sala cerrada, sin eventos o inactiva hace mucho no evalua nada.
     *
     * Costo: 1 lectura si no toca (estado), y si toca 2 a 3 lecturas (estado, sala, y la respuesta una sola vez) y 2 escrituras
     * (estado y vista).
     *
     * @returns {Promise<{ ticked: boolean, reason?: string, intervention?: object|null, context?: object|null, judge?: object|null, ops: object }>}
     */
    async processTick(sessionId, { nowMs = Date.now(), config = {} } = {}) {
      const stateRef = db.doc(`learningSessions/${sessionId}/live/state`)
      const viewRef = db.doc(`learningSessions/${sessionId}/live/view`)
      const answerRef = db.doc(`learningSessions/${sessionId}/private/answer`)
      const ops = { reads: 0, writes: 0, attempts: 0 }

      const outcome = await db.runTransaction(async (tx) => {
        ops.attempts += 1
        const stateSnap = await tx.get(stateRef)
        ops.reads += 1
        if (!stateSnap.exists) return { ticked: false, reason: 'no-state' }
        const before = stateSnap.data()
        const plan = tickPlan(before, nowMs)
        if (!plan.run) return { ticked: false, reason: plan.reason }

        const sessionSnap = await tx.get(sessionRef(sessionId))
        ops.reads += 1
        const session = sessionSnap.exists ? sessionSnap.data() : null
        if (!session || session.status === 'completed') return { ticked: false, reason: 'closed' }

        let state = { ...before, lastT: plan.t, lastTickWallMs: nowMs }
        const activityId = activityIdOf(session)
        if (activityId !== null && state.answer?.id !== activityId) {
          const answerSnap = await tx.get(answerRef)
          ops.reads += 1
          const stored = answerSnap.exists ? answerSnap.data()?.expectedAnswer : undefined
          const value = Number(stored ?? session.currentProblem.expectedAnswer)
          state = { ...state, answer: { id: activityId, v: Number.isFinite(value) ? value : null } }
        }
        const problem = problemFromSession(session, state.answer?.v ?? undefined)
        const evaluated = evaluateDue(state, { problem, config: { ...config, disabledSignals: [] } })
        state = evaluated.state

        let context = null
        let judge = null
        if (evaluated.intervention) {
          context = {
            problem,
            memory: state.memory ?? {},
            transcriptTail: state.transcripts.slice(-TRANSCRIPT_TAIL).map(({ k, x }) => ({ k, x })),
            present: state.presence.map((p) => p.k),
          }
        } else if (evaluated.judge) {
          judge = {
            problem,
            t: state.lastT,
            classContext: [session?.courseId, session?.assessmentTitle].filter((x) => typeof x === 'string' && x).join(' · ') || null,
            transcriptTail: state.transcripts.slice(-JUDGE_TAIL).map(({ k, x }) => ({ k, x })),
            present: state.presence.map((p) => p.k),
          }
        }

        tx.set(stateRef, state)
        tx.set(viewRef, viewOf(state, { ...DEFAULT_CONFIG, ...config }))
        ops.writes = 2
        return { ticked: true, intervention: evaluated.intervention, context, judge }
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

    /**
     * Anota en el historial del estado una intervencion que NO salio de las reglas (la del observador), para que el
     * cooldown la recuerde. Usa arrayUnion: no pisa el resto del estado (1 escritura, solo cuando el tutor habla).
     */
    async recordIntervention(sessionId, { type, k = null, t }) {
      await db.doc(`learningSessions/${sessionId}/live/state`).update({ interventions: FieldValue.arrayUnion({ type, k, t }) })
    },

    /** Marca por donde se entrego una intervencion ya creada, p. ej. ['app', 'meet_chat'] (1 escritura). */
    async setDeliveredTo(sessionId, interventionId, deliveredTo) {
      await db.doc(`learningSessions/${sessionId}/agentInterventions/${interventionId}`).update({ deliveredTo })
    },

    /**
     * Cachea en live/state lo recordado de un estudiante en esta sesion (1 escritura, solo la primera vez
     * por estudiante y sesion). Es un update por campo: no pisa el resto del estado.
     */
    async cacheMemoryNotes(sessionId, studentKey, notes) {
      await db.doc(`learningSessions/${sessionId}/live/state`).update({ [`memory.${memoryCacheKey(studentKey)}`]: notes })
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

    /**
     * Si la sala no tiene problema (las crea el algoritmo de emparejamiento sin actividad), le asigna uno segun la
     * habilidad en foco de su grupo (matchingResults/{id}/groups/{groupId}.focusSkillIds). El enunciado va en la sesion
     * y la respuesta aparte, en private/answer. Una sala que ya tiene problema no se toca. Todo en una transaccion.
     *
     * @returns {Promise<{ assigned: boolean, skillId?: string }>}
     */
    async ensureProblem(sessionId) {
      return db.runTransaction(async (tx) => {
        const ref = sessionRef(sessionId)
        const snap = await tx.get(ref)
        if (!snap.exists) return { assigned: false }
        const session = snap.data()
        if (session.currentProblem) return { assigned: false }

        let skillIds = null
        if (session.matchingResultId && session.groupId) {
          const groupSnap = await tx.get(db.doc(`matchingResults/${session.matchingResultId}/groups/${session.groupId}`))
          skillIds = groupSnap.exists ? groupSnap.data().focusSkillIds : null
        }
        const problem = pickProblem({ skillIds, seed: sessionId })
        tx.update(ref, { currentProblem: { activityId: problem.activityId, skillId: problem.skillId, text: problem.text, auto: true } })
        tx.set(db.doc(`learningSessions/${sessionId}/private/answer`), { activityId: problem.activityId, expectedAnswer: problem.expectedAnswer })
        return { assigned: true, skillId: problem.skillId }
      })
    },

    /**
     * Calcula quien guia y quien aprende en la sala segun el diagnostico (dominio de cada integrante en la habilidad de la
     * sesion) y lo guarda en `private/context`: solo el servidor lo lee, porque es una pista para el tutor y no una etiqueta
     * que un nino deba ver. Idempotente: si ya existe no hace nada. Sin evaluacion o sin dominio de alguien, no guarda nada.
     *
     * @returns {Promise<{ created: boolean }>}
     */
    async ensureContext(sessionId) {
      const ref = db.doc(`learningSessions/${sessionId}/private/context`)
      return db.runTransaction(async (tx) => {
        const [contextSnap, sessionSnap] = await Promise.all([tx.get(ref), tx.get(sessionRef(sessionId))])
        if (contextSnap.exists || !sessionSnap.exists) return { created: false }

        const session = sessionSnap.data()
        const members = Array.isArray(session.members) ? session.members.filter((m) => typeof m?.studentId === 'string') : []
        const skillId = session.currentProblem?.skillId ?? null
        if (!session.assessmentId || !skillId || members.length < 2) return { created: false }

        const snaps = await Promise.all(members.map((m) => tx.get(db.doc(`assessmentModules/${session.assessmentId}/assignments/${m.studentId}`))))
        const mastery = {}
        snaps.forEach((snap, i) => {
          const skills = snap.exists ? snap.data()?.result?.skills : null
          const found = Array.isArray(skills) ? skills.find((skill) => skill?.skillId === skillId) : null
          mastery[members[i].studentId] = found?.mastery
        })

        const context = rolesOf({ members, mastery, skillId })
        if (!context) return { created: false }
        tx.set(ref, { ...context, createdFrom: 'assessment' })
        return { created: true }
      })
    },

    /**
     * Conexion de Google del docente (refresh token), o null. Vive en `teacherIntegrations/{uid}`: sin reglas para clientes,
     * asi que solo el servidor la lee y la escribe. El token nunca llega al navegador.
     */
    async getGoogleConnection(uid) {
      const snap = await db.doc(`teacherIntegrations/${uid}`).get()
      return snap.exists ? (snap.data().google ?? null) : null
    },

    /** Guarda (o reemplaza) la conexion de Google del docente (1 escritura). */
    async saveGoogleConnection(uid, { refreshToken, scope }) {
      await db.doc(`teacherIntegrations/${uid}`).set({ google: { refreshToken, scope, connectedAt: FieldValue.serverTimestamp() } }, { merge: true })
    },

    /**
     * Guarda el enlace de Meet creado por el servidor, SOLO si la sala sigue sin enlace (dos personas pueden entrar a la vez:
     * gana la primera y la otra recibe el enlace ya guardado). Una transaccion, 1 escritura.
     *
     * @returns {Promise<{ saved: boolean, meetingUrl: string|null }>}
     */
    async saveMeeting(sessionId, meetingUrl) {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(sessionRef(sessionId))
        if (!snap.exists) return { saved: false, meetingUrl: null }
        const current = snap.data().meetingUrl
        if (isValidMeetUrl(current)) return { saved: false, meetingUrl: current }
        tx.update(sessionRef(sessionId), { meetingUrl, meetingProvider: 'google-meet', meetingCreatedBy: 'server' })
        return { saved: true, meetingUrl }
      })
    },

    /** Contexto de la sala (roles segun el diagnostico), o null (1 lectura). */
    async getContext(sessionId) {
      const snap = await db.doc(`learningSessions/${sessionId}/private/context`).get()
      return snap.exists ? snap.data() : null
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

    // ---- Cierre de la sesion (close-session) ----

    /** live/state tal como esta guardado (1 lectura), o null. Solo lo usa el servidor. */
    async getLiveState(sessionId) {
      const snap = await db.doc(`learningSessions/${sessionId}/live/state`).get()
      return snap.exists ? snap.data() : null
    },

    /** Respuesta esperada guardada en private/answer (1 lectura), o null. */
    async getAnswer(sessionId) {
      const snap = await db.doc(`learningSessions/${sessionId}/private/answer`).get()
      return snap.exists ? snap.data() : null
    },

    /** summary/final (1 lectura), o null si la sesion aun no se cerro. */
    async getSummary(sessionId) {
      const snap = await db.doc(`learningSessions/${sessionId}/summary/final`).get()
      return snap.exists ? snap.data() : null
    },

    /**
     * Todas las transcripciones guardadas de la sesion, para armar el reporte (1 lectura por documento,
     * con tope). Es la unica vez que se lee la ventana completa: una vez, al cerrar, nunca por evento.
     *
     * @returns {Promise<{ k: string, t: number, e: number, x: string }[]>}
     */
    async getTranscripts(sessionId) {
      const snap = await db
        .collection(`learningSessions/${sessionId}/liveEvents`)
        .where('type', '==', 'transcript')
        .limit(MAX_CLOSE_TRANSCRIPTS)
        .get()
      return snap.docs
        .map((doc) => doc.data())
        .filter((event) => typeof event.participantKey === 'string' && Number.isFinite(event.t) && typeof event.text === 'string')
        .map((event) => ({ k: event.participantKey, t: event.t, e: Number.isFinite(event.tEnd) ? event.tEnd : event.t, x: event.text }))
    },

    /**
     * Intervenciones de la sesion, para medir que paso despues de cada una (1 lectura por documento, con tope).
     * @returns {Promise<{ id: string, signal: string, participantKey: string|null, t: number|null, style: string|null }[]>}
     */
    async getInterventions(sessionId) {
      const snap = await db.collection(`learningSessions/${sessionId}/agentInterventions`).limit(MAX_CLOSE_INTERVENTIONS).get()
      return snap.docs.map((doc) => {
        const data = doc.data()
        return { id: doc.id, signal: data.signal, participantKey: data.participantKey ?? null, t: Number.isFinite(data.t) ? data.t : null, style: data.style ?? null }
      })
    },

    /**
     * Perfil de aprendizaje de un estudiante (1 lectura), o null. Vive en `studentProfiles/{clave}`: sin reglas para
     * clientes, asi que solo el servidor lo lee y lo escribe. La clave es un seudonimo (uid o hash), nunca el nombre.
     */
    async getProfile(studentKey) {
      const snap = await db.doc(`studentProfiles/${profileDocId(studentKey)}`).get()
      return snap.exists ? snap.data().profile ?? null : null
    },

    /** Guarda el perfil de un estudiante (1 escritura). */
    async saveProfile(studentKey, profile) {
      await db.doc(`studentProfiles/${profileDocId(studentKey)}`).set({ profile, updatedAt: FieldValue.serverTimestamp() })
    },

    /** Guarda el reporte final y cierra la sesion en un solo lote (2 escrituras). */
    async saveClosure(sessionId, summary) {
      const batch = db.batch()
      batch.set(db.doc(`learningSessions/${sessionId}/summary/final`), { ...summary, closedAt: FieldValue.serverTimestamp() })
      batch.update(sessionRef(sessionId), { status: 'completed', endedAt: FieldValue.serverTimestamp(), 'bot.status': 'done' })
      await batch.commit()
    },

    async setBotId(sessionId, botId) {
      await sessionRef(sessionId).update({ 'bot.id': botId })
    },

    async markBotFailed(sessionId) {
      await sessionRef(sessionId).update({ 'bot.status': 'failed' })
    },
  }
}

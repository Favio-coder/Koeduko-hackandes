import { deterministicId } from './core/ids.js'
import { addresseeOf } from './core/interventionPolicy.js'
import { DEFAULT_CONFIG } from './core/signals.js'
import { chooseStyle, describeLearning } from './core/learning.js'
import { memoryQueryOf } from './core/memoryText.js'
import { memoryCacheKey, memoryScopeOf, studentKeyOf } from './core/studentKey.js'
import { describeProfile } from './core/studentProfile.js'
import { withTimeout } from './timeout.js'
import { synthesize } from './adapters/elevenlabs.js'
import { sendAudio, sendChatMessage } from './adapters/recall.js'
import { composeIntervention } from './tutor.js'

const PROFILE_TIMEOUT_MS = 1500
/** Lo que describeProfile devuelve cuando aun no hay nada que decir: no se manda al prompt. */
const NO_PATTERNS = 'Sin patrones claros aun.'

/**
 * La evidencia que se guarda la pueden leer los estudiantes de la sesion (reglas de Firestore),
 * asi que NUNCA lleva la respuesta esperada: ocultarla en la pantalla no basta si esta en el dato.
 */
function publicEvidence(evidence = {}) {
  return Object.fromEntries(Object.entries(evidence).filter(([key]) => key !== 'expectedAnswer'))
}

/**
 * Trabajo posterior al guardado de un evento en vivo. Corre dentro de waitUntil, DESPUES de
 * haberle respondido 200 a Recall, asi que una llamada lenta a Gemini no retrasa el webhook.
 *
 * Quien decide si se interviene y a quien es el motor de senales, dentro de la transaccion de
 * Firestore (processLiveEvent). Aqui solo se redacta el mensaje y se entrega: Gemini no decide nada.
 * Sin intervencion no hace nada: ni lecturas, ni escrituras, ni llamadas externas.
 *
 * Si la intervencion es nueva (create() tuvo exito) tambien se escribe en el chat de la reunion:
 * 1 lectura extra de la sesion (para el id del bot) y, si Recall responde 2xx, 1 escritura que marca
 * deliveredTo ['app', 'meet_chat']. Una intervencion repetida no se reenvia. Si el chat falla, la
 * intervencion igual queda en la app; solo se registra el estado HTTP, nunca el texto.
 *
 * Con memoria configurada, antes de redactar se recuerda lo que se sabe del destinatario de sesiones
 * anteriores (memoryNotes). La clave del estudiante sale de su uid o, si no esta enlazado, de un hash
 * del nombre dentro del aula/docente (ver core/studentKey.js). recall nunca rompe nada: si falla o
 * tarda mas de 2 s, no hay notas y el tutor habla como siempre. Lo recordado se cachea por estudiante y por
 * sesion en live/state.memory (viene en context.memory, sin lectura extra): una vez recordado, no se vuelve a
 * llamar. Costo: 1 lectura de la sesion (que el
 * chat reutiliza, no se lee dos veces) y 1 llamada externa, solo cuando hay una intervencion.
 *
 * @param {{
 *   getStore: () => { createIntervention: Function },
 *   getGenerate: () => (((input: object) => Promise<string>) | null),
 *   logger: { info: Function },
 *   getMemory?: () => ({ recall: (studentKey: string, query: string) => Promise<string[]> } | null),
 *   getChat?: () => ({ enabled: boolean, apiKey?: string, region?: string } | null),
 *   sendChat?: typeof sendChatMessage,
 *   cooldownSec?: number,
 *   logText?: boolean,
 *   now?: () => number,
 * }} deps
 */
export function createAfterLiveEventSaved({
  getStore,
  getGenerate,
  logger,
  getMemory = () => null,
  getChat = () => null,
  sendChat = sendChatMessage,
  getVoice = () => null,
  synthesizeSpeech = synthesize,
  sendAudioToBot = sendAudio,
  cooldownSec = DEFAULT_CONFIG.cooldownSec,
  logText = false,
  now = () => Date.now(),
}) {
  /** Lo que se sabe del destinatario de sesiones anteriores. Nunca lanza: sin memoria o con error, []. */
  async function recallNotes({ sessionId, intervention, problem, cached, loadSession }) {
    const none = { notes: [], cache: 'off' }
    const memory = getMemory()
    if (!memory || !intervention.participantKey) return none

    const loaded = await loadSession()
    if (loaded.failed) return none
    const key = studentKeyOf({
      studentId: intervention.studentId,
      participantKey: intervention.participantKey,
      scope: memoryScopeOf(loaded.session),
    })
    if (!key) return none

    // Ya se recordo a este estudiante en esta sesion (cache en live/state): sin llamada externa.
    const hit = cached?.[memoryCacheKey(key)]
    if (Array.isArray(hit)) return { notes: hit, cache: 'hit' }

    const query = memoryQueryOf(problem)
    let notes
    try {
      const recalled = await memory.recall(key, query)
      notes = Array.isArray(recalled) ? recalled : []
    } catch {
      return { notes: [], cache: 'miss' }
    }

    // Solo se cachea lo que SI se recordo: recall devuelve [] tanto cuando no hay memoria como cuando falla o
    // tarda, y cachear ese [] le quitaria la memoria a ese estudiante el resto de la sesion.
    if (notes.length > 0) {
      try {
        await getStore().cacheMemoryNotes(sessionId, key, notes)
      } catch {
        // El cache es una optimizacion: si no se pudo escribir, solo se repetira el recall.
      }
    }
    return { notes, cache: 'miss' }
  }

  /**
   * Que se sabe del destinatario como PERFIL (conteos guardados al cerrar sesiones anteriores) y que estilo de
   * intervencion elegir para el. Sin perfil, el estilo se elige igual (explorando). Nunca lanza.
   */
  async function learnFromProfile({ intervention, problem, sessionId, loadSession }) {
    const none = (profile) => ({ notes: [], style: null, reason: null, profile })
    const seed = `${sessionId}:${intervention.type}:${intervention.participantKey ?? 'grupo'}:${Math.floor(intervention.t)}`

    let profile = null
    const store = getStore()
    if (intervention.participantKey && typeof store.getProfile === 'function') {
      const loaded = await loadSession()
      if (!loaded.failed) {
        const key = studentKeyOf({ studentId: intervention.studentId, participantKey: intervention.participantKey, scope: memoryScopeOf(loaded.session) })
        if (key) {
          try {
            profile = await withTimeout(store.getProfile(key), PROFILE_TIMEOUT_MS)
          } catch {
            profile = null
          }
        }
      }
    }

    try {
      const { style, reason } = chooseStyle(profile, intervention.type, seed)
      const described = profile ? describeProfile(profile, { skillId: problem?.skillId }) : ''
      const learning = profile ? describeLearning(profile, intervention.type) : ''
      const notes = [described && described !== NO_PATTERNS ? described : '', learning].filter(Boolean)
      return { notes, style, reason, profile: Boolean(profile) }
    } catch {
      return none(Boolean(profile))
    }
  }

  /** Escribe el mensaje en el chat de Meet. Nunca lanza. No registra nada: eso lo hace deliver(). */
  async function sendToChat({ message, loadSession }) {
    const chat = getChat()
    if (!chat?.enabled || !chat.apiKey) return { ok: false, chat: 'disabled' }

    const loaded = await loadSession()
    if (loaded.failed) return { ok: false, chat: 'session-read-failed' }
    const bot = loaded.session?.bot
    if (!bot?.id) return { ok: false, chat: 'no-bot' }

    let sent
    try {
      sent = await sendChat({ apiKey: chat.apiKey, region: bot.region ?? chat.region, botId: bot.id, text: message })
    } catch {
      return { ok: false, chat: 'invalid' }
    }
    if (!sent.ok) return { ok: false, chat: 'failed', chatStatus: sent.status }
    return { ok: true, chat: 'sent', chatStatus: sent.status }
  }

  /**
   * Dice el mensaje en voz alta en la reunion (EXPERIMENTAL, apagado por defecto): ElevenLabs lo convierte en mp3 y
   * Recall lo reproduce. Nunca lanza; si algo falla el tutor sigue por chat. Solo registra estados HTTP, nunca el texto.
   */
  async function speak({ message, loadSession }) {
    const voice = getVoice()
    if (!voice?.enabled) return { ok: false, voice: 'disabled' }

    const loaded = await loadSession()
    if (loaded.failed) return { ok: false, voice: 'session-read-failed' }
    const bot = loaded.session?.bot
    if (!bot?.id) return { ok: false, voice: 'no-bot' }

    let audio
    try {
      audio = await synthesizeSpeech({ apiKey: voice.elevenKey, voiceId: voice.voiceId, modelId: voice.modelId, text: message })
    } catch {
      return { ok: false, voice: 'invalid' }
    }
    if (!audio.ok) return { ok: false, voice: 'tts-failed', voiceStatus: audio.status, ...(audio.code ? { voiceError: audio.code } : {}) }

    let sent
    try {
      sent = await sendAudioToBot({ apiKey: voice.apiKey, region: bot.region ?? voice.region, botId: bot.id, mp3Base64: audio.mp3Base64 })
    } catch {
      return { ok: false, voice: 'invalid' }
    }
    if (!sent.ok) return { ok: false, voice: 'failed', voiceStatus: sent.status }
    return { ok: true, voice: 'sent', voiceStatus: sent.status }
  }

  /** Entrega a Meet por chat y por voz EN PARALELO y anota por donde llego en un solo deliveredTo. Nunca lanza. */
  async function deliver({ sessionId, interventionId, message, loadSession }) {
    const [chat, voice] = await Promise.all([sendToChat({ message, loadSession }), speak({ message, loadSession })])
    const deliveredTo = ['app', ...(chat.ok ? ['meet_chat'] : []), ...(voice.ok ? ['meet_voice'] : [])]

    let recorded = true
    if (deliveredTo.length > 1) {
      try {
        await getStore().setDeliveredTo(sessionId, interventionId, deliveredTo)
      } catch {
        recorded = false
      }
    }
    const { ok: chatOk, ...chatInfo } = chat
    const { ok: voiceOk, ...voiceInfo } = voice
    return {
      ...chatInfo,
      ...voiceInfo,
      ...(recorded ? {} : { ...(chatOk ? { chat: 'sent-not-recorded' } : {}), ...(voiceOk ? { voice: 'sent-not-recorded' } : {}) }),
    }
  }

  return async function afterLiveEventSaved({ sessionId, result }) {
    const intervention = result?.intervention
    if (!intervention) return

    const startedAt = now()
    const context = result.context ?? {}

    // La sesion se lee como mucho una vez por intervencion y solo si algo la necesita (memoria o chat).
    let sessionLoad = null
    const loadSession = () => {
      sessionLoad ??= getStore()
        .getSession(sessionId)
        .then(
          (session) => ({ session }),
          () => ({ failed: true }),
        )
      return sessionLoad
    }

    const [recalled, learned] = await Promise.all([
      recallNotes({ sessionId, intervention, problem: context.problem ?? null, cached: context.memory, loadSession }),
      learnFromProfile({ intervention, problem: context.problem ?? null, sessionId, loadSession }),
    ])
    const { cache: memoryCache } = recalled
    // Lo que dice el perfil (patrones y estilo que le ha servido) va primero: es lo mas especifico del estudiante.
    const memoryNotes = [...learned.notes, ...recalled.notes]
    const composed = await composeIntervention({
      signal: intervention,
      problem: context.problem ?? null,
      transcriptTail: context.transcriptTail ?? [],
      memoryNotes,
      style: learned.style,
      generate: getGenerate(),
    })

    // Un id por (sesion, senal, destinatario, ventana de cooldown): create() falla si ya existe.
    const interventionId = deterministicId('int', [
      sessionId,
      intervention.type,
      intervention.participantKey ?? 'grupo',
      `b${Math.floor(intervention.t / cooldownSec)}`,
    ])

    const { created } = await getStore().createIntervention(sessionId, interventionId, {
      signal: intervention.type,
      targetStudentId: intervention.studentId ?? null,
      participantKey: intervention.participantKey ?? null,
      targetName: addresseeOf(intervention),
      evidence: publicEvidence(intervention.evidence),
      message: composed.message,
      source: composed.source,
      style: learned.style,
      deliveredTo: ['app'],
      t: intervention.t,
    })

    // Solo una intervencion nueva va al chat: si ya existia, ya se entrego (o se intento) antes.
    const delivery = created ? await deliver({ sessionId, interventionId, message: composed.message, loadSession }) : { chat: 'duplicate', voice: 'duplicate' }

    logger.info('afterLiveEventSaved: intervencion', {
      sessionId,
      type: intervention.type,
      created,
      memoryNotes: memoryNotes.length,
      memoryCache,
      style: learned.style,
      styleReason: learned.reason,
      profile: learned.profile,
      chat: delivery.chat,
      ...(delivery.chatStatus !== undefined ? { chatStatus: delivery.chatStatus } : {}),
      voice: delivery.voice,
      ...(delivery.voiceStatus !== undefined ? { voiceStatus: delivery.voiceStatus } : {}),
      ...(delivery.voiceError ? { voiceError: delivery.voiceError } : {}),
      source: composed.source,
      ...(composed.reason ? { reason: composed.reason } : {}),
      ms: now() - startedAt,
      // El texto menciona a un nino por su nombre: solo se registra si se pide expresamente.
      ...(logText ? { text: composed.message } : {}),
    })
  }
}

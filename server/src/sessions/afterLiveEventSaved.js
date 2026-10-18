import { deterministicId } from './core/ids.js'
import { addresseeOf } from './core/interventionPolicy.js'
import { DEFAULT_CONFIG } from './core/signals.js'
import { memoryScopeOf, studentKeyOf } from './core/studentKey.js'
import { sendChatMessage } from './adapters/recall.js'
import { composeIntervention } from './tutor.js'

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
 * tarda mas de 2 s, no hay notas y el tutor habla como siempre. Costo: 1 lectura de la sesion (que el
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
  cooldownSec = DEFAULT_CONFIG.cooldownSec,
  logText = false,
  now = () => Date.now(),
}) {
  /** Lo que se sabe del destinatario de sesiones anteriores. Nunca lanza: sin memoria o con error, []. */
  async function recallNotes({ intervention, problem, loadSession }) {
    const memory = getMemory()
    if (!memory || !intervention.participantKey) return []

    const loaded = await loadSession()
    if (loaded.failed) return []
    const key = studentKeyOf({
      studentId: intervention.studentId,
      participantKey: intervention.participantKey,
      scope: memoryScopeOf(loaded.session),
    })
    if (!key) return []

    const query = problem ? `${problem.skillId ?? 'matemática'}: ${problem.text ?? ''}`.trim() : 'resolución de problemas de matemática'
    try {
      const notes = await memory.recall(key, query)
      return Array.isArray(notes) ? notes : []
    } catch {
      return []
    }
  }

  /** Escribe el mensaje en el chat de Meet. Nunca lanza; devuelve que paso para el log. */
  async function deliverToMeetChat({ sessionId, interventionId, message, loadSession }) {
    const chat = getChat()
    if (!chat?.enabled || !chat.apiKey) return { deliveredTo: ['app'], chat: 'disabled' }

    const loaded = await loadSession()
    if (loaded.failed) return { deliveredTo: ['app'], chat: 'session-read-failed' }
    const bot = loaded.session?.bot
    if (!bot?.id) return { deliveredTo: ['app'], chat: 'no-bot' }

    let sent
    try {
      sent = await sendChat({ apiKey: chat.apiKey, region: bot.region ?? chat.region, botId: bot.id, text: message })
    } catch {
      return { deliveredTo: ['app'], chat: 'invalid' }
    }
    if (!sent.ok) return { deliveredTo: ['app'], chat: 'failed', chatStatus: sent.status }

    const deliveredTo = ['app', 'meet_chat']
    try {
      await getStore().setDeliveredTo(sessionId, interventionId, deliveredTo)
    } catch {
      return { deliveredTo: ['app'], chat: 'sent-not-recorded', chatStatus: sent.status }
    }
    return { deliveredTo, chat: 'sent', chatStatus: sent.status }
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

    const memoryNotes = await recallNotes({ intervention, problem: context.problem ?? null, loadSession })
    const composed = await composeIntervention({
      signal: intervention,
      problem: context.problem ?? null,
      transcriptTail: context.transcriptTail ?? [],
      memoryNotes,
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
      deliveredTo: ['app'],
      t: intervention.t,
    })

    // Solo una intervencion nueva va al chat: si ya existia, ya se entrego (o se intento) antes.
    const delivery = created ? await deliverToMeetChat({ sessionId, interventionId, message: composed.message, loadSession }) : { chat: 'duplicate' }

    logger.info('afterLiveEventSaved: intervencion', {
      sessionId,
      type: intervention.type,
      created,
      memoryNotes: memoryNotes.length,
      chat: delivery.chat,
      ...(delivery.chatStatus !== undefined ? { chatStatus: delivery.chatStatus } : {}),
      source: composed.source,
      ...(composed.reason ? { reason: composed.reason } : {}),
      ms: now() - startedAt,
      // El texto menciona a un nino por su nombre: solo se registra si se pide expresamente.
      ...(logText ? { text: composed.message } : {}),
    })
  }
}

import { deterministicId } from './core/ids.js'
import { addresseeOf } from './core/interventionPolicy.js'
import { DEFAULT_CONFIG } from './core/signals.js'
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
 * @param {{
 *   getStore: () => { createIntervention: Function },
 *   getGenerate: () => (((input: object) => Promise<string>) | null),
 *   logger: { info: Function },
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
  getChat = () => null,
  sendChat = sendChatMessage,
  cooldownSec = DEFAULT_CONFIG.cooldownSec,
  logText = false,
  now = () => Date.now(),
}) {
  /** Escribe el mensaje en el chat de Meet. Nunca lanza; devuelve que paso para el log. */
  async function deliverToMeetChat({ sessionId, interventionId, message }) {
    const chat = getChat()
    if (!chat?.enabled || !chat.apiKey) return { deliveredTo: ['app'], chat: 'disabled' }

    let bot
    try {
      bot = (await getStore().getSession(sessionId))?.bot
    } catch {
      return { deliveredTo: ['app'], chat: 'session-read-failed' }
    }
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
    const composed = await composeIntervention({
      signal: intervention,
      problem: context.problem ?? null,
      transcriptTail: context.transcriptTail ?? [],
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
    const delivery = created ? await deliverToMeetChat({ sessionId, interventionId, message: composed.message }) : { chat: 'duplicate' }

    logger.info('afterLiveEventSaved: intervencion', {
      sessionId,
      type: intervention.type,
      created,
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

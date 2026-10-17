import { deterministicId } from './core/ids.js'
import { DEFAULT_CONFIG } from './core/signals.js'
import { composeIntervention } from './tutor.js'

/**
 * Trabajo posterior al guardado de un evento en vivo. Corre dentro de waitUntil, DESPUES de
 * haberle respondido 200 a Recall, asi que una llamada lenta a Gemini no retrasa el webhook.
 *
 * Quien decide si se interviene y a quien es el motor de senales, dentro de la transaccion de
 * Firestore (processLiveEvent). Aqui solo se redacta el mensaje y se entrega: Gemini no decide nada.
 * Sin intervencion no hace nada: ni lecturas, ni escrituras, ni llamadas externas.
 *
 * @param {{
 *   getStore: () => { createIntervention: Function },
 *   getGenerate: () => (((input: object) => Promise<string>) | null),
 *   logger: { info: Function },
 *   cooldownSec?: number,
 *   logText?: boolean,
 *   now?: () => number,
 * }} deps
 */
export function createAfterLiveEventSaved({
  getStore,
  getGenerate,
  logger,
  cooldownSec = DEFAULT_CONFIG.cooldownSec,
  logText = false,
  now = () => Date.now(),
}) {
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
      evidence: intervention.evidence,
      message: composed.message,
      source: composed.source,
      deliveredTo: ['app'],
      t: intervention.t,
    })

    logger.info('afterLiveEventSaved: intervencion', {
      sessionId,
      type: intervention.type,
      created,
      source: composed.source,
      ...(composed.reason ? { reason: composed.reason } : {}),
      ms: now() - startedAt,
      // El texto menciona a un nino por su nombre: solo se registra si se pide expresamente.
      ...(logText ? { message: composed.message } : {}),
    })
  }
}

/**
 * Gancho de trabajo posterior al guardado de un evento en vivo.
 *
 * Corre dentro de waitUntil, es decir, DESPUES de haberle respondido 200 a Recall, sin
 * retrasar el webhook. Aqui se enchufaran despues el motor de senales y el tutor; por
 * ahora no hace nada a proposito.
 *
 * Cuando se implemente recibira `{ sessionId, eventId, event }` (el evento ya guardado).
 *
 * @returns {Promise<void>}
 */
export async function afterLiveEventSaved() {}

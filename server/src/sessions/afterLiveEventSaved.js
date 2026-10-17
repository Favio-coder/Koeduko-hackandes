/**
 * Gancho de trabajo posterior al guardado de un evento en vivo.
 *
 * Corre dentro de waitUntil, es decir, DESPUES de haberle respondido 200 a Recall, sin
 * retrasar el webhook. Aqui se enchufaran despues el motor de senales y el tutor; por
 * ahora no hace nada a proposito.
 *
 * @param {{ sessionId: string, eventId: string, event: object }} _saved
 * @returns {Promise<void>}
 */
export async function afterLiveEventSaved(_saved) {}

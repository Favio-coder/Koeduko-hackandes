import { isValidMeetUrl } from './core/meetUrl.js'
import { createSpace, refreshAccessToken } from './adapters/googleMeet.js'

/**
 * Si la sala no tiene enlace de Meet, lo crea con la cuenta de Google que el docente dueno de la sala conecto. Nunca lanza:
 * devuelve por que no lo creo (sirve para el log y para explicarle al docente que falta). Una sala que ya tiene enlace no se toca.
 *
 * @param {{
 *   sessionId: string,
 *   store: { getSession: Function, getGoogleConnection: Function, saveMeeting: Function },
 *   google: { enabled: boolean, clientId?: string, clientSecret?: string, accessType?: string } | null,
 *   refresh?: typeof refreshAccessToken,
 *   create?: typeof createSpace,
 * }} input
 * @returns {Promise<{ created: boolean, meetingUrl?: string, reason?: string }>}
 */
export async function ensureMeeting({ sessionId, store, google, refresh = refreshAccessToken, create = createSpace }) {
  try {
    const session = await store.getSession(sessionId)
    if (!session) return { created: false, reason: 'not-found' }
    if (isValidMeetUrl(session.meetingUrl)) return { created: false, reason: 'has-link' }
    if (!google?.enabled) return { created: false, reason: 'google-not-configured' }

    const connection = await store.getGoogleConnection(session.createdBy)
    if (!connection?.refreshToken) return { created: false, reason: 'teacher-not-connected' }

    const accessToken = await refresh({ clientId: google.clientId, clientSecret: google.clientSecret, refreshToken: connection.refreshToken })
    const { meetingUrl } = await create({ accessToken, accessType: google.accessType ?? 'OPEN' })
    const saved = await store.saveMeeting(sessionId, meetingUrl)
    return { created: saved.saved === true, meetingUrl: saved.meetingUrl }
  } catch (error) {
    return { created: false, reason: `failed:${error?.code ?? error?.status ?? error?.name ?? 'error'}` }
  }
}

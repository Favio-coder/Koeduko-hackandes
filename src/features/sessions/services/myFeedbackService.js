import { postToServer } from '@/services/serverApi'

/**
 * Pide al servidor la devolución de ESTE alumno al cerrarse la sala: solo su parte, ya convertida en frases amables, sin notas,
 * sin citas y sin nada de sus compañeros. @returns {Promise<{ ready: boolean, feedback?: object|null }>}
 */
export const fetchMyFeedback = ({ sessionId }, { post = postToServer } = {}) =>
  post('/api/my-summary', { sessionId }, { subject: 'el servidor de sesiones' })

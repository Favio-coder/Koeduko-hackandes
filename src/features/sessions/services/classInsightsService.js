import { postToServer } from '@/services/serverApi'

/**
 * Lo que más cuesta en TODAS las salas del docente, acumulado al cerrar cada una. Solo conteos (sin nombres ni citas).
 * @returns {Promise<{ sessions: number, students: number, capacities: { id: string, nombre: string, con: number, parcial: number, sin: number, total: number, sinPct: number }[] }>}
 */
export const fetchClassInsights = ({ post = postToServer } = {}) => post('/api/class-insights', {}, { subject: 'el servidor de sesiones' })

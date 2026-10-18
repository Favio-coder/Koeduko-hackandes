import { adminServices } from '../server/firebaseAdmin.js'
import { FieldValue } from 'firebase-admin/firestore'
import { AssessmentError } from '../server/assessments/domain.js'
import { publishGroupSessions, registerMeeting } from '../server/assessments/groupSessions.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Usa POST.' }) }
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return res.status(401).json({ error: 'Inicia sesión.' })
    const { auth, db } = adminServices()
    let identity
    try { identity = await auth.verifyIdToken(token, true) }
    catch { return res.status(401).json({ error: 'Sesión inválida o vencida.' }) }
    let body
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body }
    catch { return res.status(400).json({ error: 'JSON inválido.' }) }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 100000) return res.status(400).json({ error: 'Solicitud inválida.' })
    if (!['publish', 'meeting'].includes(body.action)) return res.status(400).json({ error: 'Acción inválida.' })
    const data = body.action === 'publish' ? await publishGroupSessions(db, identity.uid, body, () => FieldValue.serverTimestamp()) : await registerMeeting(db, identity.uid, body)
    return res.status(200).json(data)
  } catch (error) {
    if (error instanceof AssessmentError) return res.status(error.status).json({ error: error.message })
    console.error('group-sessions', error.code || error.name)
    return res.status(500).json({ error: 'No se pudo guardar la sala. Inténtalo de nuevo.' })
  }
}

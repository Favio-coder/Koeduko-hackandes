import { adminServices } from '../server/firebaseAdmin.js'
import { AssessmentError } from '../server/assessments/domain.js'
import { createAssessmentService } from '../server/assessments/service.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Usa POST.' }) }
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return res.status(401).json({ error: 'Inicia sesión.' })
    const { auth, db } = adminServices()
    let identity
    try { identity = await auth.verifyIdToken(token, true) } catch { return res.status(401).json({ error: 'Sesión inválida o vencida.' }) }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!body || Buffer.byteLength(JSON.stringify(body), 'utf8') > 250000) return res.status(400).json({ error: 'Solicitud inválida o demasiado grande.' })
    const data = await createAssessmentService(db)(identity.uid, body.action, body.payload)
    return res.status(200).json(data)
  } catch (error) {
    if (error instanceof AssessmentError) return res.status(error.status).json({ error: error.message })
    console.error('assessment-api', error.code || error.name)
    return res.status(500).json({ error: 'No se pudo completar la operación. Conserva tus respuestas y vuelve a intentar.' })
  }
}

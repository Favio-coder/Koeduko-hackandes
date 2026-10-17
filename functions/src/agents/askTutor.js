import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { requireUser, db } from '../admin.js'
import { buildTutorPayload } from './tutorPrompt.js'

/**
 * GEMINI_API_KEY se define como secreto: no vive en el repositorio ni en
 * variables VITE_. Configurar con: firebase functions:secrets:set GEMINI_API_KEY
 */
const geminiApiKey = defineSecret('GEMINI_API_KEY')

/**
 * Funcion principal del tutor IA.
 * El cliente NUNCA llama a Gemini directamente.
 *
 * @param {{ sessionId: string, prompt: string }} data
 * @returns {Promise<{ reply: string }>}
 */
export const askTutor = onCall(
  { region: 'europe-west1', secrets: [geminiApiKey], timeoutSeconds: 60 },
  async (request) => {
    const user = await requireUser(request)
    const { sessionId, prompt } = request.data || {}

    if (!sessionId || !prompt || !String(prompt).trim()) {
      throw new HttpsError('invalid-argument', 'sessionId y prompt son obligatorios.')
    }

    const sessionRef = db.doc(`learningSessions/${sessionId}`)
    const sessionSnap = await sessionRef.get()
    if (!sessionSnap.exists) throw new HttpsError('not-found', 'La sesion no existe.')

    const { systemInstruction } = buildTutorPayload({
      prompt: String(prompt),
      skillLabel: 'Resuelve problemas de cantidad',
      level: 1,
    })

    const model = `gemini-2.0-flash:generateContent?key=${geminiApiKey.value()}`
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: String(prompt) }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
      }),
    })

    if (!response.ok) {
      throw new HttpsError('internal', 'El servicio de tutor no respondio correctamente.')
    }

    const payload = await response.json()
    const reply =
      payload?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ').trim() ||
      'No pude generar una pista. Intenta reformular la pregunta.'

    await sessionRef.collection('tutorInteractions').add({
      studentId: user.uid,
      sessionId,
      prompt: String(prompt),
      response: reply,
      hintLevel: 1,
      createdAt: new Date(),
    })

    return { reply }
  },
)
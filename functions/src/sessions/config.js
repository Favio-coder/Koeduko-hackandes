import { defineSecret, defineString } from 'firebase-functions/params'

/** Misma region que askTutor. Cambiarla exige actualizar tambien el cliente (getFunctions). */
export const SESSIONS_REGION = 'europe-west1'

/**
 * Secretos: firebase functions:secrets:set NOMBRE. Nunca en el repo ni en variables VITE_.
 */
export const recallApiKey = defineSecret('RECALL_API_KEY')
export const recallWebhookToken = defineSecret('RECALL_WEBHOOK_TOKEN')

/** Region de la cuenta de Recall (no es secreto). */
export const recallRegion = defineString('RECALL_REGION', { default: 'us-west-2' })

/**
 * Idioma de Deepgram. Si Recall/Deepgram rechaza "es", cambiar a "multi" sin tocar codigo.
 */
export const recallLanguage = defineString('RECALL_TRANSCRIPT_LANGUAGE', { default: 'es' })

/**
 * URL publica de recallWebhook. Vacia = se deriva del proyecto y la region:
 * https://<region>-<project>.cloudfunctions.net/recallWebhook
 */
export const recallWebhookUrl = defineString('RECALL_WEBHOOK_URL', { default: '' })

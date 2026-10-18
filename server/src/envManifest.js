/**
 * Manifiesto de variables de entorno: la FUENTE UNICA de que variables usa el codigo, para que sirven,
 * donde se obtienen y si son secretas. De aqui salen los .env.example (scripts/writeEnvExample.js) y la
 * comprobacion `npm run check:env`. Un test (envManifest.test.js) falla si el codigo lee una variable que no
 * esta aqui. Nunca contiene valores.
 *
 * target: 'server'   -> proyecto Vercel `ko_eduko` (carpeta server/)
 *         'frontend' -> proyecto Vercel del frontend (raiz); solo variables VITE_ publicas
 */

/** @typedef {{ name: string, target: 'server'|'frontend', required: boolean, secret: boolean, purpose: string, source: string, default?: string }} EnvVar */

/** @type {EnvVar[]} */
export const ENV_MANIFEST = [
  // ---- servidor: obligatorias ----
  {
    name: 'FIREBASE_SERVICE_ACCOUNT_B64',
    target: 'server',
    required: true,
    secret: true,
    purpose: 'Cuenta de servicio de Firebase (JSON en base64) para el Admin SDK: leer y escribir Firestore y verificar tokens.',
    source: 'Firebase Console > Configuracion del proyecto > Cuentas de servicio > Generar clave; luego codificar el JSON en base64.',
  },
  {
    name: 'RECALL_API_KEY',
    target: 'server',
    required: true,
    secret: true,
    purpose: 'Recall.ai: crear y sacar bots de la reunion y escribir en el chat de Meet.',
    source: 'Recall.ai dashboard > API Keys (una clave con nombre propio para este proyecto).',
  },
  {
    name: 'RECALL_REGION',
    target: 'server',
    required: true,
    secret: false,
    purpose: 'Region del workspace de Recall.ai.',
    source: 'Recall.ai dashboard; por ejemplo us-west-2.',
  },
  {
    name: 'RECALL_WEBHOOK_URL',
    target: 'server',
    required: true,
    secret: false,
    purpose: 'URL publica y https de /api/recall-webhook, que Recall llama con cada evento en vivo.',
    source: 'https://<dominio-del-backend>/api/recall-webhook',
  },
  {
    name: 'RECALL_WEBHOOK_TOKEN',
    target: 'server',
    required: true,
    secret: true,
    purpose: 'Token que el webhook exige en ?token=. Nuestra autenticacion: Recall no firma estos eventos.',
    source: 'Generarlo al azar (por ejemplo, 24 bytes en hexadecimal) y rotarlo si se filtra.',
  },
  {
    name: 'ALLOWED_ORIGINS',
    target: 'server',
    required: true,
    secret: false,
    purpose: 'Origenes del frontend que pueden llamar al backend desde el navegador (CORS), separados por coma. http://localhost:5173 siempre esta permitido.',
    source: 'URLs exactas del frontend desplegado y de su preview, sin barra final.',
  },
  // ---- servidor: opcionales ----
  {
    name: 'RECALL_TRANSCRIPT_LANGUAGE',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Idioma de la transcripcion (Deepgram, via Recall).',
    source: 'Codigo de idioma.',
    default: 'es',
  },
  {
    name: 'GEMINI_API_KEY',
    target: 'server',
    required: false,
    secret: true,
    purpose: 'Gemini: redactar las intervenciones del tutor y clasificar frases dudosas. Sin ella el tutor usa su mensaje de respaldo.',
    source: 'Google AI Studio > Get API key.',
  },
  {
    name: 'GEMINI_MODEL',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Modelo de Gemini fijado (no "latest"). Sin el, el tutor usa su mensaje de respaldo.',
    source: 'gemini-3.6-flash (verificado en vivo; 3.7 y 3.8 no sirven).',
  },
  {
    name: 'ATOMICMEMORY_API_KEY',
    target: 'server',
    required: false,
    secret: true,
    purpose: 'AtomicMemory: memoria por estudiante entre sesiones. Sin ella se usa solo el respaldo en Firestore.',
    source: 'memory.atomicstrata.ai > API Keys.',
  },
  {
    name: 'ATOMICMEMORY_API_URL',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'URL de la API de AtomicMemory.',
    source: 'https://api.atomicstrata.ai',
  },
  {
    name: 'MEMORY_ENABLED',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Interruptor de la memoria por estudiante (false, 0, off o no la apagan). Se aplica en el siguiente despliegue.',
    source: 'Decision del equipo.',
    default: 'true',
  },
  {
    name: 'MEET_CHAT_ENABLED',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Interruptor del mensaje del tutor en el chat de Meet (false, 0, off o no lo apagan). Se aplica en el siguiente despliegue.',
    source: 'Decision del equipo.',
    default: 'true',
  },
  {
    name: 'GEMINI_FALLBACK_MODEL',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Modelo de Gemini al que pasa el reintento cuando el principal responde 429 o 5xx (otro modelo suele tener su propia cuota). Sin el, el reintento usa el mismo.',
    source: 'Google AI Studio (nombre exacto del modelo).',
  },
  {
    name: 'GEMINI_JUDGE_MODEL',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Modelo del observador de la conversacion (puede ser uno mas liviano que GEMINI_MODEL para no gastar la cuota de las intervenciones). Sin el usa GEMINI_MODEL.',
    source: 'Google AI Studio (nombre exacto del modelo).',
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'ID de cliente OAuth de Google. Con el secreto, el servidor crea las reuniones de Meet de las salas con la cuenta que el docente conecta. Sin ellos el docente registra el enlace a mano.',
    source: 'Google Cloud Console > APIs y servicios > Credenciales (cliente OAuth de tipo Aplicacion web).',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    target: 'server',
    required: false,
    secret: true,
    purpose: 'Secreto del cliente OAuth de Google. Tambien firma el parametro state del flujo de autorizacion.',
    source: 'Google Cloud Console > Credenciales (JSON descargado del cliente).',
  },
  {
    name: 'GOOGLE_REDIRECT_URI',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'URI a la que Google devuelve al docente despues de autorizar. Debe estar registrada en el cliente OAuth.',
    source: 'Debe ser https://<backend>/api/google-callback.',
    default: 'https://koeduko.vercel.app/api/google-callback',
  },
  {
    name: 'GOOGLE_MEET_ACCESS',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Tipo de acceso de las reuniones que crea el servidor: OPEN (entra quien tenga el enlace, sin sala de espera), TRUSTED o RESTRICTED. OPEN deja entrar al bot sin que lo admitan, pero tambien a cualquiera que tenga el enlace.',
    source: 'Decision del equipo.',
    default: 'OPEN',
  },
  {
    name: 'CONVERSATION_JUDGE_ENABLED',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Observador de la conversacion: cada ~30 s un modelo lee lo que dicen (de cualquier tema, con o sin problema) y decide hablar o callar cuando las reglas no dicen nada. false lo apaga.',
    source: 'Decision del equipo.',
    default: 'true',
  },
  {
    name: 'MEET_VOICE_ENABLED',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'EXPERIMENTAL. Interruptor de la voz del tutor en la reunion (true la enciende). Los bots creados con ella apagada no hablan. Recall no recomienda output_audio para voz dinamica: se valida en vivo y, si falla, se deja apagada.',
    source: 'Decision del equipo; necesita ELEVENLABS_API_KEY.',
    default: 'false',
  },
  {
    name: 'ELEVENLABS_API_KEY',
    target: 'server',
    required: false,
    secret: true,
    purpose: 'ElevenLabs: texto a voz del tutor. El plan gratuito es solo para uso no comercial. Sin ella no hay voz.',
    source: 'elevenlabs.io > Developers > API Keys.',
  },
  {
    name: 'ELEVENLABS_VOICE_ID',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Id de la voz de ElevenLabs. Conviene una voz que hable bien espanol.',
    source: 'elevenlabs.io > Voices (la voz debe estar disponible para tu plan).',
    default: 'JBFqnCBsd6RMkjVDRZzb',
  },
  {
    name: 'ELEVENLABS_MODEL_ID',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Modelo de texto a voz de ElevenLabs (baja latencia, soporta espanol).',
    source: 'elevenlabs.io/docs/overview/models',
    default: 'eleven_flash_v2_5',
  },
  {
    name: 'LOG_INTERVENTION_TEXT',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Solo depuracion: registra el texto de las intervenciones, que nombra a un nino. En produccion debe estar sin definir.',
    source: '1 para activarlo.',
  },
  {
    name: 'GOOGLE_APPLICATION_CREDENTIALS',
    target: 'server',
    required: false,
    secret: false,
    purpose: 'Solo para scripts locales: ruta a credenciales por defecto de Google (ADC) como alternativa a FIREBASE_SERVICE_ACCOUNT_B64.',
    source: 'gcloud auth application-default login.',
  },
  // ---- frontend: publicas (viajan en el bundle del navegador) ----
  ...[
    ['VITE_FIREBASE_API_KEY', 'Clave web de Firebase.'],
    ['VITE_FIREBASE_AUTH_DOMAIN', 'Dominio de Firebase Auth.'],
    ['VITE_FIREBASE_PROJECT_ID', 'Id del proyecto Firebase.'],
    ['VITE_FIREBASE_STORAGE_BUCKET', 'Bucket de Firebase Storage.'],
    ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'Sender id de Firebase.'],
    ['VITE_FIREBASE_APP_ID', 'App id de la app web de Firebase.'],
  ].map(([name, purpose]) => ({
    name,
    target: 'frontend',
    required: true,
    secret: false,
    purpose: `${purpose} Es publica: va en el bundle del navegador; la barrera de seguridad son las reglas de Firestore.`,
    source: 'Firebase Console > Configuracion del proyecto > Tus apps > Configuracion de SDK.',
  })),
  {
    name: 'VITE_SERVER_URL',
    target: 'frontend',
    required: false,
    secret: false,
    purpose: 'URL del backend de sesiones (ko_eduko). Sin ella el frontend usa https://koeduko.vercel.app.',
    source: 'URL de produccion del backend, o http://localhost:3000 con `vercel dev`.',
    default: 'https://koeduko.vercel.app',
  },
]

/** Variables que el codigo lee pero que son del sistema operativo, no nuestras. */
export const SYSTEM_ENV = Object.freeze(['APPDATA'])

/**
 * Compara el manifiesto con los NOMBRES presentes en un entorno. Pura; nunca ve valores.
 *
 * @param {{ target?: 'server'|'frontend'|'all', present: Iterable<string> }} input
 * @returns {{ missingRequired: EnvVar[], missingOptional: EnvVar[], ok: EnvVar[] }}
 */
export function checkEnv({ target = 'all', present }) {
  const have = new Set(present)
  const wanted = ENV_MANIFEST.filter((entry) => target === 'all' || entry.target === target)
  return {
    missingRequired: wanted.filter((e) => e.required && !have.has(e.name)),
    missingOptional: wanted.filter((e) => !e.required && !have.has(e.name)),
    ok: wanted.filter((e) => have.has(e.name)),
  }
}

/**
 * Texto de un .env.example: por variable, para que sirve, donde se obtiene y si es secreta. SIN valores
 * (salvo el valor por defecto, que es publico y esta documentado).
 *
 * @param {'server'|'frontend'} target
 */
export function renderEnvExample(target) {
  const header =
    target === 'server'
      ? [
          '# Backend de sesiones en vivo (proyecto Vercel ko_eduko). Generado desde src/envManifest.js: no editar a mano.',
          '# Copiar a server/.env.local SOLO para desarrollo local; en produccion van como variables del proyecto en Vercel.',
          '# Las marcadas SECRETA nunca se commitean, se pegan en chats ni se imprimen en logs.',
        ]
      : [
          '# Frontend (Vite). Generado desde server/src/envManifest.js: no editar a mano.',
          '# Solo variables PUBLICAS: todo lo que empieza con VITE_ viaja en el bundle del navegador.',
          '# Los secretos del backend NO van aqui: ver server/.env.example.',
        ]

  const blocks = ENV_MANIFEST.filter((entry) => entry.target === target).map((entry) => {
    const lines = [
      `# ${entry.purpose}`,
      `# Donde se obtiene: ${entry.source}`,
      `# ${entry.secret ? 'SECRETA' : 'No secreta'} · ${entry.required ? 'Obligatoria' : 'Opcional'}${entry.default ? ` · Por defecto: ${entry.default}` : ''}`,
      `${entry.name}=`,
    ]
    return lines.join('\n')
  })

  return `${header.join('\n')}\n\n${blocks.join('\n\n')}\n`
}

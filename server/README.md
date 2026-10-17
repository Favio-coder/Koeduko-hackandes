# server/ — backend de sesiones en vivo (Vercel)

Funciones serverless que conectan el bot de Recall.ai dentro de Google Meet con Firestore.
Es un proyecto Vercel **independiente**: todo lo que se despliega vive dentro de `server/`
y nada importa código de fuera de esta carpeta.

## Decisión: servidor en Vercel y no en Firebase Functions

El proyecto Firebase `koeduko-app` **no puede usar el plan Blaze**, y Cloud Functions (y sus
secretos) lo exigen para desplegar. Por eso:

- **Firestore y Auth siguen en Firebase** (plan gratuito).
- **El servidor del módulo de sesiones corre en Vercel**, con variables de entorno de Vercel
  como secretos y `firebase-admin` con una cuenta de servicio para escribir en Firestore.
- Consecuencia pendiente: `functions/askTutor` (Gemini) tampoco puede desplegarse con Firebase
  sin Blaze, así que el tutor tendrá que moverse también a `server/`.

## Flujo

```text
Docente → POST /api/start-session-bot (Bearer = ID token de Firebase)
            └─ verifica el token y exige users/{uid}.role == "teacher"
            └─ reserva bot:{id:null,status:"requested"} en una transacción (anti-duplicados)
            └─ Recall: crea el bot con el enlace de Meet guardado en la sesión
Recall → POST /api/recall-webhook?token=...   (eventos en tiempo real)
            └─ compara el token en tiempo constante (401 si falla; 200 en todo lo demás)
            └─ normaliza el evento y lo guarda, sin duplicados, en
               learningSessions/{sessionId}/liveEvents/{eventId}
            └─ waitUntil(afterLiveEventSaved): gancho para señales y tutor (hoy vacío)
```

| Carpeta | Contenido |
| --- | --- |
| `api/` | Bordes HTTP delgados (`recall-webhook.js`, `start-session-bot.js`). Solo aquí se lee `process.env`. |
| `src/sessions/core/` | Lógica pura y testeable: normalizar eventos, validar enlaces de Meet, reglas anti-duplicado. |
| `src/sessions/adapters/` | Recall (`recall.js`) y Firestore (`sessionStore.js`). |
| `src/sessions/http/` | Handlers con dependencias inyectadas, probados sin Vercel. |
| `src/firebaseAdmin.js` | Inicializa `firebase-admin` con `FIREBASE_SERVICE_ACCOUNT_B64`. |

## Variables de entorno (Production, tipo Secret)

`FIREBASE_SERVICE_ACCOUNT_B64` (JSON de la cuenta de servicio en base64), `RECALL_API_KEY`,
`RECALL_WEBHOOK_TOKEN`, `RECALL_WEBHOOK_URL` (`https://<dominio>/api/recall-webhook`) y
`RECALL_REGION` (`us-west-2`). Opcional: `RECALL_TRANSCRIPT_LANGUAGE` (por defecto `es`).
Nunca van en el repositorio, en el frontend ni en los logs.

## Pruebas

```bash
npm --prefix server ci
npm --prefix server test
```

## Resultados de la prueba de humo real (17-oct-2026)

Reunión de Google Meet con 3 participantes, ~110 s, español, Deepgram `nova-3` vía Recall.

| Medida | Resultado |
| --- | --- |
| Eventos `speech_on` / `speech_off` recibidos y guardados | 115 / 115 |
| Eventos `transcript.data` recibidos y guardados | 35 fragmentos de streaming (el transcript consolidado que se descarga de Recall tiene el mismo texto agrupado en 29 turnos de habla) |
| Eventos `join` / `leave` guardados | 3 / 3 |
| Errores de guardado | 0 |
| Latencia de eventos de habla (Recall → guardado) | ~0,1 a 0,35 s |
| Latencia de transcripción (fin de la frase → guardado) | ~1,1 a 1,9 s |

Los datos de esta prueba, anonimizados, están en `fixtures/smoke-001.json` (plan B de la demo y
datos de prueba del motor de señales). Se reconstruyeron desde Recall, no se exportaron de
Firestore; el archivo explica su origen.

Las latencias se calcularon con los logs de Vercel y los tiempos que informa Recall: son dos
relojes distintos, así que son aproximadas. La cifra exacta sale de comparar `occurredAt` con
`receivedAt` en Firestore.

### Hallazgos que condicionan el diseño

1. **`language_code` no es fiable.** Todos los segmentos llegaron con `"en"` aunque el texto era
   español correcto. No se usa nunca para decidir nada; el idioma lo fija la configuración
   `deepgram_streaming` (`language: "es"`).
2. **`speech_on/off` indica el hablante activo, no el micrófono de cada persona.** Los eventos de
   dos personas se alternan al milisegundo y nunca se solapan, así que las interrupciones solo se
   ven en los tiempos de `transcript.data`. El tiempo de habla se calcula con intervalos
   consecutivos: el `speech_on` de otra persona cierra el intervalo anterior.
3. **El reconocimiento tiene errores.** Es aceptable para detectar respuestas numéricas, pero hay
   transcripciones erróneas de palabras sueltas; la lógica debe tolerar variantes de escritura.

## Qué no está hecho (honestidad)

- No hay CORS: el navegador no puede llamar todavía a `/api/start-session-bot`.
- No hay botón "Invitar tutor" en la interfaz; el bot se invita con una llamada directa.
- El anfitrión debe admitir al bot en Meet manualmente (limitación de Google Meet).
- El camino completo `start-session-bot` con un docente real no se probó en producción; la prueba
  real creó el bot directamente contra la API de Recall.
- El token del webhook va en la URL (`?token=`). Recall muestra esa URL en la configuración del
  bot, por lo que debe rotarse después de cada demo. Mejora futura: verificar la firma HMAC que
  Recall envía en las cabeceras.

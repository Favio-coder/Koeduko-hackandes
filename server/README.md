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
            └─ normaliza el evento y abre UNA transacción de Firestore (processLiveEvent):
                 lee   learningSessions/{id}/live/state   (estado incremental del motor)
                 aplica el evento y, como mucho cada 5 s de sesión, evalúa señales
                 escribe el estado y el liveEvent crudo (id determinista: idempotente)
            └─ responde 200 y, con waitUntil, afterLiveEventSaved:
                 si el motor decidió intervenir → Gemini redacta (o mensaje de respaldo)
                 → create() en learningSessions/{id}/agentInterventions (id determinista)
```

El motor decide **si** se interviene y a quién; Gemini solo **redacta**. Si Gemini falla, tarda más
de 6 s, no hay key o responde algo que rompe la política (más de 2 oraciones, la respuesta,
sin nombre, fuera de tema), se usa un mensaje determinista: la demo nunca queda muda.

| Carpeta | Contenido |
| --- | --- |
| `api/` | Bordes HTTP delgados (`recall-webhook.js`, `start-session-bot.js`). Solo aquí se lee `process.env`. |
| `src/sessions/core/` | Lógica pura y testeable: normalizar eventos, estado incremental (`liveState`), motor de señales (`signals`, `liveEngine`), política del tutor (`interventionPolicy`), números en español. |
| `src/sessions/adapters/` | Recall (`recall.js`), Gemini (`gemini.js`) y Firestore (`sessionStore.js`). |
| `src/sessions/tutor.js`, `afterLiveEventSaved.js` | Redacta la intervención (Gemini con respaldo) y la entrega. |
| `scripts/replayFixture.js` | Reproduce `fixtures/smoke-001.json` contra el webhook desplegado, sin Recall. |
| `src/sessions/http/` | Handlers con dependencias inyectadas, probados sin Vercel. |
| `src/firebaseAdmin.js` | Inicializa `firebase-admin` con `FIREBASE_SERVICE_ACCOUNT_B64`. |

## Variables de entorno (Production, tipo Secret)

`FIREBASE_SERVICE_ACCOUNT_B64` (JSON de la cuenta de servicio en base64), `RECALL_API_KEY`,
`RECALL_WEBHOOK_TOKEN`, `RECALL_WEBHOOK_URL` (`https://<dominio>/api/recall-webhook`) y
`RECALL_REGION` (`us-west-2`). Opcional: `RECALL_TRANSCRIPT_LANGUAGE` (por defecto `es`).
Nunca van en el repositorio, en el frontend ni en los logs.

Tutor (Gemini): `GEMINI_API_KEY` (Secret) y `GEMINI_MODEL` (variable normal). Sin ellas el tutor
responde con su mensaje de respaldo. `LOG_INTERVENTION_TEXT=1` es solo para depurar: registra el
texto de las intervenciones, que nombra a un niño; en producción debe estar sin definir.

## Pruebas

```bash
npm --prefix server ci
npm --prefix server test
```

## Presupuesto de Firestore (plan gratuito: 50 000 lecturas y 20 000 escrituras por día)

Llegan unos **2,5 eventos por segundo**, así que **nunca se lee la ventana de `liveEvents`**. El motor
trabaja sobre un documento de estado, `learningSessions/{id}/live/state`, que un reductor puro
actualiza evento a evento: intervalos de habla dentro de la ventana, las últimas 15 transcripciones,
presencia por participante, última intervención por tipo y desde cuándo rige el problema.

| Operación | Lecturas | Escrituras |
| --- | --- | --- |
| Evento normal | 1 (el estado) | 2 (el estado y el `liveEvent` crudo) |
| Evento que toca evaluar (como mucho cada 5 s de sesión) | 2 (+ la sesión, para traer el problema) | 2 |
| Evento repetido que no cambia nada | 1 | 1 (solo el `liveEvent`) |
| Intervención | 0 | 1 (`create()` con id determinista) |

**Medido en producción** con la sesión real reproducida (265 eventos): **284 lecturas y 530 escrituras**
(1,07 y 2,00 por evento), 0 reintentos de transacción y 19 evaluaciones de señales (7 % de los
eventos). Cada intervención suma 1 escritura. El tiempo de proceso en el servidor fue de **152 ms de
media** (p95 220 ms), por debajo de los ~400 ms entre eventos de una sesión real.

**El límite que manda son las escrituras:** a ~2,5 eventos/s son ~5 escrituras/s, es decir **unos 66
minutos de sesión en vivo por día** para toda la cuota, ensayos incluidos. Si no alcanza, la opción
más barata es no guardar `speech_on`/`speech_off` crudos en `liveEvents` (el 87 % de los eventos; el
estado ya conserva los intervalos): bajaría a ~1,1 escrituras por evento (~105 minutos por día).

## Prueba de punta a punta sin Recall

```bash
node scripts/replayFixture.js --session smoke-replay-001 --speed 4
```

Reproduce el fixture contra el webhook desplegado, con la demora de llegada realista de Recall (los
transcripts llegan ~1,5 s después, detrás de eventos de habla posteriores). Solo escribe en sesiones
`smoke-replay-*` y lee el token de un archivo (nunca lo imprime). Un test comprueba que los 265
eventos del fixture sobreviven al viaje de ida y vuelta por el normalizador.

Resultado en producción: los 265 eventos respondieron 200 y el motor intervino **una sola vez**,
`SILENT_PEER` para "Estudiante B" (quien entró y nunca habló), cuando hubo 45 s de conversación. La
velocidad efectiva fue x0,9 y no x4 porque la reproducción envía de forma secuencial y la red desde
el equipo que la lanza suma ~300 ms por petición; el servidor tardó 152 ms.

## Tutor: modelo de Gemini (verificado en vivo, 17-oct-2026)

El modelo se fija en `GEMINI_MODEL`: **`gemini-3.6-flash`**, el Flash más nuevo que responde de forma
fiable. Se probó con el prompt y la política reales, 3 intentos por modelo:

| Modelo | Resultado |
| --- | --- |
| `gemini-3.6-flash`, `gemini-3.5-flash` (pensamiento mínimo) | 3/3 mensajes válidos, ~1 a 1,7 s |
| `gemini-2.5-flash` (sin pensamiento) | 3/3 válidos, ~0,6 a 1 s (más rápido, pero de una generación anterior) |
| `gemini-3.5-flash-lite` | 0/3: respuestas sin pregunta |
| `gemini-3.7-flash`, `gemini-3.8-flash` | No aceptan `thinkingLevel: minimal` (HTTP 400); con su configuración por defecto devolvieron 503 y 429 |
| `gemini-2.5-flash-lite` | HTTP 404 con esta key |

Tres cosas que se aprendieron y están corregidas en el código:

1. **Los modelos con pensamiento gastan los tokens de salida pensando** y el texto sale cortado
   ("Estudiante B, ¿cómo"). Cada familia conocida lleva su configuración (`generationConfigFor`); un
   modelo desconocido recibe más margen de salida.
2. **Un nombre de ejemplo en el prompt se copia.** El modelo respondía "Luis, ¿" al pie de la letra.
3. **Hay que pedirle que mencione el problema**; sin eso escribía algo genérico y la política lo
   rechazaba como fuera de tema.

Los 503 y 429 aparecen con regularidad: por eso existe el mensaje de respaldo, que se entrega igual.

Primer mensaje real del tutor en la sesión reproducida (`SILENT_PEER`, creado en ~1,1 s, 149 ms de
servidor por evento y las mismas 284 lecturas y 530 escrituras que sin Gemini):

> Estudiante B, ¡nos gustaría escucharte a ti también! ¿Nos cuentas con tus palabras qué han
> entendido sobre el problema que están conversando?

## Límites conocidos del motor en vivo

- **`GROUP_SILENCE` no se puede detectar sin un reloj.** El silencio no genera eventos, y el motor
  solo corre cuando llega uno; hoy se detectaría recién cuando alguien vuelva a hablar. Hace falta un
  disparador periódico (la interfaz del docente o un cron) que llame a la evaluación con un `now`
  explícito; el motor ya lo admite.
- Las transcripciones del estado son las últimas 15: una respuesta dicha hace más de 15 frases no se
  evalúa.
- Un evento de habla que llegue más viejo que el inicio del hablante actual se ignora.
- El nombre del destinatario sale de la clave normalizada (sin tildes): "José" se dice "Jose".
- La asignación de participantes a estudiantes (`studentId`) sigue en `null`.
- `learningSessions/{id}/live/state` y `agentInterventions` aún no tienen regla de lectura en
  `firestore.rules`: la interfaz no puede leerlas todavía.

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

## Motor de señales: desviaciones aprobadas de la skill `session-signals`

El motor (`src/sessions/core/signals.js`) sigue la skill salvo en cuatro puntos, aprobados tras la
prueba real:

1. **`minPresenceSec` (30 s).** Quien acaba de entrar a la sala no se acusa de callado: para
   `SILENT_PEER` debe llevar al menos 30 s presente. La skill no lo exigía.
2. **`GROUP_SILENCE` no activa `STUCK`.** El silencio solo significa que dejaron de hablar, nunca
   que "no saben". `STUCK` sale únicamente de marcadores de confusión en lo que dijeron.
3. **`startedAtT` opcional en el problema.** Lo dicho antes de que empiece el problema actual no
   cuenta como respuesta.
4. **"no se puede" no es confusión.** "no se" solo cuenta como marcador cuando es "no sé" (al final
   de la frase o seguido de "cómo", "qué", "si"…); "no se puede" o "no se mueve" no cuentan.

Además, las respuestas se leen frase por frase: el verbo de respuesta ("son", "es", "da") debe ir
pegado al número, y una pregunta ("¿cuánto son seis por ocho?") no cuenta como respuesta.

## Qué no está hecho (honestidad)

- No hay CORS: el navegador no puede llamar todavía a `/api/start-session-bot`.
- No hay botón "Invitar tutor" en la interfaz; el bot se invita con una llamada directa.
- El anfitrión debe admitir al bot en Meet manualmente (limitación de Google Meet).
- El camino completo `start-session-bot` con un docente real no se probó en producción; la prueba
  real creó el bot directamente contra la API de Recall.
- El token del webhook va en la URL (`?token=`). Recall muestra esa URL en la configuración del
  bot, por lo que debe rotarse después de cada demo. Mejora futura: verificar la firma HMAC que
  Recall envía en las cabeceras.

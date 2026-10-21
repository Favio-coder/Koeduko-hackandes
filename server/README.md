# server/ — backend de sesiones en vivo (Vercel)

Funciones serverless que conectan el bot de Recall.ai dentro de Google Meet con Firestore.
Es un proyecto Vercel **independiente** (`ko_eduko`): todo lo que se despliega vive dentro de `server/`
y el código de sesiones no importa nada de fuera de esta carpeta.

> `server/` también contiene `assessments/` y `firebaseAdmin.js`: es la lógica privada del módulo de evaluaciones,
> que usa el `api/` del proyecto del frontend (raíz del repositorio) y **no forma parte de este backend**. Conviven en
> la carpeta sin importarse; todo lo demás de este README es del backend de sesiones.

## Decisión: servidor en Vercel y no en Firebase Functions

El proyecto Firebase `koeduko-app` **no puede usar el plan Blaze**, y Cloud Functions (y sus
secretos) lo exigen para desplegar. Por eso:

- **Firestore y Auth siguen en Firebase** (plan gratuito).
- **El servidor del módulo de sesiones corre en Vercel**, con variables de entorno de Vercel
  como secretos y `firebase-admin` con una cuenta de servicio para escribir en Firestore.
- **El tutor (Gemini) también vive aquí**: `ask-tutor` reutiliza el mismo adaptador y la misma política que las
  intervenciones en vivo. `functions/` ya no existe.

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
                 escribe el estado y, salvo speech_on/off, el liveEvent crudo (id determinista)
            └─ responde 200 y, con waitUntil, afterLiveEventSaved:
                 si el motor decidió intervenir → Gemini redacta (o mensaje de respaldo)
                 → create() en learningSessions/{id}/agentInterventions (id determinista)
```

El motor decide **si** se interviene y a quién; Gemini solo **redacta**. Si Gemini falla, tarda más
de 6 s, no hay key o responde algo que rompe la política (más de 2 oraciones, la respuesta,
sin nombre, fuera de tema), se usa un mensaje determinista: la demo nunca queda muda.

| Carpeta | Contenido |
| --- | --- |
| `api/` | Bordes HTTP delgados: `recall-webhook.js`, `start-session-bot.js`, `ask-tutor.js`, `close-session.js`. Solo aquí (y en `src/*Edge.js`) se lee `process.env`. |
| `src/http/` | Handlers con dependencias inyectadas (CORS, errores, auth), probados sin Vercel. |
| `src/sessions/core/` | Lógica pura y testeable: normalizar eventos, estado incremental (`liveState`), motor de señales (`signals`, `liveEngine`), política del tutor (`interventionPolicy`), evidencia por competencias (`competencyEvidence`), números en español. |
| `src/sessions/adapters/` | Recall (`recall.js`), Gemini (`gemini.js`), AtomicMemory (`atomicMemory.js`) con su respaldo en Firestore (`firestoreMemory.js`, `memory.js`) y Firestore (`sessionStore.js`). |
| `src/sessions/*.js` | Casos de uso: `tutor.js`, `afterLiveEventSaved.js` (intervenir y entregar), `closeSession.js`, `startSessionBot.js`; y las fábricas que leen el entorno (`geminiEdge.js`, `memoryEdge.js`). |
| `src/envManifest.js` | Manifiesto de variables de entorno: de aquí salen los `.env.example` y `npm run check:env`. |
| `src/firebaseAdmin.js`, `src/adminCredentials.js` | `firebase-admin` con `FIREBASE_SERVICE_ACCOUNT_B64` (endpoints) y el orden de credenciales de los scripts. |
| `fixtures/` | `smoke-001.json`: la reunión real anonimizada. |
| `scripts/` | `replayFixture.js` (reproduce un fixture contra el webhook desplegado), `createAcceptanceSession.js`, `protectAnswer.js`, `checkEnv.js`, `writeEnvExample.js`. |
| `.env.example` | Variables del backend, sin valores (generado desde el manifiesto). |

## Variables de entorno

La lista completa —para qué sirve cada una, dónde se obtiene, si es secreta y si es obligatoria— está en
**`src/envManifest.js`** (la fuente única) y, sin valores, en **`.env.example`**. Un test falla si el código lee una
variable que el manifiesto no declara. Para ver qué falta, solo por nombre:

```bash
npm run check:env                          # desde la raíz: entorno del proceso, servidor y frontend
node scripts/checkEnv.js --vercel production   # desde server/: contra las variables del proyecto en Vercel
```

Las secretas (`FIREBASE_SERVICE_ACCOUNT_B64`, `RECALL_API_KEY`, `RECALL_WEBHOOK_TOKEN`, `GEMINI_API_KEY`,
`ATOMICMEMORY_API_KEY`) van como *Secret* en Vercel y nunca en el repositorio, en el frontend ni en los logs.
`LOG_INTERVENTION_TEXT=1` es solo para depurar: registra el texto de las intervenciones, que nombra a un niño; en
producción debe estar sin definir. Sin `GEMINI_API_KEY` o `GEMINI_MODEL` el tutor responde con su mensaje de respaldo;
`MEMORY_ENABLED=false` y `MEET_CHAT_ENABLED=false` apagan la memoria y el chat. **Un cambio de variable solo se aplica
en un despliegue nuevo.**

## Despliegue

**`ko_eduko` no está conectado a Git**: un `push` no lo despliega. Se despliega solo por CLI, desde esta carpeta:

```bash
cd server
node scripts/checkEnv.js --vercel production   # ninguna obligatoria debe faltar
npx vercel --prod                              # publica el directorio de trabajo (incluidos cambios sin commit)
vercel ls --prod                               # esperar a que el último esté en estado Ready
```

Después de desplegar: comprobar CORS con `OPTIONS` (204 desde cada origen permitido, 403 desde uno ajeno) y, si hubo
cambios de reglas de Firestore, `firebase deploy --only firestore:rules --project koeduko-app`. Las variables viven
en el proyecto de Vercel `ko_eduko` (equipo «alex's projects»); el proyecto del frontend es otro y está en otro equipo.

## La respuesta esperada es privada

`learningSessions/{id}` lo leen los estudiantes de la sesión, así que **no lleva la respuesta**:
`currentProblem` tiene solo `activityId`, `skillId` y `text`. La respuesta vive en
`learningSessions/{id}/private/answer` (`{ activityId, expectedAnswer }`), que ningún cliente lee ni escribe
(`read, write: false`); solo el Admin SDK, que no pasa por las reglas.

- El motor la lee **una sola vez por problema** y la cachea en `live/state.answer`; no se relee.
- `live/state` tampoco es legible desde el navegador (regla `read, write: false`): solo `live/view` lo es, y
  esa vista no incluye la respuesta. El cliente nunca ve `live/state`.
- Las sesiones sin migrar (con la respuesta dentro de `currentProblem`) siguen funcionando.
  `node scripts/protectAnswer.js --session <id>` mueve la respuesta a `private/answer` y la borra de `currentProblem`
  (idempotente). `scripts/createAcceptanceSession.js` ya crea las sesiones nuevas así.
- Costo: +1 lectura por problema (la primera evaluación). Las demás evaluaciones siguen en 2 lecturas.

## Cierre de la sesión: evidencia por competencias y memoria

`POST /api/close-session` (solo docente, CORS como los demás endpoints) hace, en este orden:

1. saca al bot de la reunión (`leave_call`, 4 s);
2. lee lo que pasó (`live/state` y las transcripciones guardadas) y arma el reporte de competencias;
3. si hay frases que las reglas no clasifican, le pide a Gemini que las etiquete (6 s, salida JSON validada);
4. recuerda a cada estudiante (un texto corto y factual; AtomicMemory, con respaldo en Firestore);
5. guarda `learningSessions/{id}/summary/final` y marca la sesión `completed`, en un solo lote.

**Ningún servicio externo puede romper el cierre.** Cada paso externo tiene su límite de tiempo y su
respaldo; `summary/final.steps` registra qué pasó (`leaveCall`, `classifier`, `memory`) y la pantalla avisa
al docente de lo que falló (por ejemplo, que el tutor sigue en la reunión). Solo un fallo de Firestore
detiene el cierre. Es idempotente: cerrar dos veces devuelve el mismo reporte sin repetir nada.

**El reporte es evidencia formativa, nunca una nota.** Por estudiante y por capacidad (Currículo Nacional,
«Resuelve problemas de cantidad») da un estado (`con evidencia`, `evidencia parcial`, `sin evidencia suficiente`)
y hasta dos citas textuales con su segundo. No existe AD/A/B/C en el código ni en la pantalla.

| Capacidad | Qué mira (por reglas) |
|---|---|
| Traduce cantidades a expresiones numéricas | frases que nombran una operación con números («seis por ocho»); confusión al plantear el problema (parcial, con una nota) |
| Comunica su comprensión | % de habla de toda la sesión y turnos (`live/state.totals`) |
| Usa estrategias y procedimientos | respuestas correctas / equivocadas del estudiante (las mismas reglas que el tutor en vivo) |
| Argumenta afirmaciones | frases que justifican («porque…», «ya que…»), después de una respuesta, con números u operaciones |

Gemini solo **clasifica** frases dudosas (largas, sin pregunta y sin regla que las atrape; como mucho 6 por
estudiante y 20 en total). Su etiqueta nunca basta para «con evidencia»: solo sube de «sin evidencia» a
«evidencia parcial». Si falla, tarda o responde algo que no es JSON válido, el reporte se queda con las reglas.

**Costo en Firestore del cierre** (una sola vez por sesión): lecturas = 1 sesión + 1 `live/state` + 1 por
transcripción guardada (una sesión real de ~100 s tuvo 29) + 0–1 `private/answer`; escrituras = 2
(`summary/final` y el estado de la sesión, en un lote). Si además hay memoria en el respaldo de Firestore:
+1 escritura por estudiante. Una sesión ya cerrada cuesta 2 lecturas y ninguna escritura.

### Memoria por estudiante

`remember(studentKey, text)` / `recall(studentKey, query)` con la misma interfaz en AtomicMemory y en el
respaldo (`students/{key}/memory`, solo Admin SDK). `recall` **nunca rompe nada**: si falla o tarda más de 2 s
devuelve `[]` y el tutor habla como siempre; `remember` informa el fallo y cae al respaldo.

- **Clave del estudiante** (`core/studentKey.js`): el uid de Firebase Auth si el participante está enlazado a
  un estudiante; si no, `<classroomId o uid del docente>:<sha256(scope + nombre normalizado)[0..16]>`. Nunca el
  correo ni el nombre. Es **seudónimo, no anónimo**: los nombres son fáciles de adivinar, por eso el scope va
  dentro del hash (el mismo nombre en dos aulas da claves distintas).
- **Qué se guarda**: una oración como «Sesión accept-001, multiplicación: comunicó 28% del tiempo; usó estrategia
  correcta; sin evidencia de argumentación.». Sin transcripciones, sin citas, sin nombre, sin la respuesta.
- **Cuándo se recuerda**: antes de redactar una intervención se hace `recall` del destinatario y las notas
  entran al prompt (`memoryNotes`, como dato entre «», nunca como instrucciones). Costo: 1 llamada externa por
  intervención y la lectura de la sesión (que el chat de Meet reutiliza: no se lee dos veces).
  No se recuerda «al invitar al tutor»: en ese momento los participantes aún no están enlazados a un uid, así que
  no hay con qué buscar. Con la clave por nombre, recordar al hablarle a cada estudiante cubre ambos casos.
- **AtomicMemory por HTTP directo, sin `@atomicmemory/sdk`.** El SDK 1.1.1 arrastra `@huggingface/transformers`
  → `onnxruntime-node` + `sharp` (binarios nativos): ~277 MB en `node_modules` (el límite de una función de
  Vercel es 250 MB descomprimida), ~1000 líneas de lockfile y 3 vulnerabilidades altas, para llamar a dos
  endpoints. Además su quickstart no funciona tal cual (omite `initialize()`, `ingest` exige `mode` y este
  despliegue exige `contentClass`). Contrato verificado contra `api.atomicstrata.ai/v1` con `Authorization: Bearer`:
  `POST /memories/ingest/quick` (`content_class: "summary"`, 201 en ~0,9 s) y `POST /memories/search/fast`
  (`{ count, memories: [{ id, content, score, similarity, … }] }`, ~1,0–1,6 s). El despliegue **rechaza contenido
  crudo** (HTTP 502 sin `content_class`): coincide con la regla de no mandar transcripciones.

### Revisar y olvidar una nota (docente)

Al cerrar, `summary/final.memoryNotes` guarda, por participante, la nota que se intentó guardar y su estado
(`saved`, `failed`, `skipped`, `forgotten`), el proveedor (`via`) y si se puede olvidar. La pantalla del reporte la
muestra en «Lo que recordará el tutor». La clave del estudiante y el id de la nota en el proveedor **no** van ahí:
quedan en `learningSessions/{id}/private/memory`, que ningún cliente lee.

- **Solo con recibo**: AtomicMemory cuenta una nota como guardada si `ingest/quick` devuelve un id en
  `stored_memory_ids`/`updated_memory_ids` (o `memories_skipped > 0`); un 2xx sin eso es `unconfirmed`. Las
  peticiones usan `redirect: 'error'` (la API key nunca sigue una redirección).
- `POST /api/forget-memory-note { sessionId, key }` (solo el docente que creó la sala): el servidor busca la
  referencia en `private/memory` y borra **solo** esa nota, en el proveedor donde quedó (`DELETE
  /v1/memories/{id}?user_id=<clave>` o el documento de `students/{key}/memory`). El navegador nunca manda una clave
  de estudiante ni un id. Un `{ success: true }` o un 404 cuentan como olvidada; un 2xx sin `success: true`, un fallo
  o más de 5 s responden 503 «la nota sigue guardada» y no se marca nada. Después se quita la referencia y la nota pasa
  a `forgotten` en `summary/final` (una transacción). `MEMORY_ENABLED=false` no impide olvidar lo ya guardado.
- Si AtomicMemory no confirmó y la nota quedó en el respaldo (`forgetUnavailable: 'primary-unconfirmed'`), no se
  guarda referencia ni se ofrece olvidarla: podría haber otra copia en AtomicMemory y no se puede borrar con certeza.
- Costo: 1 sesión + 1 `summary/final` + 1 `private/memory` + la transacción (2 lecturas, 2 escrituras); con el
  respaldo, +1 borrado.
- El `DELETE` de AtomicMemory sigue el OpenAPI oficial; no se ha probado contra el servicio en vivo.

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
| Evento de habla (`speech_on`/`speech_off`, el 87 % del tráfico) | 1 (el estado) | **1** (solo el estado; no se guarda crudo) |
| Transcript, `join` o `leave` | 1 | 2 (el estado y el `liveEvent` crudo) |
| Evento que toca evaluar (como mucho cada 5 s de sesión) | 2 (+ la sesión, para traer el problema) | igual que arriba |
| Evento repetido que no cambia nada | 1 | 0 o 1 |
| Intervención | 0 | 1 (`create()` con id determinista) |

Decisión (producto): `speech_on`/`speech_off` **ya no se guardan crudos** en `liveEvents`. El estado
conserva los intervalos de habla de la ventana, que es lo único que necesita el motor. Se pierde el
registro crudo del habla; `fixtures/smoke-001.json` conserva el de la prueba real.

**Medido en producción** con la sesión real reproducida (265 eventos, 0 reintentos de transacción):

| | Antes (todo crudo) | Ahora |
| --- | --- | --- |
| Lecturas | 284 | **284** (1,07 por evento) |
| Escrituras | 530 (2,00 por evento) | **300** (1,13 por evento) + 1 por intervención |
| Evaluaciones de señales | 19 | 19 (7 % de los eventos) |
| Tiempo en el servidor por evento | 149 ms de media | **115 ms** de media (p95 162 ms) |

**Cuánto permite la cuota.** Esa sesión dura 106,7 s, así que consume ~2,8 escrituras y ~2,7 lecturas
por segundo de sesión:

- Escrituras: 20 000 / 2,8 por s = ~7 100 s = **unos 118 minutos de sesión en vivo por día** (antes ~66).
- Lecturas: 50 000 / 2,7 por s = ~18 800 s = ~313 minutos por día.

**Pantalla en vivo (`live/view`).** La interfaz no lee `live/state` (su ventana de eventos pesa ~12 veces más
por cada actualización que escucha). Cada vez que el motor evalúa, el servidor escribe además un documento
chico, `learningSessions/{id}/live/view` (reparto de la palabra por participante y las últimas 20 frases).
Eso suma ~1 escritura por evaluación: **~111 minutos al día** (estimado, no medido; el valor medido sigue
siendo el de arriba). Las intervenciones guardadas ya no incluyen la respuesta esperada (`expectedAnswer`):
la pantalla es legible por estudiantes.

**Chat de Meet.** Cada intervención *nueva* suma 1 lectura (la sesión, para el id del bot) y, si Recall
responde 2xx, 1 escritura (`deliveredTo: ['app', 'meet_chat']`). Una intervención repetida no suma nada.
Con ~1 intervención cada 60 s como máximo, son < 1 lectura y < 1 escritura por minuto: no mueve el límite.
Se apaga con `MEET_CHAT_ENABLED=false` (cambiar la variable y redesplegar el mismo código; Vercel aplica las
variables solo a despliegues nuevos). El mensaje se envía a Recall (`POST /bot/{id}/send_chat_message/`,
body `{ message, to: "everyone" }`, 4 s de límite); si falla, la intervención queda solo en la app y se
registra el estado HTTP, nunca el texto.

Las **escrituras siguen siendo el límite**: ~118 minutos al día para toda la cuota, y los ensayos con
el reproductor (300 escrituras cada uno) también la consumen. Las reglas de seguridad que usan
`get()` (ver `firestore.rules`) suman lecturas por cada consulta de la interfaz.

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

- **`GROUP_SILENCE` está DESACTIVADO por configuración y queda fuera de la demo.** El silencio no genera
  eventos y el motor solo corre cuando llega uno, así que se detectaría recién cuando alguien vuelva a
  hablar, que es justo cuando ya no sirve. Necesita un disparador periódico (la interfaz del docente o
  un cron) que llame a la evaluación con un `now` explícito; el motor ya lo admite. Está en
  `DEFAULT_CONFIG.disabledSignals`; para encenderlo, `disabledSignals: []`. Cualquier otra señal se
  apaga igual, sin tocar el código.
- Las transcripciones del estado son las últimas 20: una respuesta dicha hace más de 20 frases no se
  evalúa.
- Un evento de habla que llegue más viejo que el inicio del hablante actual se ignora.
- El nombre del destinatario sale de la clave normalizada (sin tildes): "José" se dice "Jose".
- La asignación de participantes a estudiantes (`studentId`) sigue en `null`.
- Las reglas de lectura por sesión (`canReadSessionData`: docente o estudiante de la sesión) están en
  `firestore.rules` pero **no se han probado con el emulador ni desplegado**: hasta
  `firebase deploy --only firestore:rules`, la pantalla muestra «No tienes permiso para ver esta sesión.».

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

- El anfitrión debe admitir al bot en Meet manualmente (limitación de Google Meet).
- Qué está probado y qué no, con sus datos: `docs/TESTING.md`. En corto: `start-session-bot` desde la app con un
  docente real **sí** se probó (el bot se creó y entró a la reunión), pero **nunca** una conversación de matemática
  entre dos estudiantes de punta a punta, ni un mensaje del tutor visto en el chat de Meet, ni el reporte de una
  conversación real, ni la memoria entre dos sesiones. El cierre en sí (`close-session`) sí se probó de punta a punta
  con una sesión real sin conversación (ver `docs/TESTING.md`).
- El token del webhook va en la URL (`?token=`). Recall muestra esa URL en la configuración del
  bot, por lo que debe rotarse después de cada demo. Mejora futura: verificar la firma HMAC que
  Recall envía en las cabeceras.

El borrado corresponde al registro confirmado de esa sesión, no a todos los hechos semejantes de otras clases. Si el proveedor principal falló antes de guardar en el respaldo, el reporte muestra que no se puede confirmar el borrado completo y no ofrece eliminar sólo la copia de respaldo. Ese caso requiere revisar el estado del proveedor principal.

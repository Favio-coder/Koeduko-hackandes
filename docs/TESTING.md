# Pruebas del módulo de sesiones: qué se probó, con qué datos, y qué no

Este documento separa **lo que se verificó de verdad** de lo que solo tiene tests unitarios o no se probó. Si algo
no está en la columna «Probado», no debe afirmarse en la demo.

## 1. Tests automáticos

```bash
npm --prefix server test     # backend de sesiones: 708 tests en 46 archivos, todos en verde
npm test                     # raíz: 336 tests; 329 en verde y 7 fallan (ver abajo)
npm run lint && npm run build
```

Los tests del servidor son de **lógica pura con dobles** (Firestore, Recall, Gemini y AtomicMemory simulados): no
tocan servicios reales. Incluyen una prueba con el fixture real `smoke-001`, un test que falla si el código usa una
variable de entorno que no está en `server/src/envManifest.js`, y los contratos de las respuestas observadas de
Recall y AtomicMemory.

**Los 7 fallos de la raíz ya existen en `main`** (se comprobaron en un árbol limpio de `main`) y son de otros módulos:
tests de matching y de dashboard que esperan 5 estudiantes de demostración cuando los datos tienen 8, y una suite que
no carga sin las llaves de Firebase. No son de este módulo y no se tocaron. Con la máquina muy cargada (navegador,
servidor de desarrollo) algunas suites de otros módulos fallan además por tiempo (límite de 5 s por test); los tests
de este módulo pasaron estables en cada repetición.

## 2. Pruebas con datos reales

| Qué | Cómo | Con qué datos | Resultado |
| --- | --- | --- | --- |
| **Reunión real de Google Meet** (17-oct-2026) | Bot de Recall en una reunión con 3 personas, ~110 s, español | `server/fixtures/smoke-001.json`: 265 eventos (3 `join`, 115 `speech_on`, 115 `speech_off`, 29 `transcript`, 3 `leave`), participantes anonimizados | Llegaron todos los tipos de evento. El motor intervino **una sola vez**: `SILENT_PEER` para quien nunca habló. **La conversación no era de matemática** (hablaban del bot). |
| **Reproducción contra el webhook desplegado** (`scripts/replayFixture.js`) | Replays de `smoke-001` en sesiones `smoke-replay-*` | El mismo fixture | 265 de 265 respuestas 200. Costo medido por sesión de ~107 s: **284 lecturas y 300 escrituras**, 115 ms por evento en el servidor. |
| **Gemini en vivo** | Llamadas reales con distintos modelos | Prompts de las señales | `gemini-3.6-flash` con pensamiento mínimo funciona; 3.7 y 3.8 no (HTTP 400). Se midieron cortes de texto, un nombre filtrado del ejemplo y respuestas genéricas, y se corrigieron. A veces responde más de 2 oraciones: entonces sale el mensaje de respaldo. |
| **AtomicMemory en vivo** | `ingest` y `search` reales por HTTP | Registros de sondeo `kdk-probe-*` (sin datos de niños) | `ingest/quick` 201 en ~0,9 s, `search/fast` 200 en 1,0–1,6 s; sin `content_class` el servicio responde 502. |
| **Reglas de Firestore desplegadas** | Lecturas de cliente con un token de docente (REST) | Sesión `accept-001` y `accept-mem-*` | `private/answer` y `live/state`: 403. `live/view` y la sesión: 200. `summary/final`: 404 (permitido, aún vacío). |
| **CORS del backend** | `OPTIONS` desde cada origen | – | 204 para el frontend de producción, el alias de la preview, `edukolea.com`, `www.edukolea.com` y `localhost:5173`; 403 para un origen ajeno, para uno que solo se le parece (`edukolea.com.evil.example`) y para la variante `http://`; el `Allow-Origin` devuelto es exacto, sin comodín; 401 sin token. No se pudo verificar de quién es `edukolea.com` (está en Vercel y el apex redirige a `www`): se agregó por pedido del equipo. |
| **Pantalla de la sesión** | Navegador real, docente logueado, sesión real | `accept-001`, `accept-mem-1` | Muestra problema, enlace de Meet, «Invitar tutor» y «Cerrar sesión»; el error de permisos se muestra bien. |
| **Invitar al tutor desde la app** | Clic real en «Invitar tutor» | `accept-mem-1` | El bot se creó y entró a la reunión (admitido por el anfitrión tras ~5 min de espera). |
| **Cerrar una sesión de punta a punta** (18-oct-2026) | Clic real en «Cerrar sesión» contra `POST /api/close-session` en producción, con docente | `accept-mem-1`: la única sesión con eventos reales, pero **sin conversación** (entró una sola persona, 2,8 s de habla) | Respondió en 6 s y el reporte se mostró y quedó guardado en `summary/final` (el docente lo lee; la sesión pasó a `completed`). `steps`: `leaveCall` falló con 400 (el bot ya se había ido: el fallo quedó registrado y avisado, y el cierre siguió), `memory.saved` = 1, `classifier` omitido (no había frases dudosas). **No prueba la calidad del reporte**, solo que el flujo funciona. |
| **«Sesión activa» y «Tutor IA» del menú** | Navegador real, docente logueado | Sesiones reales de Firestore | `/sessions/active` resuelve a una sesión real (`accept-mem-3`) y el ítem queda resaltado; `/sessions/active/tutor` lleva a su tutor. Ya no apuntan a una sesión de demostración. |
| **Conversación real de matemática, un solo participante** (18-oct-2026) | Bot de Recall en Meet, una persona hablando el problema de las cajas y lápices; sesión `accept-live-1` | `server/fixtures/smoke-002.json`: 24 eventos, anonimizado | 3 intervenciones, las 3 con `chat sent:200` en Recall. **Que el texto apareciera en el chat de Meet lo confirma solo la persona que lo vio, no el servidor.** `WRONG_ANSWER` no se ejercitó. Con un solo participante el tutor dice «Chicos» y «compañero». |
| **Cierre con esa conversación** | «Cerrar sesión» en `accept-live-1` | La sesión anterior | 7 s; reporte guardado en `summary/final` y una nota de memoria guardada. El clasificador de frases dudosas falló con `failed:http` y no se registró el código; ahora se registra como `failed:http:NNN` y falta verlo en el próximo cierre. |
| **Replay de `smoke-002` en otra sesión** (`accept-live-2`, `accept-live-3`) | `scripts/replayFixture.js` contra producción | `smoke-002` | El motor es determinista: las mismas señales que en vivo. En `accept-live-2` la memoria devolvió **0 notas** (la búsqueda es semántica y la consulta usaba el enunciado). Se cambió la consulta a `memoryQueryOf` y en `accept-live-3` `CORRECT_ANSWER` trajo **2 notas** (`memoryCache: miss`). `STUCK` nunca usa memoria: no tiene destinatario. Dos eventos no llegaron por fallos de red del equipo de pruebas. |
| **Voz en la reunión** (experimental, `MEET_VOICE_ENABLED`) | Bot nuevo creado con salida de audio en un Meet real, luego el primer `WRONG_ANSWER` en vivo (`accept-live-6`) | Una persona hablando el problema de las cajas | **Servidor verificado:** `voice: sent 200` (ElevenLabs sintetizó y Recall aceptó el audio), chat en paralelo `sent 200`, 2,9 s en el servidor. El primer intento falló con `tts-failed 400` y el código `api_key_id_used_as_api_key`: se había cargado el ID de la llave y no la secreta. **No verificado:** que se oyera en la reunión (lo confirma solo quien estaba en ella) y que la documentación de Recall dice que `output_audio` no es para TTS dinámico. |
| **Número cortado por la transcripción** | Conversación real, `accept-live-6` | «cuarenta y» + «dos» en dos fragmentos | El motor leyó «40» en vez de 42. Corregido: espera la continuación (5 s) y une los fragmentos (`signals.test.js`). |
| **Sesión de compañeros sin problema** (`confirmed-…-g1`, dos personas, ~12 min) | Revisión de Firestore tras su prueba | Su sesión real | El tutor no habló: `currentProblem: null`, el motor por reglas no tenía nada que evaluar. Motivó el observador de la conversación. |
| **Observador de la conversación** (`core/conversationJudge.js`) | Replay sintético de dos estudiantes hablando de ciencias en `accept-live-9`, en producción | `science-two.json` (**sintético**, no es una conversación real) | Habló una vez (`Leyó la conversación`, `fuera-de-tema`), reencauzando al problema de la sesión. No se probó con una conversación real de otro tema ni se midió cuánto molesta al callar/hablar. |
| **Cierre automático** (se va la última persona) | Replay de `smoke-002` en `accept-live-4`, en producción | `smoke-002` | La sesión se cerró sola en 3 s: reporte generado, 1 memoria guardada, sin intentar sacar al bot. No se probó con una reunión real donde alguien salga y vuelva a entrar. |
| **Problema asignado desde la habilidad en foco** (`core/problemBank.js`, `sessionStore.ensureProblem`) | Solo tests automáticos (banco por habilidad y transacción con doble de Firestore) | – | **No probado en vivo con una sala del emparejamiento.** Falta ver una sala real sin problema pasar por «Entrar». |
| **«Entrar» invita al tutor** | Solo tests de la pantalla y del endpoint (docente y alumno de la sala; alumno ajeno recibe 403) | – | No probado con un alumno real en el navegador. |
| **Aprendizaje por resultado** (`core/learning.js`, `core/interventionOutcome.js`) | Replay de `smoke-002` en `accept-live-7` y cierre desde la app, en producción | `smoke-002` | Se eligió y registró un estilo por intervención; el cierre midió los resultados (`steps.learning`: 1 mejoró, 2 desconocidas por ser señales de grupo) y guardó 1 perfil. **No prueba que aprenda bien:** con una sesión los conteos son ruido; falta ver varias sesiones del mismo estudiante. |

## 3. Lo que NO se probó

| Qué falta | Por qué importa |
| --- | --- |
| **Una conversación de matemática real entre dos o más estudiantes en Meet** | `smoke-002` tiene un solo participante: `SILENT_PEER` y `DOMINANCE` (necesitan ≥ 2) siguen sin ejercitarse con datos reales. |
| **Que el mensaje del tutor llegue al chat de Meet** (`deliveredTo: meet_chat`) | Recall respondió 200 en las 3 intervenciones de `accept-live-1`, pero el servidor no ve el chat: depende de lo que vio la persona en la reunión. |
| **El reporte de competencias con una conversación real** | El cierre funciona (sección 2), pero nunca se generó el reporte de una conversación de matemática: no se sabe qué estados salen ni si las citas tienen sentido. |
| **Que la memoria cambie lo que dice el tutor** | El ciclo guardar → recordar funciona (2 notas llegaron al prompt de `CORRECT_ANSWER`), pero no se midió una diferencia atribuible a la memoria: entre la sesión 1 y el replay cambió también la regla de no felicitar y Gemini varía entre llamadas. |
| **`WRONG_ANSWER` con una conversación real** | No se dio una respuesta equivocada en vivo. `SILENT_PEER` solo se vio en una conversación que no era de matemática. |
| **La calidad pedagógica de lo que dice el tutor, con niños** | No se evaluó con ningún niño ni docente. |
| **Las reglas de Firestore con el emulador** | No hay Java en la máquina de desarrollo: se verificaron contra el servicio desplegado con un solo rol (docente), no con un estudiante ajeno a la sesión. |
| **La pantalla como estudiante** | No se probó con una cuenta de estudiante. |
| **El frontend desplegado (preview) con login** | Ver `DEMO.md` y el reporte de integración: la preview está protegida por SSO del equipo de Favio. |
| **Carga y el tope diario de Firestore** | El límite de ~111 minutos de sesión al día es una **estimación** (el valor medido es ~118 min sin la vista de pantalla). |
| **Seguridad de las reglas ante un estudiante malicioso** | Las reglas están escritas para impedirlo, pero no se atacaron. |

## 4. Cómo repetir lo que sí se puede repetir

```bash
# reproducir la sesión real anonimizada contra el webhook desplegado (necesita el token del webhook)
node server/scripts/replayFixture.js --session smoke-replay-001 --speed 4

# qué variables faltan, solo por nombre
npm run check:env
node server/scripts/checkEnv.js --vercel production     # desde server/, contra Vercel
```

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
no carga sin las llaves de Firebase. No son de este módulo y no se tocaron.

## 2. Pruebas con datos reales

| Qué | Cómo | Con qué datos | Resultado |
| --- | --- | --- | --- |
| **Reunión real de Google Meet** (17-oct-2026) | Bot de Recall en una reunión con 3 personas, ~110 s, español | `server/fixtures/smoke-001.json`: 265 eventos (3 `join`, 115 `speech_on`, 115 `speech_off`, 29 `transcript`, 3 `leave`), participantes anonimizados | Llegaron todos los tipos de evento. El motor intervino **una sola vez**: `SILENT_PEER` para quien nunca habló. **La conversación no era de matemática** (hablaban del bot). |
| **Reproducción contra el webhook desplegado** (`scripts/replayFixture.js`) | Replays de `smoke-001` en sesiones `smoke-replay-*` | El mismo fixture | 265 de 265 respuestas 200. Costo medido por sesión de ~107 s: **284 lecturas y 300 escrituras**, 115 ms por evento en el servidor. |
| **Gemini en vivo** | Llamadas reales con distintos modelos | Prompts de las señales | `gemini-3.6-flash` con pensamiento mínimo funciona; 3.7 y 3.8 no (HTTP 400). Se midieron cortes de texto, un nombre filtrado del ejemplo y respuestas genéricas, y se corrigieron. A veces responde más de 2 oraciones: entonces sale el mensaje de respaldo. |
| **AtomicMemory en vivo** | `ingest` y `search` reales por HTTP | Registros de sondeo `kdk-probe-*` (sin datos de niños) | `ingest/quick` 201 en ~0,9 s, `search/fast` 200 en 1,0–1,6 s; sin `content_class` el servicio responde 502. |
| **Reglas de Firestore desplegadas** | Lecturas de cliente con un token de docente (REST) | Sesión `accept-001` y `accept-mem-*` | `private/answer` y `live/state`: 403. `live/view` y la sesión: 200. `summary/final`: 404 (permitido, aún vacío). |
| **CORS del backend** | `OPTIONS` desde cada origen | – | 204 para el frontend de producción, el alias de la preview y `localhost:5173`; 403 para un origen ajeno; 401 sin token. |
| **Pantalla de la sesión** | Navegador real, docente logueado, sesión real | `accept-001`, `accept-mem-1` | Muestra problema, enlace de Meet, «Invitar tutor» y «Cerrar sesión»; el error de permisos se muestra bien. |
| **Invitar al tutor desde la app** | Clic real en «Invitar tutor» | `accept-mem-1` | El bot se creó y entró a la reunión (admitido por el anfitrión tras ~5 min de espera). |
| **Cerrar una sesión de punta a punta** (18-oct-2026) | Clic real en «Cerrar sesión» contra `POST /api/close-session` en producción, con docente | `accept-mem-1`: la única sesión con eventos reales, pero **sin conversación** (entró una sola persona, 2,8 s de habla) | Respondió en 6 s y el reporte se mostró y quedó guardado en `summary/final` (el docente lo lee; la sesión pasó a `completed`). `steps`: `leaveCall` falló con 400 (el bot ya se había ido: el fallo quedó registrado y avisado, y el cierre siguió), `memory.saved` = 1, `classifier` omitido (no había frases dudosas). **No prueba la calidad del reporte**, solo que el flujo funciona. |
| **«Sesión activa» y «Tutor IA» del menú** | Navegador real, docente logueado | Sesiones reales de Firestore | `/sessions/active` resuelve a una sesión real (`accept-mem-3`) y el ítem queda resaltado; `/sessions/active/tutor` lleva a su tutor. Ya no apuntan a una sesión de demostración. |

## 3. Lo que NO se probó

| Qué falta | Por qué importa |
| --- | --- |
| **Una conversación de matemática real entre dos estudiantes en Meet** | Es la prueba central y no se hizo: en el único intento (`accept-mem-1`) entró una sola persona y no hubo conversación. Por eso **no existe `smoke-002`**. |
| **Que el mensaje del tutor llegue al chat de Meet** (`deliveredTo: meet_chat`) | El código y el contrato de Recall están verificados contra su documentación y con tests, pero nunca se vio un mensaje aparecer en un chat real. |
| **El reporte de competencias con una conversación real** | El cierre funciona (sección 2), pero nunca se generó el reporte de una conversación de matemática: no se sabe qué estados salen ni si las citas tienen sentido. |
| **La memoria entre sesiones** (sesión 1 → sesión 2) | Cada pieza se probó por separado (guardar, recordar, el prompt), pero nunca el ciclo completo. No se sabe si cambia el texto de la intervención. |
| **`SILENT_PEER`, `WRONG_ANSWER` y `CORRECT_ANSWER` con una conversación real de matemática** | Solo se vio `SILENT_PEER` y en una conversación que no era de matemática. |
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

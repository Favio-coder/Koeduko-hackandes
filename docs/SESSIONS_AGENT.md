# El agente de sesiones: qué hace, qué decide y qué no

Documento de decisiones del módulo de sesiones en vivo. Describe el **comportamiento** del agente. Para la
infraestructura (endpoints, costos de Firestore, despliegue) ver `server/README.md`; para el diagrama y los
tradeoffs, `ARCHITECTURE.md` §5 y §8; para lo que está probado, `TESTING.md`.

## 1. Qué es

Un **bot participante** ("Tutor KoEduko") entra a la reunión de Google Meet de una pareja de estudiantes, escucha,
y **a veces** dice algo. No resuelve el problema ni conversa: observa cómo trabajan juntos y, cuando detecta una
situación concreta, hace una pregunta corta para que se expliquen entre ellos. Al terminar, le entrega al docente
**evidencia** de lo que cada estudiante mostró, y recuerda a cada estudiante para la próxima sesión.

```text
escucha ─> decide ─> actúa ─> cierra ─> recuerda ─> usa la memoria
 Recall     reglas   app + chat  reporte   AtomicMemory   notas en el prompt
(Deepgram)           de Meet     docente   (por estudiante) de la próxima sesión
```

## 2. Quién decide qué

| Decisión | La toma | Por qué |
| --- | --- | --- |
| **Si el tutor interviene, a quién y por qué señal** | Reglas deterministas (`core/signals.js`) | Auditable, testeable y sin costo por evento. |
| **Cuándo no volver a hablar** | Reglas (enfriamiento de 60 s por señal) | Un tutor que interrumpe todo el tiempo molesta más de lo que ayuda. |
| **Las palabras del mensaje** | Gemini (`gemini-3.6-flash`) | Es lo único para lo que se necesita un modelo de lenguaje. |
| **Si el mensaje es aceptable** | Reglas (`core/interventionPolicy.js`) | Gemini no tiene la última palabra: si el texto rompe la política se usa un mensaje de respaldo. |
| **El estado de cada capacidad en el reporte** | Reglas (`core/competencyEvidence.js`) | Gemini solo etiqueta frases dudosas y su etiqueta nunca basta para «con evidencia». |
| **La calificación** | **El docente.** | El sistema no asigna notas (ni AD, A, B o C). |

## 2.1 La cadena automática (de la sala al reporte)

```
Docente crea las salas (emparejamiento) ──► registra el enlace de Meet de cada sala   ← único paso manual del docente
                                              │
Alguien de la sala toca «Entrar» ─────────────┤  abre el Meet y pide el tutor (docente o integrante de ESA sala)
                                              ▼
 /api/start-session-bot ─► reserva el bot (transacción, no se duplica) ─► asigna el problema si la sala no tiene
                           (según la habilidad en foco del grupo: core/problemBank.js) ─► crea el bot en Recall
                                              ▼
 Alguien admite al bot en Meet                                                         ← paso manual (ver límites)
                                              ▼
 Primer evento ─► bot.status = in_call ─► reglas / observador / aprendizaje ─► chat + voz
                                              ▼
 Se va la última persona (tras ≥ 3 frases) ─► cierre automático: reporte, memoria y perfil (aprende del resultado)
```

- El docente **monitorea** desde la sala (en vivo: quién habla, conversación, lo que dijo el tutor) y puede cerrar o
  invitar a mano en cualquier momento: los botones siguen ahí como respaldo.
- Asignar el problema solo ocurre si la sala no tiene uno; una sala con problema no se toca. Si falla, el bot entra igual.
- El cierre automático es idempotente (cerrar dos veces no repite nada) y no intenta sacar al bot: él sale solo 2 s después
  de que se va el último humano.

## 3. Las señales

Se evalúan como mucho cada 5 s de sesión, sobre una ventana de 3 minutos. Si varias saltan a la vez gana la de
mayor prioridad, y la misma señal no se repite antes de 60 s.

| Prioridad | Señal | Se dispara cuando |
| --- | --- | --- |
| 1 | `WRONG_ANSWER` | Un estudiante dijo un número como respuesta y no es el correcto. |
| 2 | `STUCK` | Hubo 2 o más frases de confusión («no entiendo», «me perdí», «ayuda»…) en la ventana. |
| 3 | `SILENT_PEER` | Alguien que lleva ≥ 30 s en la sala habla ≤ 15 % del tiempo hablado (con ≥ 45 s de conversación). |
| – | `GROUP_SILENCE` | **Apagada.** El silencio no genera eventos y el motor solo corre cuando llega uno; necesita un disparador periódico que aún no existe. |
| 5 | `DOMINANCE` | Uno solo habla ≥ 70 % del tiempo hablado. |
| 6 | `CORRECT_ANSWER` | Un estudiante dijo el resultado correcto: se le pide que explique por qué funciona. |

Las respuestas se leen frase por frase y entienden los números en palabras en español (hasta 1000). Una pregunta
(«¿cuánto son seis por ocho?») no cuenta como respuesta, y nombrar una operación («seis por ocho») tampoco: solo
cuenta el resultado que se anuncia después («son cuarenta y ocho»).

### 3.1 El observador de la conversación (cuando las reglas no dicen nada)

Las señales por reglas dependen de un problema con respuesta numérica y de patrones concretos. Una sesión sin problema, o
una conversación de otro tema, las dejaba mudas (se vio con dos compañeros reales: `currentProblem: null`, y el tutor
nunca habló). Para cubrirlo, `core/conversationJudge.js` agrega una capa que **solo corre si las reglas no intervinieron**:

- Cada ~20 s (y no antes de 35 s tras cualquier intervención), si hay al menos 8 palabras nuevas de personas, un modelo
  lee la conversación reciente (12 frases), con el contexto de la clase y el problema si existe, y responde un JSON:
  **hablar o callar**, tipo (`confusion`, `atasco`, `error-conceptual`, `fuera-de-tema`, `excluido`), destinatario y
  mensaje. Callar es lo normal.
- El modelo no ejecuta nada: el código valida el mensaje con la misma política (máx. 2 oraciones, una pregunta, nombra al
  destinatario, nunca la respuesta). Con una sola persona le habla solo a ella.
- No suma escrituras al estado (la marca `lastJudgeT` viaja en la que ya existe); si habla, 1 escritura más para que el
  cooldown la recuerde. Sale por chat y voz como las demás (`signal: CONVERSATION`, `source: observer`).
- Se apaga con `CONVERSATION_JUDGE_ENABLED=false`. Necesita `GEMINI_API_KEY`.

Límite: depende de la calidad de la transcripción y de un modelo; puede callar cuando debería hablar o al revés. Los logs
registran solo códigos (`speak`, `kind`, `why`), nunca lo que dijeron.

### 3.2 El latido: el reloj de la sala sigue corriendo en silencio

El motor solo despierta con eventos de Recall y el silencio no genera ninguno: si todos callan, nada lo evaluaba (ni
`GROUP_SILENCE`, ni el observador). Cada evento real deja un **ancla** (tiempo de sesión + reloj real) y `POST /api/tick`
calcula cuánto tiempo pasó desde ella (`core/heartbeat.js`) y reevalúa:

- Lo llama **la pantalla de la sala** (cada ~20 s mientras el tutor está en la reunión y la pestaña es visible) o un **cron
  externo** con la cabecera `x-tick-secret` (`TICK_SECRET`), por si nadie tiene la pantalla abierta.
- Una evaluación por sala cada 15 s como máximo, vengan de cuántas pantallas vengan (varias pantallas no multiplican el
  costo). No evalúa una sala cerrada, sin eventos, sin gente, o cuyo último evento tiene más de 10 minutos.
- Con el latido se enciende `GROUP_SILENCE` (40 s sin que nadie hable, con ≥ 2 personas). Costo: 1 lectura si no toca; 2-3
  lecturas y 2 escrituras si evalúa.
- Límite: sin pantalla abierta ni cron, el silencio sigue sin disparar nada.

### 3.3 Cuota de Gemini

`GEMINI_FALLBACK_MODEL`: si el modelo principal responde 429/5xx, el reintento usa ese (otro modelo suele tener su propia
cuota). `GEMINI_JUDGE_MODEL`: el observador puede usar un modelo más liviano, y tras un 429 se calla 30 s para no competir
con las intervenciones por reglas. Sin esas variables el comportamiento es el de antes (un reintento con el mismo modelo).

## 4. El mensaje del tutor

- **Máximo 2 oraciones y 220 caracteres**, una pregunta, el nombre del destinatario, y menciona el problema.
- **Nunca la respuesta.** La respuesta esperada no entra al prompt (un modelo no puede revelar lo que no sabe),
  vive en `private/answer` y el texto generado se rechaza si la contiene, en dígitos o en palabras.
- **Nunca dice de forma tajante que algo está mal.** Pide verificar un paso.
- Lo que dijeron los niños va entre «» como **dato**, nunca como instrucciones (mitigación de prompt injection).
- Si Gemini falla, tarda más de 6 s, no hay key o responde algo inválido, sale un **mensaje determinista**
  (por ejemplo, «Estudiante B, ¿cómo explicarías tú con tus palabras el problema?»). El tutor nunca queda mudo.
- Se entrega **en la pantalla del docente y en el chat de Meet** (`deliveredTo: ["app", "meet_chat"]`). Si el chat
  falla, la intervención queda igual en la app. Se apaga con `MEET_CHAT_ENABLED=false`.

## 5. El cierre: evidencia por competencias

Competencia del Currículo Nacional (primaria): **«Resuelve problemas de cantidad»**. Por estudiante y por capacidad,
un estado (`con evidencia`, `evidencia parcial`, `sin evidencia suficiente`) y hasta dos citas textuales con su minuto.

| Capacidad | Qué se mira |
| --- | --- |
| Traduce cantidades a expresiones numéricas | Frases que nombran una operación con números; confusión al plantear el problema (parcial, con una nota). |
| Comunica su comprensión sobre los números y las operaciones | % de habla y turnos de toda la sesión. |
| Usa estrategias y procedimientos de estimación y cálculo | Respuestas correctas o equivocadas del estudiante. |
| Argumenta afirmaciones sobre las relaciones numéricas | Frases que justifican («porque…»), después de una respuesta y con números u operaciones. |

**Es evidencia formativa, no una nota**, y la pantalla lo dice. Es conservadora a propósito: muchas capacidades
saldrán «sin evidencia suficiente» porque una reunión de pocos minutos y una transcripción automática no alcanzan
para más.

## 6. La memoria

Al cerrar se guarda por estudiante **una oración factual** («Sesión accept-001, multiplicación: comunicó 28% del
tiempo; usó estrategia correcta; sin evidencia de argumentación.»), sin transcripciones, citas, nombres ni la
respuesta. En la sesión siguiente, antes de redactar una intervención, se recuerda lo guardado del destinatario y
entra al prompt como contexto para personalizar la pregunta, sin cifras ni porcentajes.

- La clave del estudiante es su uid o un **hash** de (aula o docente + nombre en Meet): **seudónimo, no anónimo**.
- Depende de que el nombre en Meet sea el mismo entre sesiones.
- AtomicMemory es un servicio externo; si falla o tarda más de 2 s el tutor habla sin notas, y lo guardado cae a
  un respaldo en Firestore. Se apaga con `MEMORY_ENABLED=false`.

### 6.1 El tutor aprende de lo que pasó después de cada intervención

Además de la oración de memoria, hay un **perfil por estudiante** (`studentProfiles/{clave}` en Firestore, solo el
servidor lo lee) con conteos: sesiones, habilidades, señales y, lo nuevo, **qué estilo de intervención le sirvió**.

1. **Estilo.** Cada intervención se redacta con uno de tres estilos: `pregunta` (que explique con sus palabras),
   `pista` (qué dato mirar) o `paso` (un solo paso concreto). `core/learning.js` lo elige por estudiante y por señal:
   primero prueba cada estilo, después prefiere el de mejor tasa y a veces explora otro. Lo viejo pesa menos
   (olvido 0,9). Se guarda en cada intervención (`style`) y en el log.
2. **Resultado.** Al cerrar, `core/interventionOutcome.js` mira los 60 s posteriores a cada intervención: si el
   destinatario dio la respuesta o planteó la operación (`WRONG_ANSWER`, `STUCK`), habló (`SILENT_PEER`), habló otra
   persona (`DOMINANCE`) o hubo una explicación (`CORRECT_ANSWER`). Las señales de grupo no enseñan nada.
3. **Perfil.** El cierre suma esos resultados al perfil. En la siguiente sesión el perfil entra al prompt («suele
   participar poco…», «ha funcionado mejor el estilo X»).

Es aprendizaje **por conteos y memoria**, no un modelo entrenado. El resultado es una medida simple y explicable
(¿pasó algo útil en 60 s?), no un juicio sobre el niño; con pocas sesiones los conteos son ruido, y el selector
explora a propósito. Un fallo de este paso no rompe el cierre (`steps.learning`).

## 7. Datos de menores: qué se guarda, quién lo lee

| Dato | Dónde | Quién lo lee |
| --- | --- | --- |
| Transcripciones (texto) | `liveEvents` | El docente y los estudiantes de esa sesión. |
| Reparto de habla y últimas frases | `live/view` | El docente y los estudiantes de esa sesión. |
| Estado interno del motor | `live/state` | Nadie desde el navegador (solo el servidor). |
| Respuesta esperada | `private/answer` | Nadie desde el navegador. |
| Reporte de competencias | `summary/final` | Solo el docente. |
| Una oración por estudiante | AtomicMemory (externo) / `students/{key}/memory` | Solo el servidor. |

**Decisiones que no son nuestras y siguen abiertas:** consentimiento de las familias para que un bot escuche y
transcriba a menores; cuánto tiempo se conservan las transcripciones; y si un servicio externo de memoria es
aceptable para datos de menores. Hasta resolverlas, esto es un prototipo de demostración.

## 8. Límites conocidos

- **Meet automático (opcional):** si el docente conecta su cuenta de Google (tarjeta «Cuenta de Google» en Salas), una sala
  sin enlace recibe su reunión al tocar «Crear reunión y entrar»: el servidor crea el espacio con la API de Google Meet con
  `accessType: OPEN` (entra quien tenga el enlace, **sin sala de espera**, así el bot no necesita admisión). Sin esa conexión
  todo sigue como antes: el docente registra el enlace a mano y alguien admite al bot. El refresh token vive solo en el
  servidor (`teacherIntegrations/{uid}`) y el flujo usa un `state` firmado con vencimiento (`core/googleOAuth.js`).
  **Riesgo con menores:** con acceso `OPEN`, cualquiera que tenga el enlace puede entrar. El enlace solo lo ven los
  integrantes de la sala; se puede cambiar a `TRUSTED` con `GOOGLE_MEET_ACCESS`.
- Mientras la app de Google esté en modo «Pruebas», solo entran los usuarios de prueba y el permiso permanente puede
  caducar a los 7 días (a verificar): hay que volver a conectar.
- El cierre automático se dispara cuando se va la última persona; si alguien se desconecta un instante y vuelve, el
  bot ya salió (se va 2 s después) y la sesión queda cerrada.
- Las señales por reglas son 5; cuando ninguna salta, el observador de la conversación decide si hablar (§3.1).
- La transcripción automática se equivoca con nombres y números; el motor intervino **una sola vez** en la única
  prueba real (ver `TESTING.md`), y esa conversación no era de matemática.
- La asignación de cada participante a un uid de estudiante (`studentId`) sigue en `null`: por eso la memoria usa el
  nombre normalizado de Meet.
- La calidad del mensaje de Gemini se verificó con pruebas puntuales, no con niños.
- El bot necesita que el anfitrión lo admita en la reunión.

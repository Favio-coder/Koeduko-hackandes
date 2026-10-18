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
| **Cuándo no volver a hablar** | Reglas (enfriamiento de 90 s por señal) | Un tutor que interrumpe todo el tiempo molesta más de lo que ayuda. |
| **Las palabras del mensaje** | Gemini (`gemini-3.6-flash`) | Es lo único para lo que se necesita un modelo de lenguaje. |
| **Si el mensaje es aceptable** | Reglas (`core/interventionPolicy.js`) | Gemini no tiene la última palabra: si el texto rompe la política se usa un mensaje de respaldo. |
| **El estado de cada capacidad en el reporte** | Reglas (`core/competencyEvidence.js`) | Gemini solo etiqueta frases dudosas y su etiqueta nunca basta para «con evidencia». |
| **La calificación** | **El docente.** | El sistema no asigna notas (ni AD, A, B o C). |

## 3. Las señales

Se evalúan como mucho cada 5 s de sesión, sobre una ventana de 3 minutos. Si varias saltan a la vez gana la de
mayor prioridad, y la misma señal no se repite antes de 90 s.

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

- Solo 5 señales activas: cuando ninguna salta, el tutor calla. No es un tutor conversacional.
- La transcripción automática se equivoca con nombres y números; el motor intervino **una sola vez** en la única
  prueba real (ver `TESTING.md`), y esa conversación no era de matemática.
- La asignación de cada participante a un uid de estudiante (`studentId`) sigue en `null`: por eso la memoria usa el
  nombre normalizado de Meet.
- La calidad del mensaje de Gemini se verificó con pruebas puntuales, no con niños.
- El bot necesita que el anfitrión lo admita en la reunión.

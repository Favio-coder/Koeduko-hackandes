# KoEduko — Contratos de API

Todos los contratos viven en `src/shared/constants/contracts.js`.
**Ese archivo es compartido: no editar sin avisar al equipo.**

---

## 0. Constantes exportadas

| Export | Valor |
| --- | --- |
| `USER_ROLES` | `{ TEACHER: 'teacher', STUDENT: 'student' }` |
| `SESSION_STATUS` | `{ SCHEDULED, LIVE, COMPLETED, CANCELLED }` |
| `ASSESSMENT_STATUS` | `{ DRAFT, PUBLISHED, CLOSED }` |
| `COMPETENCY_ID` | `{ RESOLVE_QUANTITY_PROBLEMS: 'resuelve-problemas-cantidad' }` |
| `MATH_SKILLS` | `[{ id, label, description }]` — 6 habilidades de cantidad |
| `SKILL_IDS` | `['addition', 'subtraction', 'multiplication', 'division', 'fraction', 'estimation']` |
| `FIRESTORE_COLLECTIONS` | Nombres de colecciones |

## 1. Modelos

### User
```javascript
{ id, email, displayName, role: 'teacher'|'student', classroomId, emailVerified, createdAt }
```

### KnowledgeProfile (DEV 2)
```javascript
{ studentId, assessmentId, skills: Record<skillId, number /*0..1*/>, totalScore, computedAt }
```

### Pair (DEV 2)
```javascript
{ id, studentAId, studentBId, complementaryScore /*0..1*/, explanation }
```

### LearningSession (DEV 3)
```javascript
{ id, pairId, meetingUrl: string|null, status, scheduledAt }
```

### TutorInteraction (DEV 3)
```javascript
{ id, sessionId, studentId, hintLevel, prompt, response, createdAt }
```

---

## 2. Utilidades compartidas — `src/shared/lib/utils.js`

```javascript
clamp(value, min = 0, max = 1): number
round(value, decimals = 4): number
average(values: number[]): number
hashString(input: string): number          // entero 32 bits, determinista
deterministicId(prefix: string, parts: (string|number)[]): string
formatDate(timestamp): string
```

Regla: estas funciones son **puras**. Nada de Firebase, React, `Date.now()` ni
aleatoriedad sin semilla. Es lo que permite reproducir resultados.

## 3. Datos demo — `src/shared/lib/demoData.js`

```javascript
DEMO_CLASSROOM_ID: string
DEMO_STUDENTS: Student[]     // 5 estudiantes ficticios, 5to de primaria
toKnowledgeProfiles(students?): KnowledgeProfile[]  // con displayName incluido
```

Los valores de `skills` son **ficticios y fijos**. No son resultados calculados
de ninguna evaluación real.

---

## 4. Auth — `src/contexts/AuthContext.jsx`

```javascript
const {
  user,          // Firebase user o null
  profile,       // documento users/{uid} o null
  role,          // 'teacher' | 'student' | null
  loading,       // boolean (true mientras se resuelve onAuthStateChanged)
  error,
  isAuthenticated,
  isTeacher, isStudent,
  register({ email, password, displayName }): Promise<User>
  login({ email, password }): Promise<UserCredential>
  logout(): Promise<void>
  resetPassword(email): Promise<void>
} = useAuth()
```

**Errores:** `register` propaga los códigos de Firebase Auth
(`auth/email-already-in-use`, `auth/weak-password`, …). Las páginas capturan y
muestran un mensaje en español.

**Restricción:** `register` **no acepta `role`**. El rol se fija en `student`.

## 5. Assessments — DEV 2

La gestión de evaluaciones utiliza `src/features/assessments/services/assessmentService.js`
y el endpoint autenticado `POST /api/assessments`. Las operaciones privilegiadas
se ejecutan en `server/assessments/`; React no escribe directamente las
colecciones de evaluaciones.

```javascript
assessmentRequest(action, payload?): Promise<object>
```

Acciones docentes: `bootstrap`, `save`, `detail`, `publish`, `results`, `close`,
`finalize` y `export`. El servidor obtiene rol, matrícula, competencias y
habilidades autorizadas desde Firestore; nunca confía en permisos enviados por
React. `export` conserva el contrato `StudentKnowledgeProfile v1.0` y también está disponible en
`GET /api/assessments/matching-profile?courseId=...&assessmentId=...`, autenticado
y autorizado para el docente responsable. La pantalla de matching obtiene el
perfil directamente al abrirse con los parámetros `courseId` y `assessmentId`;
no se descarga JSON manualmente ni se inicia el agrupamiento sin confirmación
docente.

El adaptador `src/features/matching/services/assessmentProfileService.js`
expone `fetchMatchingProfile(assessmentId, courseId, getIdToken)` y consume ese
endpoint con el token de Firebase Auth.

Ver [Fase 2: gestión docente de evaluaciones](./assessments-phase-2.md) y
[esquema de Firestore](./FIRESTORE_SCHEMA.md) para los payloads y el detalle de
persistencia, validación y protección de respuestas correctas.

Para intentos de estudiante, `start` devuelve un intento recuperable con
preguntas públicas, `saveAnswers` guarda respuestas con control de revisión y
`submit` persiste el envío final de forma idempotente. Los permisos y la
disponibilidad se vuelven a validar en servidor en cada operación. Ver
[Fase 3: examen interactivo del estudiante](./assessments-phase-3.md) y
[Fase 4: calificación y contrato de matching](./assessments-redesign-phase-4.md).

## 6. Matching — DEV 2

`src/features/matching/algorithms/matchingAlgorithm.js`

```javascript
complementarityScore(profileA, profileB): number  // 0..1
matchStudents(profiles, options?): {
  pairs: Pair[],
  unmatchedStudentIds: string[],
  totalScore: number,
  algorithm: string
}
```

### Requisitos del algoritmo (verificables)

1. **Determinista:** mismos `profiles` ⇒ misma salida, byte a byte.
2. **Sin duplicados:** ningún `studentId` aparece en dos parejas.
3. **Cantidades impares:** los sobrantes van a `unmatchedStudentIds`.
4. **Explicable:** cada pareja trae `explanation` y desglose de brechas.
5. **Reproducible:** sin `Math.random()` ni dependencia de `Date.now()`.
   Para desempates, usar `hashString(studentAId + studentBId)`.
6. **Restricciones pedagógicas documentadas:** p. ej. evitar emparejar a alguien
   fuerte en *todo* con alguien débil en *todo* (no hay aprendizaje mutuo).

### Sobre la IA

La IA **no** genera las parejas. Puede redactar la `explanation` a partir del
desglose numérico, pero no puede modificar silenciosamente las asignaciones.
Si modifica una asignación, debe ser una acción explícita y visible del docente.

### Estrategia recomendada

Para los tamaños de aula de la hackathon (≤ 30 estudiantes), usar un **algoritmo
exacto de emparejamiento de peso máximo** (Blossom con pesos, o backtracking
con poda para ≤ 20). Si se adopta una heurística greedy, documentar explícitamente
en el código y en la UI que **no garantiza optimalidad**.

## 7. Sessions — DEV 3

`src/features/sessions/hooks/useSessions.js` (reemplazar la versión en memoria)

```javascript
useSessions(): { sessions, loading, error, reload, createSession }
useSession(sessionId): { session, loading, error, reload }
```

### Servicio de Firestore

```javascript
createSession({ pairId, title, meetingUrl? }): Promise<string>  // retorna sessionId
setMeetingUrl(sessionId, meetingUrl): Promise<void>
updateStatus(sessionId, status): Promise<void>
listSessions({ studentId? }): Promise<LearningSession[]>
```

### Validación de enlaces de Google Meet — Fase 1

```javascript
isValidMeetUrl(url): boolean
```
Debe aceptar solo `https://meet.google.com/<abc-defg-hij>` y rechazar cualquier
otro host. Nunca construir una URL de Meet falsa: si no hay enlace, `meetingUrl`
es `null` y la UI muestra "sin enlace de reunion".

## 8. Tutor IA — DEV 3

### Cliente — `src/features/ai/services/tutorService.js`

```javascript
askTutor({ sessionId, prompt }): Promise<string>
```

Lanza `Error` con el mensaje del servidor (o uno amistoso si no hay red) cuando falta `sessionId`/`prompt` o el servidor no responde.
**Nunca** llamar a la API de Gemini desde el navegador.

### Endpoint — `server/api/ask-tutor.js` (Vercel)

```text
POST https://koeduko.vercel.app/api/ask-tutor
Authorization: Bearer <Firebase ID token>
{ sessionId, prompt }  ->  { reply: string }
```

- Lo puede llamar el docente o un estudiante cuyo uid esté en `studentIds` de la sesión.
- Errores HTTP: `401` sin token válido, `400` entrada inválida, `403` sin permiso, `404` sesión inexistente, `500` interno.
- CORS: solo los orígenes de `ALLOWED_ORIGINS` más `http://localhost:5173`; nunca `*`.
- Registra la interacción en `learningSessions/{id}/tutorInteractions`.
- Reutiliza `gemini.js` y `interventionPolicy.js` (`composeHint`): modelo fijado, límite de 6 s y
  respuesta determinista si Gemini falla. La respuesta esperada nunca viaja en el prompt.

### Endpoint — `server/api/start-session-bot.js`

```text
POST https://koeduko.vercel.app/api/start-session-bot
Authorization: Bearer <Firebase ID token del docente>
{ sessionId }  ->  { botId }
```

Solo docente. Lee el enlace de Meet de la sesión guardada (el navegador no lo envía) y evita
invitar dos veces con una transacción. El estado queda en `learningSessions/{id}.bot.status`
(`requested`, `in_call`, `done`, `failed`).

### Endpoint — `server/api/close-session.js`

```text
POST https://koeduko.vercel.app/api/close-session
Authorization: Bearer <Firebase ID token del docente>
{ sessionId }  ->  { status: "completed", alreadyClosed, report, steps, memory }
```

Solo docente. Saca al tutor de la reunión, arma el reporte de evidencia por competencias, lo guarda en
`learningSessions/{id}/summary/final`, recuerda a cada estudiante y marca la sesión `completed`. Ningún
servicio externo puede romper el cierre: `steps` dice qué pasó con cada uno (`leaveCall`, `classifier`,
`memory`). Es idempotente (`alreadyClosed: true` devuelve el reporte guardado). Errores: `401`, `403`, `400`,
`404` (sesión inexistente), `500`. `memory` (texto guardado por estudiante) solo viaja en esta respuesta, no se
guarda en el resumen.

`report` es **evidencia formativa, nunca una nota**: no existe AD/A/B/C. Por estudiante y por capacidad
(`traduce`, `comunica`, `usa-estrategias`, `argumenta`, constantes `QUANTITY_CAPABILITIES` en
`src/shared/constants/contracts.js`):

```javascript
{
  v: 1,
  competencia: { id: "resuelve-problemas-cantidad", nombre: "Resuelve problemas de cantidad" },
  nota: "Evidencia formativa: la calificación la decide el docente.",
  problema: { activityId, skillId, text },          // nunca la respuesta esperada
  duracionSeg: 120,
  estudiantes: [{
    key, name, studentId,
    resumen: { talkPct, talkSec, turns, estimated },
    capacidades: [{
      id, nombre,
      estado: "con evidencia" | "evidencia parcial" | "sin evidencia suficiente",
      evidencias: [{ t: 24, cita: "porque seis veces ocho es cuarenta y ocho" }],   // cita textual corta + segundo
      señales: ["CORRECT_ANSWER", ...],
      nota?: "Mostró dificultad al plantear el problema."
    }]
  }]
}
```

### Webhook — `server/api/recall-webhook.js`

Recibe los eventos de Recall.ai (token en la query, comparación en tiempo constante). Alimenta
`learningSessions/{id}/live/state` y escribe `live/view` y `agentInterventions`. Ver `server/README.md`.

## 9. Firebase — `src/services/firebase.js`

```javascript
firebaseApp  // instancia única (default export)
auth         // getAuth
db           // getFirestore
storage      // getStorage (solo si resulta necesario)
```

No hay Cloud Functions: el proyecto Firebase está en el plan gratuito (Spark). Todo lo privilegiado
vive en `server/`, un proyecto aparte de Vercel; el navegador lo llama con `src/services/serverApi.js`.
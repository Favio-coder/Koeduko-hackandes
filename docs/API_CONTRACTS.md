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
getMatchingContract(assessmentId, courseId): Promise<MatchingContractV1>
```

Acciones docentes: `bootstrap`, `save`, `detail`, `publish`, `results`, `close`,
`finalize` y `export`. El servidor obtiene rol, matrícula, competencias y
habilidades autorizadas desde Firestore; nunca confía en permisos enviados por
React. `export` conserva el contrato JSON `1.0` y también está disponible en
`GET /api/assessments/matching-profile?courseId=...&assessmentId=...`, autenticado
y autorizado para el docente responsable.

Ver [Fase 2: gestión docente de evaluaciones](./assessments-phase-2.md) y
[esquema de Firestore](./FIRESTORE_SCHEMA.md) para los payloads y el detalle de
persistencia, validación y protección de respuestas correctas.

Para intentos de estudiante, `start` devuelve un intento recuperable con
preguntas públicas, `saveAnswers` guarda respuestas con control de revisión y
`submit` persiste el envío final de forma idempotente. Los permisos y la
disponibilidad se vuelven a validar en servidor en cada operación. Ver
[Fase 3: examen interactivo del estudiante](./assessments-phase-3.md) y
[Fase 4: calificación y contrato de matching](./assessments-phase-4.md).

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

Lanza `Error` si falta `sessionId`/`prompt` o si la función no responde.
**Nunca** llamar a la API de Gemini desde el navegador.

### Cloud Function — `functions/src/agents/askTutor.js`

```javascript
onCall({ region: 'europe-west1', secrets: [geminiApiKey] })
  -> { reply: string }
```

- Entrada: `{ sessionId, prompt }`.
- Errores: `unauthenticated`, `invalid-argument`, `not-found`, `internal`.
- Registra la interacción en `learningSessions/{id}/tutorInteractions`.

### PedagogyPrompt — `functions/src/agents/tutorPrompt.js`

```javascript
buildTutorInstruction({ prompt, skillLabel, level }): string
buildTutorPayload({ prompt, skillLabel, level }): { systemInstruction, prompt }
```

Reglas: español breve (máx. 4 frases), favorece la explicación entre compañeros,
pistas progresivas por nivel, **nunca entrega la solución final**.

## 9. Firebase — `src/services/firebase.js`

```javascript
firebaseApp  // instancia única (default export)
auth         // getAuth
db           // getFirestore
functions    // getFunctions(region: 'europe-west1')
storage      // getStorage (solo si resulta necesario)
```

Cambiar la región de Functions exige actualizar **dos** lugares:
`src/services/firebase.js` y la opción `region` en la Cloud Function.
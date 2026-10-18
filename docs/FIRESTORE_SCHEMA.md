# KoEduko — Esquema de Firestore

Reglas en `firestore.rules`. Índices en `firestore.indexes.json`.

## Convenciones

- `uid` de Firebase Auth se usa como `id` de documento en `users`, `students`.
- Los demás documentos usan ids legibles y estables: `assessment-001`, `pair-001`,
  `session-001`.
- Todos los documentos llevan `createdAt` como `Timestamp` de servidor.
- Los campos de fecha usan `Timestamp` (no strings) para permitir ordenamiento.

---

## users/{uid}

```javascript
{
  email: "docente@coeduko.dev",
  displayName: "Docente Demo",
  role: "teacher" | "student",
  classroomId: "classroom-demo-5a" | null,
  emailVerified: false,
  createdAt: Timestamp
}
```

- El registro público siempre escribe `role: "student"`.
- Las rules prohíben que un usuario cambie su propio `role` o `classroomId`.
- Solo un docente (o admin vía Rules/console) puede promover a `teacher`.

## classrooms/{classroomId}

```javascript
{
  name: "5to A",
  grade: "5to",
  teacherId: "uid-del-docente",
  studentIds: ["student-001", "..."],
  competitionId: "resuelve-problemas-cantidad",
  createdAt: Timestamp
}
```

## students/{studentId}

```javascript
{
  userId: "uid" | null,
  displayName: "Ana Torres",
  grade: "5to",
  classroomId: "classroom-demo-5a",
  createdAt: Timestamp
}
```

## assessments/{assessmentId}

> **Legacy contract.** La gestión docente implementada usa las colecciones
> `assessmentCourseAccess` y `assessmentModules` descritas a continuación. Este
> modelo anterior no es la fuente de persistencia de la API de evaluaciones.

```javascript
{
  title: "Diagnostico inicial - Cantidad",
  competitionId: "resuelve-problemas-cantidad",
  classroomId: "classroom-demo-5a",
  createdBy: "uid-del-docente",
  status: "draft" | "published" | "closed",
  items: [
    {
      id: "item-01",
      skillId: "addition",
      prompt: "Si Ana tiene 12 canicas y gana 5 mas, ¿cuantas tiene?",
      options: [15, 17, 8],
      correctIndex: 0,
      explanation: "Se suman las dos cantidades: 12 + 5 = 17."
    }
  ],
  createdAt: Timestamp
}
```

## Gestión docente de evaluaciones (Fase 2)

El backend accede a estas colecciones mediante Firebase Admin SDK. Las reglas
de Firestore deniegan el acceso directo del cliente a todas ellas; las
operaciones se realizan a través de `POST /api/assessments`, que verifica un
Firebase ID token y vuelve a comprobar rol, pertenencia al curso y asignación.

### assessmentCourseAccess/{courseId}

ACL provisionada por administración. `teacherId` y `studentIds` son UIDs de
Firebase Authentication. `competencies` es opcional: cuando se omite, se usa
`competencyId` o la competencia inicial del proyecto.

```javascript
{
  name: "Matemática 5A",
  teacherId: "uid-docente",
  studentIds: ["uid-estudiante-1", "uid-estudiante-2"],
  competencyId: "resuelve-problemas-cantidad",
  competencyLabel: "Resuelve problemas de cantidad",
  competencies: [
    { id: "resuelve-problemas-cantidad", label: "Resuelve problemas de cantidad" }
  ],
  skills: [{ id: "addition", label: "Adición" }]
}
```

La API deriva el docente, la matrícula, las competencias y las habilidades
permitidas de esta ACL. No confía en la matrícula, el rol ni el curso enviados
por el navegador.

### assessmentModules/{assessmentId}

Documento de metadatos consultable por backend, sin preguntas ni claves.

```javascript
{
  id: "uuid",
  title: "Diagnóstico inicial",
  courseId: "matematica-5a",
  competencyId: "resuelve-problemas-cantidad",
  type: "diagnostic", // diagnostic | exam | practice | homework
  scale: 20, // 20 | 100
  maxScore: 20,
  durationMinutes: 30, // 0 = sin límite
  attemptLimit: 1,
  weightPercent: 0,
  feedbackMode: "after_close",
  startsAt: "2026-10-17T12:00:00.000Z",
  endsAt: "2026-10-18T12:00:00.000Z",
  studentIds: ["uid-estudiante-1"],
  ownerId: "uid-docente",
  status: "draft", // draft | published | closed | finalized
  revision: 1,
  createdAt: "2026-10-17T12:00:00.000Z",
  updatedAt: "2026-10-17T12:00:00.000Z"
}
```

Subcolecciones del módulo:

```text
assessmentModules/{id}/private/definition
  Definición completa y autoritativa; contiene preguntas, correctAnswer y
  explanation. Solo la API/Admin SDK puede leerla.

assessmentModules/{id}/public/questions
  Preguntas sanitizadas; no contiene correctAnswer ni explanation.

assessmentModules/{id}/assignments/{studentUid}
  studentId, count, activeAttemptId, resultStatus, result, scaledScore,
  gradedAt y lastAttemptId. `result.overallScore` y los resultados por
  conocimiento contienen puntajes brutos; `scaledScore` es la nota convertida
  a `assessmentModules/{id}.scale`. Solo la API/Admin SDK puede acceder.

assessmentModules/{id}/assignments/{studentUid}/attempts/{attemptId}
  status, startedAt, expiresAt, answers, revision, savedAt, result,
  scaledScore y gradedAt. Las respuestas y resultados no son legibles desde
  el cliente; el endpoint devuelve solo lo autorizado para esa identidad.
```

La API omite claves y explicaciones en `start`; la retroalimentación se entrega
únicamente según `feedbackMode`. La publicación crea los documentos de
asignación dentro de la misma transacción que cambia el estado. El contrato de
exportación JSON `1.0` permanece sin cambios.

La exportación solo está disponible cuando el estado es `finalized`, cada
estudiante asignado tiene un resultado validado y no queda ningún intento
activo. No se exportan habilidades sin evidencia. Ver
[Fase 4: calificación y contrato de matching](./assessments-phase-4.md).

## knowledgeProfiles/{profileId}

```javascript
{
  studentId: "student-001",
  assessmentId: "assessment-001",
  classroomId: "classroom-demo-5a",
  skills: {
    addition: 0.9,
    subtraction: 0.4,
    multiplication: 0.7,
    division: 0.2,
    fraction: 0.1,
    estimation: 0.35
  },
  strengths: ["addition"],
  difficulties: ["fraction", "division"],
  totalScore: 68,
  computedAt: Timestamp
}
```

- `skills` son *mastery scores* normalizados en `[0, 1]`, uno por cada
  `MATH_SKILLS.id` de `src/shared/constants/contracts.js`.

## matchingResults/{resultId}

```javascript
{
  assessmentId: "assessment-001",
  classroomId: "classroom-demo-5a",
  algorithm: "exact-max-weight" | "greedy",
  objective: "maximizar complementariedad total",
  totalScore: 3.42,
  unmatchedStudentIds: ["student-005"],
  confirmedBy: "uid-del-docente" | null,
  createdAt: Timestamp
}
```

### matchingResults/{resultId}/pairs/{pairId}

```javascript
{
  id: "pair-001",
  studentAId: "student-001",
  studentBId: "student-002",
  complementaryScore: 0.82,
  skillGaps: [
    { skillId: "division", aMastery: 0.3, bMastery: 0.7, gap: 0.4 }
  ],
  explanation: "Fortalezas complementarias en adicion y division.",
  createdAt: Timestamp
}
```

## learningSessions/{sessionId}

```javascript
{
  pairId: "pair-001",
  matchingResultId: "result-001",
  title: "Sesion 1 - Ana y Luis",
  studentIds: ["student-001", "student-002"],
  meetingUrl: null,
  meetingProvider: "google-meet",
  status: "scheduled" | "live" | "completed" | "cancelled",
  scheduledAt: Timestamp | null,
  startedAt: Timestamp | null,
  endedAt: Timestamp | null,
  participation: {
    "student-001": { "joinedAt": Timestamp, "messagesCount": 0 },
    "student-002": { "joinedAt": Timestamp, "messagesCount": 0 }
  },
  createdBy: "uid-del-docente",
  createdAt: Timestamp
}
```

- Un estudiante solo puede modificar `status`, `joinedAt` y `participation` (regla acotada).
- El docente gestiona el resto, incluido `meetingUrl`.

### learningSessions/{sessionId}/tutorInteractions/{interactionId}

```javascript
{
  studentId: "uid",
  hintLevel: 1,
  prompt: "no entiendo la parte de multiplicar",
  response: "¿Cuantas cajas hay? ¿Cuantas hay en cada caja?",
  createdAt: Timestamp
}
```

- Escritura **exclusiva de Cloud Functions** (`allow write: if false` en rules).
- Lectura: el propio estudiante o el docente.

---

## Índices requeridos

| Colección | Campos | Consulta que lo exige |
| --- | --- | --- |
| `knowledgeProfiles` | `studentId` ASC, `computedAt` DESC | Último perfil de un estudiante |
| `knowledgeProfiles` | `assessmentId` ASC, `computedAt` DESC | Perfiles de un diagnóstico |
| `tutorInteractions` | `studentId` ASC, `createdAt` DESC | Historial del estudiante |

Las consultas con igualdad en un solo campo (p. ej. `where('classroomId', '==')`)
usan índices automáticos. Crear un índice compuesto solo cuando la consulta lo
requiera: los índices tienen costo.

## Despliegue

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Emuladores

```bash
firebase emulators:start
```

Usar siempre emuladores para probar reglas antes de desplegar.
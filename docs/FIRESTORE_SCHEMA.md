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

- Escritura **exclusiva del servidor** (`server/`, con firebase-admin; `allow write: if false` en rules).
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
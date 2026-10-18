# KoEduko — Tareas por desarrollador

Ramas: `feature/auth-dashboard` (DEV 1), `feature/matching-engine` (DEV 2),
`feature/sessions-ai` (DEV 3).

## Estado actual de la base (ya implementado por el arquitecto)

- Tailwind CSS v4 + React Router v7 + Vitest configurados.
- `src/app/router.jsx` con **todas** las rutas registradas.
- `src/app/ProtectedRoute.jsx`, `DashboardLayout`, `Navbar`, `Sidebar`.
- Primitivas en `src/components/ui/` (`Button`, `Card`, `Badge`, `ProgressBar`,
  `LoadingState`, `ErrorState`, `EmptyState`).
- `AuthContext` funcional (register/login/logout/reset).
- Páginas Login, Register, ForgotPassword, TeacherDashboard, StudentDashboard.
- Contratos en `src/shared/constants/contracts.js`.
- Datos demo en `src/shared/lib/demoData.js`, utilidades puras en `shared/lib/utils.js`.
- Stubs funcionales de Assessments, Matching, Sessions, Tutor.
- Backend privilegiado en `server/` (Vercel): `ask-tutor`, `start-session-bot` y `recall-webhook`, con verificación del token de Firebase.
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`.
- Lint y build verdes; 5 tests unitarios pasando.

---

## DEV 1 — Frontend, autenticación y UX

**Rama:** `feature/auth-dashboard`
**Rama base:** `main` (ya existe `main`; crear la rama localmente)

### Archivos que YA son tuyos (no hay conflicto posible)
```text
src/features/auth/**
src/features/dashboard/**
src/contexts/AuthContext.jsx
src/components/layout/**
```

### Archivos que puedes crear
```text
src/features/auth/services/authService.js
src/features/dashboard/components/*
```

### Archivos que NO debes tocar
`src/features/{matching,sessions,assessments,ai}/**`, `src/shared/**`,
`server/**`, `firestore.rules`, `docs/`. Si necesitas un cambio ahí,
avisa en el canal del equipo antes de mergear.

### Tareas

| # | Tarea | Prioridad |
| --- | --- | --- |
| 1.1 | Registro de estudiantes (CRUD de `students` dentro del aula del docente) | P0 |
| 1.2 | Listado de aulas y creación de aula (`classrooms`) | P0 |
| 1.3 | Estados de carga, error y vacío en todas las vistas | P0 |
| 1.4 | Verificación responsive real (móvil 375px y escritorio) | P0 |
| 1.5 | Endpoint `promoteToTeacher` en `server/` (no hay Cloud Functions) para asignar el rol docente de forma confiable | P0 |
| 1.6 | Dashboard docente: consume resultados de matching y sesiones | P1 |
| 1.7 | Enlace al perfil del estudiante | P2 |

**Sobre el rol docente (tarea 1.5):** ya está implementado el patrón correcto —
el registro público siempre escribe `role: 'student'` y las rules prohíben que un
usuario cambie su propio rol. Falta la vía real de promoción. Opciones:
- Endpoint en `server/` protegido con secreto de invitación (recomendado), o
- consola de Firebase / script de administrador.

### Criterios de aceptación
- [ ] Un usuario puede registrarse e iniciar sesión; la sesión persiste al recargar.
- [ ] Las rutas privadas redirigen a `/login` y respetan el `state.from`.
- [ ] Un estudiante que entra a `/matching` es redirigido a su dashboard.
- [ ] El dashboard es usable a 375px de ancho.
- [ ] No hay credenciales privadas en el bundle de React.
- [ ] `npm run lint` y `npm run build` pasan.

---

## DEV 2 — Diagnóstico, optimización combinatoria y emparejamiento

**Rama:** `feature/matching-engine`

### Archivos que YA son tuyos
```text
src/features/assessments/**
src/features/matching/**
```

### Archivos que puedes crear
```text
src/features/matching/algorithms/matchingAlgorithm.js
src/features/matching/services/matchingService.js
src/features/assessments/services/assessmentService.js
src/features/matching/tests/*.test.js
```

**Importante:** el directorio `src/features/matching/tests/` está vacío a
propósito. Tus pruebas van ahí. No las coloques junto al algoritmo: la convención
del proyecto es el subdirectorio `tests/`.

### Dependencia
Necesitas que DEV 1 cree los documentos en `students`. Mientras tanto usa
`toKnowledgeProfiles(DEMO_STUDENTS)` de `shared/lib/demoData.js`.

### Tareas

| # | Tarea | Prioridad |
| --- | --- | --- |
| 2.1 | Items del diagnóstico de «Resuelve problemas de cantidad» (5to primaria) | P0 |
| 2.2 | `computeKnowledgeProfile`: puntuar respuestas y derivar mastery por skill | P0 |
| 2.3 | Persistir `assessments` y `knowledgeProfiles` | P0 |
| 2.4 | `complementarityScore(a, b)` con la función objetivo documentada | P0 |
| 2.5 | `matchStudents(profiles)` exacto para ≤ 20 estudiantes | P0 |
| 2.6 | `MatchingPage`: ejecutar, previsualizar y **confirmar** parejas | P0 |
| 2.7 | Persistir `matchingResults` + subcolección `pairs` | P0 |
| 2.8 | `MatchingResultsPage` con tabla de parejas y explicaciones | P0 |
| 2.9 | Manejo de cantidad impar de estudiantes | P0 |
| 2.10 | Pruebas: normal, impar, vacío, 1 estudiante, todos iguales, alta asimetría | P0 |
| 2.11 | Escalado a heurística greedy si el exacto es demasiado lento | P2 |

### Requisitos del algoritmo (no negociables)
1. Determinista: mismos datos ⇒ misma salida. Usa `hashString` de
   `shared/lib/utils.js` para desempates; **nunca** `Math.random()`.
2. Cada estudiante aparece en **una sola** pareja o en `unmatchedStudentIds`.
3. Si usas una heurística, declara en el código y **en la UI** que no garantiza
   optimalidad.
4. La IA no decide las parejas. Como mucho redacta la `explanation`.

### Criterios de aceptación
- [ ] El algoritmo corre con datos simulados (`toKnowledgeProfiles()`).
- [ ] Ningún `studentId` aparece en dos parejas (test explícito).
- [ ] Con 5 estudiantes se forman 2 parejas y 1 queda sin pareja.
- [ ] Dos ejecuciones seguidas producen el mismo resultado (test de reproducibilidad).
- [ ] `npm test` pasa con al menos 6 casos, incluidos los extremos.
- [ ] El docente ve las parejas con puntuación y explicación antes de confirmar.

---

## DEV 3 — Sesiones, Google Meet y tutor IA

**Rama:** `feature/sessions-ai`

### Archivos que YA son tuyos
```text
src/features/sessions/**
src/features/ai/**
server/**
```

### Dependencias
- Parejas de DEV 2 (`matchingResults/{id}/pairs/{id}`).
- `server/src/firebaseAdmin.js` y la verificación del token de los endpoints — **no editar** sin avisar.

### Tareas

| # | Tarea | Prioridad |
| --- | --- | --- |
| 3.1 | Persistencia real de `learningSessions` en Firestore | P0 |
| 3.2 | Crear sesión vinculada a un `pairId` | P0 |
| 3.3 | Registro y validación de enlaces de Google Meet (`isValidMeetUrl`) | P0 |
| 3.4 | Botón «unirse a la reunión» con estados vacío/cargando/error | P0 |
| 3.5 | Estados de sesión y registro de participación básica | P1 |
| 3.6 | Desplegar `askTutor` con el secreto `GEMINI_API_KEY` | P1 |
| 3.7 | UI del tutor con pistas progresivas por nivel | P1 |
| 3.8 | Historial de interacciones del estudiante | P1 |
| 3.9 | Recomendaciones al docente al cerrar la sesión | P2 |
| 3.10 | Creación automática de reuniones vía Google Meet API | P2 |

### Reglas de Google Meet
- **Fase 1:** el docente pega un enlace existente. Si no hay enlace,
  `meetingUrl = null`. **Nunca simular una reunión creada.**
- **Fase 2:** solo si da tiempo. Requiere OAuth con scopes de Calendar/Meet.

### Reglas del tutor IA
- Gemini se llama **solo** desde `server/` (`api/ask-tutor.js` y el motor de sesiones).
- La API key es una variable de entorno secreta del proyecto Vercel `ko_eduko`. **Nunca** en `.env`, en Firestore
  ni en una variable `VITE_`.
- El tutor da pistas y hace preguntas. **No entrega la solución final.**

### Criterios de aceptación
- [ ] El docente crea una sesión y queda visible para la pareja.
- [ ] Un enlace inválido se rechaza con mensaje claro; uno válido se guarda.
- [ ] El estudiante abre su enlace de Meet desde `/sessions/:id`.
- [ ] `askTutor` responde y registra la interacción (solo si la desplegaste;
  si no, dilo explícitamente en la entrega).
- [ ] Hay estados de carga y error en todas las vistas.
- [ ] `npm run lint` y `npm run build` pasan.

---

## Dependencias cruzadas

| Depende de | Quién | Qué necesita |
| --- | --- | --- |
| DEV 2 | DEV 1 | Documentos en `students` y aula del docente |
| DEV 3 | DEV 2 | `pairs` confirmadas |
| DEV 1 | DEV 2 + DEV 3 | Datos para poblar el dashboard docente |

Orden de integración: **DEV 1 → DEV 2 → DEV 3**. Ver `INTEGRATION_GUIDE.md`.
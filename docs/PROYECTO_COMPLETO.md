# KoEduko — Documento técnico completo

> **Alcance de este documento.** Describe el problema, la arquitectura y **toda** la complejidad del
> proyecto: qué hace, cómo está construido, por qué cada decisión se tomó, qué está probado, qué no,
> y dónde está la deuda técnica.
>
> Versión analizada: commit `bbffbae` · 214 archivos de producción · 122 de pruebas · ~44 000 líneas.

---

## Índice

1. [El problema](#1-el-problema)
2. [Qué es KoEduko](#2-qué-es-koeduko)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Arquitectura](#4-arquitectura)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Los flujos de negocio](#6-los-flujos-de-negocio)
7. [Módulo 1 · Evaluaciones](#7-módulo-1--evaluaciones)
8. [Módulo 2 · Emparejamiento](#8-módulo-2--emparejamiento)
9. [Módulo 3 · Sesiones en vivo y tutor IA](#9-módulo-3--sesiones-en-vivo-y-tutor-ia)
10. [Módulo 4 · Dashboard y gamificación](#10-módulo-4--dashboard-y-gamificación)
11. [Sistema de diseño](#11-sistema-de-diseño)
12. [Seguridad y datos de menores](#12-seguridad-y-datos-de-menores)
13. [Testing](#13-testing)
14. [Complejidad](#14-complejidad)
15. [Riesgos y deuda técnica](#15-riesgos-y-deuda-técnica)
16. [Métricas](#16-métricas)
17. [Glosario](#17-glosario)

---

## 1. El problema

### 1.1 Problema educativo

En una clase de primaria, el docente asigna a los estudiantes a parejas o tríos de forma
aproximada: por afinidad, por afinidad de nivel, o simplemente por proximidad. El resultado habitual:

- **Parejas homogéneas**: dos estudiantes con la misma dificultad. Se estorban mutuamente y nadie
  avanza.
- **Parejas arbitrarias**: uno sabe y el otro no, pero no se sabe *en qué* exactamente.
- **El estudiante que más necesita ayuda es el que menos habla**: la dinámica de una reunión de
  pares favorece al que es más rápido o más extrovertido, no al que tiene el vacío de
  conocimiento.

KoEduko parte de una tesis simple y verificable: **el montaje de los grupos es una decisión que
puede tomar un algoritmo, si se le da evidencia por competencia y un objetivo explícito.**

De ahí salen tres problemas técnicos concretos:

| # | Problema | Solución en KoEduko |
|---|----------|---------------------|
| P1 | No hay datos por destreza, solo una nota global | Diagnóstico por ítems → `mastery` por cada una de las 6 destrezas matemáticas |
| P2 | Agrupar es un problema de optimización combinatoria real, no un `sort()` | Emparejamiento de peso máximo con blossom + enumeración de tríos |
| P3 | Una reunión de pares no produce evidencia formativa de lo que cada uno entendió | Bot participante que observa, interviene con reglas, y al cierre emite evidencia por competencia |

### 1.2 Problema técnico de fondo

Tres restricciones reales que **condicionaron toda la arquitectura** y que aparecen en cada decisión
del código:

1. **Plan gratuito de Firebase (Spark).** Cloud Functions y sus secretos exigen el plan Blaze.
   Sin Functions, sin Secret Manager, sin triggers. Esto obligó a construir todo el backend
   privilegiado sobre Vercel Functions.
2. **Cuota de Firestore: 50 000 lecturas y 20 000 escrituras por día.** Un bot en una reunión
   genera ~2,5 eventos por segundo. Releer una ventana de eventos por evento es inviable. Esto
   obligó a diseñar un modelo de **estado incremental** en lugar de ventana temporal.
3. **Datos de menores + transcripción automática.** Un servicio externo que escucha y transcribe la
   voz de un niño, y otro que almacena notas sobre ese niño, son decisiones que no pertenecen al
   producto.

### 1.3 Honestidad epistemológica

El README, `docs/ARCHITECTURE.md` y `docs/TESTING.md` son explícitos y consistentes en un punto:

> El proyecto demuestra que **el flujo funciona**. **No demuestra que la plataforma mejore el
> aprendizaje.** No existe evidencia empírica y no debe afirmarse lo contrario.

`docs/TESTING.md` §3 mantiene una lista de lo que **no** se probó. Es un documento poco común y es
la mayor fortaleza de evidencia del proyecto.

---

## 2. Qué es KoEduko

Plataforma educativa que:

1. **Evalúa** a estudiantes con diagnósticos por destreza matemática.
2. **Empareja** con optimización combinatoria, buscando oportunidad de apoyo mutuo por
   competencia, no parecido.
3. **Facilita** sesiones de aprendizaje colaborativo en Google Meet con un tutor de IA que entra
   como bot participante.
4. **Reporta** evidencia formativa por competencia (nunca una nota).
5. **Recuerda** a cada estudiante para personalizar la siguiente sesión.

**Competencia inicial declarada:** «Resuelve problemas de cantidad», quinto de primaria, con las
4 capacidades del Currículo Nacional colombiano:

| id | Capacidad |
|----|-----------|
| `traduce` | Traduce cantidades a expresiones numéricas |
| `comunica` | Comunica su comprensión sobre los números y las operaciones |
| `usa-estrategias` | Usa estrategias y procedimientos de estimación y cálculo |
| `argumenta` | Argumenta afirmaciones sobre las relaciones numéricas |

**6 destrezas** (`MATH_SKILLS`): `addition`, `subtraction`, `multiplication`, `division`, `fraction`,
`estimation`. El mastery de cada una es un número en `[0,1]`.

---

## 3. Stack tecnológico

### 3.1 Tabla

| Capa | Tecnología | Rol |
|------|-----------|-----|
| Frontend | React 19.2 + Vite 8 (JavaScript + JSX, **sin TypeScript**) | SPA con 15 rutas |
| Estilos | Tailwind CSS v4 (`@tailwindcss/vite`, sin config) | Sin `tailwind.config.js`; tokens en `src/components/ui/tokens.js` |
| Routing | React Router 7 | BrowserRouter + rutas lazy |
| UI | Kit propio de 18 primitivas | Sin librería de componentes |
| Alertas | SweetAlert2 11 + CSS propio (454 líneas) | Modales SweetAlert con tokens del kit |
| Auth | Firebase Authentication (email/password) | Registro, login, recuperación |
| Datos cliente | Cloud Firestore (SDK web) | Lecturas en tiempo real (`onSnapshot`) |
| Datos servidor | `firebase-admin` | Escrituras privilegiadas (no pasan por las reglas) |
| Backend A (raíz) | Vercel Functions `api/` — Node 22 ESM | **Evaluaciones** + publicación de salas |
| Backend B (`server/`) | Vercel Functions `api/` — Node 22 ESM, proyecto Vercel **independiente** (`ko_eduko`) | **Sesiones en vivo y tutor IA** |
| Bot en reunión | Recall.ai | Bot participante + transcripción |
| STT | Deepgram `nova-3` (es) **vía Recall** | Sin integración propia |
| LLM | Gemini `gemini-3.6-flash` | **Solo redacta.** Nunca decide |
| LLM secundario | `GEMINI_JUDGE_MODEL` | Observador de conversación, cuota separada |
| TTS | ElevenLabs `eleven_flash_v2_5` | Experimental, apagado por defecto |
| Memoria | AtomicMemory (HTTP directo) + respaldo Firestore | Una oración por estudiante |
| Reuniones | Google Meet + API de Google Meet (opcional) | Creación automática de salas |
| Tests | Vitest 5 + Testing Library + jsdom | 122 archivos |
| Lint | ESLint 10 + react-hooks + react-refresh | |

### 3.2 Dependencias notables

- `edmonds-blossom@1.0.0` está **vendorizado** en `src/features/matching/vendor/blossom.js` (648
  líneas, fork a ESM de Matt Krick, MIT) con su licencia. No hay tests directos del vendor, pero
  el algoritmo se contrasta contra un **oráculo de enumeración exhaustiva**.
- El SDK de AtomicMemory **no se usa**: arrastra `onnxruntime-node` + `sharp` (~277 MB, por
  encima del límite de 250 MB de Vercel) y 3 vulnerabilidades altas. Se llama por HTTP directo a
  dos endpoints (`/memories/ingest/quick`, `/memories/search/fast`).
- `@grpc/grpc-js` está forzado a `^1.14.0` con `overrides` (vulnerabilidad transitiva).

---

## 4. Arquitectura

### 4.1 Diagrama de alto nivel

```text
┌──────────────────────────────────────────────────────────────────────┐
│  NAVEGADOR  (proyecto Vercel raíz · auto-despliega en cada push)     │
│  React 19 · React Router 7 · Tailwind v4                            │
│                                                                      │
│  src/app/router.jsx ── ProtectedRoute ── DashboardLayout/AuthLayout  │
│  src/features/{auth,dashboard,assessments,matching,sessions,ai}      │
│  src/components/ui · src/shared/constants/contracts.js              │
│                                                                      │
│  Lee Firestore (onSnapshot) con reglas. Escribe: assessments vía API │
└───────────┬──────────────────────────────────┬───────────────────────┘
            │ fetch('/api/assessments')         │ fetch(SERVER_URL + ...)
            │ ruta RELATIVA                     │ ruta ABSOLUTA
            ▼                                   ▼
┌───────────────────────────────┐   ┌──────────────────────────────────┐
│ BACKEND A — raíz              │   │ BACKEND B — server/ (ko_eduko)    │
│ Vercel Functions               │   │ Vercel Functions · 9 endpoints   │
│ api/assessments.js            │   │                                  │
│ api/group-sessions.js         │   │ start-session-bot · recall-webhook│
│ api/assessments/              │   │ ask-tutor · close-session · tick  │
│   matching-profile.js         │   │ class-insights · my-summary      │
│                               │   │ google-connect · google-callback │
│ Lógica privada:               │   │                                  │
│ server/assessments/{          │   │ core/ = 30 módulos puros         │
│   domain,service,gradebook,   │   │ adapters/ = 8 adaptadores        │
│   groupSessions,selfEnroll}    │   │ http/ = handlers con DI          │
│ server/firebaseAdmin.js       │   │                                  │
└───────────────┬───────────────┘   └──────┬───────────┬───────────────┘
                │                           │           │
                └─────────┬─────────────────┘           │
                          ▼                             ▼
              ┌───────────────────────┐   ┌────────────────────────────┐
              │  Cloud Firestore      │   │  Servicios externos       │
              │  (plan Spark)         │   │  Recall.ai  (bot + STT)   │
              │  50k lecturas/día     │   │  Gemini      (redacta)    │
              │  20k escrituras/día   │   │  AtomicMemory (memoria)   │
              └───────────────────────┘   │  ElevenLabs  (voz, off)   │
                                         │  Google Meet API (opcional)│
                                         └────────────────────────────┘
```

### 4.2 El dato estructural más importante: **dos backends**

`server/` contiene **dos cosas independientes** que conviven en la misma carpeta y **nunca se
importan entre sí**:

| | Backend A | Backend B |
|---|-----------|-----------|
| **Carpeta** | `api/` (raíz) + `server/assessments/` + `server/firebaseAdmin.js` | `server/` (todo lo demás) |
| **Dominio** | Evaluaciones, publicación de salas | Sesiones en vivo, tutor, memoria |
| **Proyecto Vercel** | El de la raíz (frontend + functions) | `ko_eduko` (independiente) |
| **Despliegue** | `push` a `main` → automático | **Solo por CLI**: `cd server && npx vercel --prod` |
| **Variables** | `VITE_FIREBASE_*` + `FIREBASE_SERVICE_ACCOUNT_JSON` | 24 variables en `server/src/envManifest.js` |
| **Claves de terceros** | Ninguna | Recall, Gemini, AtomicMemory, ElevenLabs, Google |

**Por qué dos** (de `docs/ARCHITECTURE.md` §8): segregación de secretos. El navegador nunca ve
una clave de Gemini, Recall ni AtomicMemory. El costo: dos juegos de variables, `ALLOWED_ORIGINS`
que mantener, y una carpeta compartida que mezcla dos dominios sin relación.

**Consecuencia operativa**: `server/` **no está conectado a Git**. Un `push` no despliega el tutor.
Solo se despliega por CLI, que publica el directorio de trabajo (incluidos cambios sin commit).

### 4.3 Límites entre módulos del frontend

Regla declarada: **ningún módulo importa código interno de otro `feature/`**. Se verifica con grep
y no hay ciclos. Dependencias reales:

```text
auth      ──► assessments   (Register → joinDefaultCourse)
dashboard ──► assessments   (StudentsPage, TeacherDashboard, useStudentProgress*)
dashboard ──► sessions      (StudentDashboard → useSessions)
matching  ──► assessments   (MatchingClassroom → loadBootstrap)
matching  ──► sessions      (PublishGroupRooms → createRoomsFromMatching)
```

`sessions`, `ai`, `matching/algorithms` y `ui` **no importan ninguna otra feature**. El caso
`matching → sessions` está encapsulado en `PublishGroupRooms.jsx` (26 líneas), que es el único
puente.

**Patrón elegante:** `ActiveSessionPage` es un **componente de ruta con render-prop**. El router
compone `sessions` con `ai` sin que ninguna feature importe a la otra:

```jsx
<Route path="/sessions/active" element={wrap(
  <ActiveSessionPage render={(id) => <SessionDetailPage sessionId={id} />} />
)} />
```

### 4.4 Capas del backend de sesiones

```
api/*.js            9 bordes serverless.  ÚNICO sitio que lee process.env.
   │                20-30 líneas cada uno.
   ▼
src/http/*.js       Handlers con inyección de dependencias.
   │                CORS, respond, mapeo de errores. Probables sin Vercel.
   ▼
src/sessions/*.js   Orquestadores: startSessionBot, closeSession, tutor,
   │                afterLiveEventSaved, config, auth, errors, logger.
   ▼
src/sessions/core/  30 módulos PUROS. Sin reloj, sin red, sin Firebase.
   │                Testeable al 100%. Es el 60% del código del backend.
   ▼
src/sessions/adapters/  8 adaptadores: Recall, Gemini, ElevenLabs, GoogleMeet,
   │                    AtomicMemory, FirestoreMemory, Memory (compuesto), SessionStore.
   ▼
Firestore + servicios externos
```

Las fábricas `*Edge.js` (`geminiEdge`, `memoryEdge`, `liveAfterSave`) son el punto donde se conectan
las dependencias reales; `core/` nunca las ve.

### 4.5 15 rutas del frontend

| Ruta | Guard | Lazy | Componente |
|------|-------|------|-----------|
| `/login` `/register` `/forgot-password` | — | no | Auth pages |
| `/dashboard` | auth | no | `RoleRedirect` |
| `/dashboard/teacher` | auth | no | `TeacherDashboard` (450 L) |
| `/dashboard/student` | auth | no | `StudentDashboard` (97 L) |
| `/students` | teacher | no | `StudentsPage` |
| `/assessments` | ambos | sí | `AssessmentsPage` (281 L) |
| `/matching` | teacher | sí | `MatchingPage` (256 L) |
| `/matching/results` | teacher | sí | `MatchingResultsPage` |
| `/sessions` | ambos | sí | `SessionsPage` (205 L) |
| `/sessions/active` | ambos | sí | `ActiveSessionPage` (35 L) |
| `/sessions/active/tutor` | ambos | sí | → `TutorPage` |
| `/sessions/:sessionId` | ambos | sí | `SessionDetailPage` (215 L) |
| `/sessions/:sessionId/tutor` | ambos | sí | `TutorPage` (117 L) |
| `*` | — | — | `Navigate → /dashboard` |

**`ProtectedRoute`** (`src/app/ProtectedRoute.jsx`, 18 líneas) hace tres cosas: `loading` →
spinner; no autenticado → `/login` guardando `state.from`; rol no autorizado → `/dashboard`. Su
propio JSDoc admite que la **autoridad real está en `firestore.rules` y en los endpoints**, no ahí.

---

## 5. Modelo de datos

### 5.1 Colecciones

| Colección | Quién escribe | Quién lee | Notas |
|-----------|--------------|-----------|-------|
| `users` | Cliente (registro) | Cliente, servidor | Rol; **nunca se acepta del navegador** |
| `classrooms`, `students` | ADMIN / cliente | Cliente | |
| `assessments` | Backend A | Cliente, Backend A | Doc con `items[]` anidados |
| `assessmentModules/{courseId}/assignments` | Backend A | Servidor | Asignación estudiante↔pregunta↔respuesta |
| `knowledgeProfiles` | Backend A | Cliente | Mastery por destreza `[0,1]` |
| `matchingResults` | Cliente | Cliente | **Propuesta para revisión docente**, no se publica sola |
| `learningSessions` | Backend B | Cliente | Sala: `studentIds`, `meetingUrl`, `status`, `bot{}` |
| `learningSessions/{id}/live/state` | **Solo servidor** | **Nadie desde el navegador** | Estado incremental del motor |
| `learningSessions/{id}/live/view` | Solo servidor | Docente + alumnos de esa sala | Vista para la pantalla |
| `learningSessions/{id}/liveEvents` | Solo servidor | Docente + alumnos de esa sala | Transcripciones crudas |
| `learningSessions/{id}/private/answer` | Solo servidor | **Nadie desde el navegador** | **Respuesta esperada** |
| `learningSessions/{id}/private/context` | Solo servidor | Nadie | Roles guía/aprendiz |
| `learningSessions/{id}/agentInterventions` | Solo servidor | Docente + alumnos | id determinista (idempotencia) |
| `learningSessions/{id}/summary/final` | Solo servidor | **Solo docente** | Reporte de competencias |
| `studentProfiles/{clave}` | Solo servidor | Solo servidor | Perfil de aprendizaje |
| `teacherInsights/{uid}` | Solo servidor | Solo servidor | Acumulado por docente |
| `teacherIntegrations/{uid}` | Solo servidor | Solo servidor | Refresh token de Google |
| `tutorInteractions` | Backend B | Docente | Pistas bajo demanda |

### 5.2 La invariante central: `private/answer`

```
learningSessions/{id}/currentProblem   →  { activityId, skillId, text }   ← SOLO el enunciado
learningSessions/{id}/private/answer   →  { expectedAnswer }              ← la respuesta
```

Los estudiantes leen el documento de la sesión. Por eso la respuesta esperada vive **fuera**, en un
subdocumento que `firestore.rules` bloquea a todo cliente. Esto cuesta:

- **+1 lectura** la primera vez que el motor evalúa un problema.
- Una **migración** para sesiones antiguas que tenían la respuesta dentro.
- Los clientes que muestran la respuesta (corrección del examen, `ResultsPanel`) **nunca la leen
  aquí**: vienen del backend de evaluaciones, que sí puede.

`SessionDetailPage.jsx:63-64` tiene el comentario que lo recuerda: *"solo el enunciado"*.

### 5.3 `firestore.rules`

5912 bytes. Puntos clave:

- Lectura de sesión en vivo (`liveEvents`, `live/view`, `agentInterventions`): solo el docente o un
  estudiante **de esa sesión**.
- `write: false` para todos los clientes en las subcolecciones de la sesión.
- `live/state` y `private/answer`: ningún cliente.
- `summary/final`: solo el docente.

Nota: las reglas que usan `get()` suman **lecturas por cada consulta de la interfaz**, lo que consume
la cuota diaria.

---

## 6. Los flujos de negocio

### 6.1 Flujo completo de extremo a extremo

```text
1. REGISTRO     El alumno se registra → role: 'student' hardcodeado
                → joinDefaultCourse() → onboarding automático
                    ↓
2. DOCENTE      Crea curso y aula → agrega estudiantes
                    ↓
3. DOCENTE      Crea evaluación (wizard de 4 pasos) → la publica
                    ↓
4. ALUMNO      Intenta la evaluación → respuestas en Firestore
                    ↓
5. SERVIDOR A   Calcula mastery por destreza → knowledgeProfiles
                    ↓
6. DOCENTE      Elige la evaluación finalizada → Emparejar
                    ↓
7. ALGORITMO   Blossom + enumeración de tríos → PROPUESTA
                    ↓
8. DOCENTE      Revisa → "Crear salas desde resultados"
                    ↓
9. SALAS       Se crean learningSessions desde el matching
                    ↓
10. DOCENTE    Registra el enlace de Meet  ← ÚNICO PASO MANUAL OBLIGATORIO
                    ↓
11. Clic       "Entrar" → POST /api/start-session-bot
                    → crea el bot en Recall
                    ↓
12. HUMANO     Alguien ADMITE el bot en Meet  ← PASO MANUAL
                    ↓
13. EN VIVO    ~2,5 eventos/s → motor de reglas → Gemini redacta
                    → chat de Meet + pantalla del docente
                    → heartbeat cada 20 s cubre el silencio
                    ↓
14. CIERRE     Se va el último humano (o clic en "Cerrar")
                    → bot sale → reporte de competencias → memoria por estudiante
                    → perfil de aprendizaje actualizado
                    ↓
15. DOCENTE    Lee evidencia formativa (nunca una nota)
                    → insights acumulados de todas sus salas
                    ↓
16. ALUMNO     Lee su devolución (solo suya, sin notas)
```

### 6.2 Separación de responsabilidades del agente

Esta tabla de `docs/SESSIONS_AGENT.md` es el corazón conceptual del módulo:

| Decisión | La toma | Por qué |
|----------|---------|---------|
| **Si interviene, a quién y por qué** | Reglas deterministas (`core/signals.js`) | Auditable, testeable, sin costo por evento |
| **Cuándo no volver a hablar** | Reglas (cooldown de 60 s por señal) | Un tutor que interrumpe siempre molesta más de lo que ayuda |
| **Las palabras del mensaje** | **Gemini** | Lo único para lo que se necesita un LLM |
| **Si el mensaje es aceptable** | Reglas (`core/interventionPolicy.js`) | Gemini no tiene la última palabra |
| **El estado de cada capacidad** | Reglas (`core/competencyEvidence.js`) | Gemini solo etiqueta y su etiqueta nunca basta para «con evidencia» |
| **La calificación** | **El docente** | El sistema no asigna notas, ni AD/A/B/C |

> **Las reglas deciden, el LLM solo redacta.** Es la decisión arquitectónica más importante del
> proyecto y la que hace que todo el módulo sea testeable sin servicios reales.

---

## 7. Módulo 1 · Evaluaciones

### 7.1 Arquitectura

**Toda la lógica vive en el backend A.** El cliente es un *command bus*: un solo endpoint con una
acción y un payload.

```text
frontend  ──POST /api/assessments { action, payload }──►  api/assessments.js
                                                            │
                                              verifyIdToken(token, true)
                                                            │
                                          createAssessmentService(db)(uid, action, payload)
                                                            │
                                                        service.js
                                                            │
                                        ┌───────────────────┼───────────────────┐
                                     domain.js         gradebook.js        selfEnroll
                                  (validación)      (calificación)     (inscripción)
```

Acciones: `bootstrap`, `save`, `publish`, `close`, `finalize`, `results`, `start`, `submit`, `review`,
`grades`, `selfEnroll`, `regrade`.

### 7.2 El editor (`AssessmentEditor.jsx`, 905 líneas)

El segundo archivo más grande del proyecto. Wizard de 4 pasos:

| Paso | Contenido |
|------|-----------|
| A | Título, descripción, curso, área, competencia, tipo, escala, ponderación, fechas |
| B | Puntaje, tiempo e intentos, feedback, estudiantes asignados |
| C | Preguntas (hasta 60) |
| D | Revisión |

Mecánicas complejas:

- **Paneles ocultos, no desmontados**: `hidden={step !== n}` (líneas 403, 501, 684, 755). Los 60
  `QuestionEditor` quedan montados. Estado preservado, pero DOM pesado.
- **Guarda de salida**: `baseline = JSON.stringify(form)` → `dirty` → `beforeunload` +
  `confirmDestructive`. El editor pide confirmación si hay cambios sin guardar.
- **`exitRef` con `useEffect` sin array de dependencias** (271-277), deliberado: re-registra en
  cada render para cerrar sobre `leaveEditor` fresca. Correcto pero frágil.
- **`focusFirstError`**: salta al paso del primer error y hace `focus()` +
  `scrollIntoView()` vía `requestAnimationFrame`.
- **`serverErrorField`**: mapea el mensaje de error del servidor a un campo con **regex sobre el
  texto** (`/nombre/i` → `title`, `/área/i` → `areaId`). Acoplamiento frágil al idioma del backend.
- **`academicWeightPercent` siempre se envía como `null`** (líneas 58 y 197): la ponderación
  académica se valida pero **no es editable** desde el editor.

### 7.3 La validación duplicada

`src/features/assessments/utils/validation.js` (311 líneas) y `server/assessments/domain.js`
implementan **las mismas reglas** en cliente y servidor. Defensa en profundidad correcta, pero
~300 líneas duplicadas de reglas de negocio que pueden divergir.

Reglas del validador:

| Regla | Detalle |
|-------|---------|
| Longitudes | título 200, descripción 3000, enunciado 2000, opción 500, explicación 2000 |
| Curso | `areaId ∈ course.areas`, `competencyId ∈ course.competencies`, `studentIds ⊆ course.students` |
| Tipo | `diagnostic \| exam \| practice \| homework` |
| Escala | `20 \| 100` |
| Ponderación | `(0, 100]` |
| Fechas | `startsAt < endsAt`; al publicar `endsAt > now` |
| Duración | entero 1–1440 (o `0` en assessments legados) |
| Intentos | 1–10 |
| `maxScore` | entero 1..`scale` |
| Feedback | `none \| after_submit \| after_close \| immediate`; `immediate` solo en `practice` |
| ≤ 60 preguntas, sin `questionId` duplicado, sin enunciado normalizado duplicado |
| Opciones | 2–6, sin duplicados normalizados |
| `true_false` | fuerza `['Verdadero','Falso']` exacto |
| **Al publicar** | Σ `maxScore` de preguntas **debe igualar** `maxScore` de la evaluación |

**Detección de preguntas similares** (`findSimilarQuestions`, líneas 15-41): **índice de Jaccard**
sobre tokens con regex Unicode `/[\p{L}\p{N}]+/gu`, umbral `0.8`, exige ≥3 tokens por enunciado.
Complejidad O(n²·tokens) — con tope de 60 es asumible. Al publicar con preguntas similares, pide
confirmación.

### 7.4 El intento del estudiante (`StudentAttempt.jsx`, 509 líneas)

El componente más complejo del módulo. Cinco mecanismos no triviales:

**a) Reloj monótono anti-trampas** (94-132)
```js
serverTimeAnchor = initial.serverNow ?? attempt.startedAt ?? expiresAt
// avanza con performance.now() cada 250 ms
```
No usa `Date.now()` en el bucle. Un reloj del sistema manipulado no alarga el examen.

**b) Guardado automático con cola** (152-226)
```js
persistLatest(answers):
  1. savePromise  → si hay un guardado en vuelo, espera
  2. queuedSave   → coalesce respuestas
  3. do…while     → reintenta si la respuesta cambió durante el vuelo
  4. revisionRef  → control de concurrencia optimista
```
`saveStatus ∈ {saved, saving, expired, error}`.

**c) Restauración desde `sessionStorage`**
Clave `koeduko-assessment:{studentId}:{assessment.id}:{attempt.id}`. Restaura solo si coincide
`revision` y valida que cada índice esté en rango.

**d) Accesibilidad real**
- `role="timer"` con `aria-live` para el reloj.
- `<progress>` nativo con `aria-valuetext`.
- Avisos `sr-only role="status" aria-live="polite"`.

**e) Botón «Salir (puedes retomar dentro del plazo)»** — el examen se guarda, no se pierde.

### 7.5 La matriz de resultados (`ResultsPanel.jsx`)

Tabla estudiante × destreza con `mastery × 100`, `score/maxScore`, `evidenceCount` y `<meter>`.

**Riesgo real:** la **nota académica se calcula en el cliente** (línea 138:
`(overallScore / maxScore) * 20`). El servidor también la calcula. Si divergen, la pantalla miente.

`GradeHistoryPanel.jsx` maneja además promedios por área con dos métodos (`weighted` o promedio
aritmético) y un estado `configurationError` cuando las ponderaciones están mal configuradas.

### 7.6 Contradicción de contrato detectada

`src/features/assessments/utils/forms.js:1` define:
```js
statusLabels = { draft, published, closed, finalized }
```
pero `src/shared/constants/contracts.js:19-23` (`ASSESSMENT_STATUS`) solo define `draft`,
`published`, `closed`. El frontend usa un estado que el contrato no declara.

---

## 8. Módulo 2 · Emparejamiento

> La parte más rigurosa del proyecto. Incluye la **única verificación formal de correctitud**:
> un oráculo de enumeración exhaustiva que contrasta el blossom.

### 8.1 El problema exacto

Dado un conjunto de estudiantes con mastery por 6 destrezas (`[0,1]`), formar **grupos de 2 o 3**
(con **como máximo un trío**) que maximicen la **oportunidad de apoyo entre pares por habilidad**,
respetando parejas prohibidas, de forma **exacta y reproducible**.

Restricciones duras:

- Grupos de tamaño 2 o 3.
- **Máximo 1 trío.** Validado: `trios <= 1 && trios === ids.length % 2`.
- ≤ 40 estudiantes.
- **Nunca se imputa un 0**: la ausencia de evidencia es un error, no un cero.
- El resultado **no se publica automáticamente**: es una propuesta para revisión docente.

### 8.2 La función de utilidad

Para cada *learner* `i` y cada *skill* `k` del foco de la actividad:

1. **Helpers elegibles** = compañeros con `skill ≥ 0.75` **y** `skill − learnerSkill ≥ 0.25`.
2. Se toma **solo el mejor helper** por habilidad (`helpers[0]`) → evita doble conteo.
3. Aporte:
   ```
   u_i = Σ_k  (1 − mastery_i,k) × (skill_j,k − mastery_i,k) / K
   ```
   donde `K = activity.skillIds.length`. El peso de cada habilidad **decrece** con el tamaño del
   foco; vale más cuanto más le falta al learner y mayor la brecha.
4. **Utilidad del grupo**:
   ```
   Q_G = Σ_i u_i  +  |G| · min_i(u_i)
   ```
   El segundo término **premia explícitamente repartir el apoyo**: un grupo donde el más débil
   también se beneficia vale más que uno donde solo uno se beneficia.

**Por qué no coseno similarities:** `[0.9,0.9]` y `[0.3,0.3]` tienen coseno 1, pero no hay
oportunidad de apoyo en ninguno de los dos casos. Documentado en
`src/features/matching/data/matchingEvidence.js`.

**Aritmética de punto fijo**: `utilityInteger = round(Q_G × 10⁶)` para que blossom compare enteros sin pérdida
de coma flotante.

### 8.3 El algoritmo (`matchingAlgorithm.js`, 226 líneas)

```text
1. Resolver skillIds, validar perfiles, ordenar por studentId
2. Construir Set de ids y de parejas prohibidas (normalizado: key = JSON.stringify([a,b].sort()))
3. solvePairs(índices):
     aristas [i,j,objective] de todas las parejas válidas
     blossom(edges, maxCardinality=true)   ← MATCHING DE PESO MÁXIMO
     si alguien queda sin pareja → return null (NO devuelve matching parcial)
4. Si N es par:   solvePairs(todos)
   Si N es impar: doble/triple bucle sobre TODOS los tríos permitidos:
                     rest = solvePairs(resto)
                     if (!rest) continue        ← solo tríos donde el resto es emparejable
                     if (weight > best.weight) best = {trio, rest}
7. best == null → 'infeasible'
```

**Jerarquía lexicográfica del objetivo:**
```js
primaryMultiplier = 2 · N · 10⁶ + 1
objective(grupo) = supportedStudentCount · primaryMultiplier + utilityInteger
```
→ **Un estudiante más con apoyo DOMINA cualquier variación de utilidad.** Es una decisión de
producto codificada en una multiplicador.

**Complejidad:** O(n²) para el análisis de parejas (memoizado) + O(n³) para tríos (con el blossom
dentro). Con 39 estudiantes impar hay ~9 139 tríos candidatos → por eso va en un **Web Worker**.

### 8.4 El vendor: `blossom.js` (648 líneas)

`edmonds-blossom@1.0.0` (Matt Krick, MIT) forkizado a ESM. Implementa el algoritmo de Edmonds:
`scanBlossom`, `augmentMatching`, `addBlossom`, `labels1/2`.

- `/* eslint-disable */` en la línea 1.
- Muchos `console.*` comentados.
- `var`, arrays 2D aplanados, sin punto y coma consistente. **Legibilidad pobre a propósito:**
  no debe modificarse.
- Cambio documentado en `vendor/README.md`: se declararon las variables `b`, `path` y `v` que el
  original dejaba globales (ESM exige modo estricto).

### 8.5 La verificación de correctitud

`matchingAlgorithm.test.js` contrasta el blossom contra un **oráculo de enumeración exhaustiva**
(`exhaustiveBest`) para n ∈ {4,5,6,7} × 3 escenarios, y para subconjuntos de habilidades.

Es **la mejor evidencia de correctitud del proyecto**: no basta con que el código corra, se
comprueba que produce el óptimo global.

### 8.6 Las 5 capas de servicios

```text
normalizeAssessmentResults.js (82)   ← adapta el paquete "AssessmentResults 1.0" del servidor
   │   • schemaVersion === '1.0', status === 'finalized'
   │   • competencyId === 'resuelve-problemas-cantidad'
   │   • alias ES/EN de destrezas (adicion→addition, fracciones→fraction…)
   │   • evidenceCount === 0 → la habilidad NO se incluye
   │   • mastery ≠ score/maxScore → warning, se conserva el mastery
   │   • COBERTURA COMÚN a todo el aula (evita premiar la ausencia de datos)
   ▼
matchingService.js (101)             ← fachada pública; clasifica source
   │                                   (simulated / assessment_scores / provided_scores)
   │                                 inputScorePolicy con metadatos auto-explicativos
   │                                 sin habilidades comunes → NO ejecuta el optimizador
   ▼
assessmentMatching.js (156)          ← informe de auditoría "assessment-grouping-json-v1"
   │   • 5 checks automáticos: validRequiredScores, uniqueMembership,
   │     allStudentsAccountedFor, validGroupSizes, forbiddenPairsRespected
   │   • proposedMode: deepening | reciprocal_peer_support |
   │     directed_peer_support | no_detected_peer_support
   │   • rolesArePermanent: false (rotan)
   ▼
matchingAlgorithm.js (226)           ← el optimizador
   ▼
matchingResultStorage.js (52)        ← sessionStorage con validación al recuperar
```

### 8.7 La evidencia metodológica en código

`src/features/matching/data/matchingEvidence.js` (66 líneas) es un documento de revisión en forma
de código:

- **6 referencias** con DOI, `supports` y `limitation` (Edmonds 1965, Lechuga & Doroudi 2022,
  Alegre et al. 2019, Fuchs et al. 1998, Wu/Zhang/Wang 2023, Fuchs et al. 2015).
- **`excludedPredictors`**: `displayName`, `studentId`, `grade`,
  `personality_inferred_from_scores`, `unobserved_social_traits`. Explícito sobre lo que el
  algoritmo **no** usa y por qué.
- **`weightStatus: 'design_hypothesis_not_fitted_or_educationally_validated'`** — los pesos no se
  ajustaron a datos reales.
- **`VARIABLE_FEEDBACK`**: qué falta del modelo (lectura, colaboración, rasgos interpersonales,
  progreso).

### 8.8 El Web Worker

```js
// workers/matching.worker.js — 9 líneas
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: createMatchingResult(data.profiles, data.options) }) }
  catch (e) { self.postMessage({ error: e.message }) }
}
```

`useMatchingPreview.js` gestiona el ciclo de vida con una sutileza importante: guarda el worker
activo en un ref y, al recibir respuesta, **ignora las de workers antiguos**
(`if (activeWorker.current !== worker) return`). Sin esto, una segunda generación rápida podría ser
sobrescrita por la primera.

---

## 9. Módulo 3 · Sesiones en vivo y tutor IA

> El módulo más complejo: 9 endpoints, 30 módulos core puros, 8 adaptadores, 977 tests. Es donde
> vive casi toda la complejidad del proyecto.

### 9.1 Los 9 endpoints

| # | Método + ruta | Auth | Rol |
|---|---------------|------|-----|
| 1 | `POST /api/start-session-bot` | Bearer + `requireSessionMember` | Docente **o** integrante de la sala |
| 2 | `POST /api/recall-webhook?token=` | `?token=` en **tiempo constante** | Recall |
| 3 | `POST /api/tick` | Bearer **o** `x-tick-secret` | Miembro o cron |
| 4 | `POST /api/ask-tutor` | Bearer + `requireSessionMember` | Docente o alumno de la sala |
| 5 | `POST /api/close-session` | Bearer | **Solo docente** |
| 6 | `POST /api/class-insights` | Bearer | **Solo docente** |
| 7 | `POST /api/my-summary` | Bearer | **Solo alumno de esa sala** |
| 8 | `POST /api/google-connect` | Bearer | **Solo docente** |
| 9 | `GET /api/google-callback` | `state` firmado HMAC | Navegación (sin Bearer, sin CORS) |

### 9.2 El pipeline completo

```text
DOCENTE/ALUMNO  POST /api/start-session-bot
   ├─ ensureMeeting ──► Google Meet API (si el docente conectó Google)
   ├─ claimBot  (transacción: anti-duplicado + reset de live/state con epoch)
   ├─ ensureProblem ──► problemBank (si la sala nació sin problema)
   ├─ ensureContext ──► roles guía/aprendiz desde el diagnóstico
   └─ Recall POST /bot/ ──► bot "Tutor KoEduko", deepgram nova-3 es
                                  │
        [HUMANO ADMITE EL BOT EN MEET — paso manual]
                                  ▼
POST /api/recall-webhook?token=   ~2,5 eventos/s
   ├─ handleRecallWebhook: token constante → normalizeRecallEvent → 200
   ├─ store.processLiveEvent  (1 transacción)
   │    ├─ 1 lectura live/state → ingestEvent (liveState.applyEvent)
   │    ├─ si toca evaluar (≥5 s de sesión):
   │    │    ├─ +1 lectura de la sesión
   │    │    ├─ +1 lectura de private/answer (una vez por problema)
   │    │    ├─ evaluateDue → detectSignalsFromState → selectInterventions
   │    │    └─ si no hubo señal y toca → judge: true (observador)
   │    └─ escrituras: state, live/view (al evaluar), liveEvents (salvo speech_on/off)
   └─ waitUntil → afterLiveEventSaved
        ├─ sin señal → judgeConversation (Gemini, JSON) → validar → crear/entregar
        ├─ con señal → recall de memoria ∥ learnFromProfile ∥ rolesLineFor
        │              → composeIntervention (Gemini + política + respaldo)
        │              → createIntervention (id determinista)
        │              → deliver (chat + voz en paralelo) → setDeliveredTo
        └─ closeNow / roomEmpty → autoClose

POST /api/tick  (pantalla cada ~20 s, o cron con x-tick-secret)
   └─ processTick: tickPlan(ancla) → evaluateDue con GROUP_SILENCE encendido
```

### 9.3 `recallEvents.js` — normalización (102 líneas, puro)

Mapea 5 eventos de Recall a 5 tipos internos. Validación y **id determinista**:

```
eventId = evt-<type>p<participantId>t<ms>e<ms>
```

Esto hace el webhook **idempotente ante reenvío**. Devuelve `null` (se ignora) si: el tipo no se
usa, el `sessionId` no es válido, no hay texto o no hay tiempo finito.

### 9.4 `liveState.js` — el reductor (175 líneas, puro)

Estado inmutable, `applyEvent(state, event, cfg)` devuelve un estado nuevo **o el mismo objeto** si
nada cambió (esa identidad se usa para no escribir).

| Decisión | Detalle |
|----------|---------|
| `TYPE_ORDER` | Desempata del mismo instante: join(0) → speech_off(1) → speech_on(2) → transcript(3) → leave(4) |
| `speech_on/off` | Es **hablante activo**, no micrófono. El `speech_on` de otra persona cierra el intervalo anterior |
| `closeSpeaker` | Suma a `totals` (segundos + turnos) y empuja el intervalo |
| Poda | `intervals` a la ventana y a `maxIntervals=400`; `transcripts` a las últimas 20 |
| Dedup | Por `event.id` |
| Filtro | `botKeys = ['tutor koeduko']` |
| Listas | Arrays, **no mapas**, para que un nombre raro no se vuelva clave de campo en Firestore |

**Reloj monótono**: un transcript con `tEnd` atrasado **no hace retroceder** `lastT`.

### 9.5 `signals.js` — el motor de reglas (274 líneas, puro)

`DEFAULT_CONFIG` (líneas 24-40):

| Parámetro | Valor | Significado |
|-----------|-------|-------------|
| `windowSec` | 180 | Ventana de 3 minutos |
| `minSpeechInWindowSec` | 45 | Sin esto no se evalúa dominancia/silencio |
| `dominanceRatio` | 0.70 | Uno habla ≥70% |
| `silentPeerRatio` | 0.15 | Alguien habla ≤15% |
| `minPresenceSec` | 30 | Alguien debe llevar 30 s en la sala |
| `groupSilenceSec` | 40 | Silencio del grupo |
| `stuckMarkersMin` | 2 | Marcadores de confusión |
| **`cooldownSec`** | **60** | No repetir la misma señal al mismo destinatario |
| `evalEverySec` | 5 | Evaluación máxima |
| `disabledSignals` | `['GROUP_SILENCE']` | Apagada en el webhook (se enciende con el latido) |

`SIGNAL_PRIORITY`:
```
WRONG_ANSWER > STUCK > SILENT_PEER > GROUP_SILENCE > DOMINANCE > CORRECT_ANSWER
```

#### La detección de respuestas: la pieza más sutil

`answerNumbersOf` (líneas 124-151) resuelve casos que parecen obvios y no lo son:

| Problema | Solución |
|----------|----------|
| «¿cuánto son seis por ocho?» es una **pregunta**, no una respuesta | `sentencesOf` parte por frase, marca las interrogativas y las descarta |
| «seis por ocho» **nombra una operación**, no responde | `namesOperation` → si nombra operación, se recalcula sobre `resultPartOf` (lo que va tras «es/son/=») |
| «cuarenta y» + «dos» (corte de transcripción) | `endsUnfinished` espera 5 s (`CONTINUATION_SEC`) o une con el siguiente. Sin esto daría 40 en vez de 42 |
| «un», «una» sueltos son artículos | `FILLERS` los filtra |
| «no se puede», «no se mueve» no son confusión | Guardas: `no se` solo cuenta al final de frase o seguido de cómo/qué/si |

Criterios de respuesta: (a) hay `=`; (b) verbo de respuesta pegado al número (≤2 palabras antes);
(c) la frase es casi solo el número.

### 9.6 `liveEngine.js` — la capa de decisión (111 líneas)

`evaluateDue` (líneas 67-96):

1. Si cambia el `activityId`, reinicia `problem.startedT`.
2. **Si no queda ninguna persona humana en la sala, el tutor no habla** — nadie lo oiría.
3. `detectSignalsFromState` → `selectInterventions` (máximo 1).
4. Anota la intervención en `interventions` para que el cooldown la recuerde.
5. **Si no hubo intervención y `judgeDue`**, marca `judge: true` — guardando `lastJudgeT` **en la
   escritura que ya se hace** (0 escrituras extra).

### 9.7 El observador de conversación (`conversationJudge.js`, 134 líneas)

Motivación documentada: las señales por reglas dependen de un problema con respuesta numérica. Una
sesión sin problema, o de otro tema, las dejaba mudas — **se vio con dos compañeros reales**
(`currentProblem: null`, el tutor nunca habló).

| | `JUDGE_CONFIG` | `SOLO_JUDGE_CONFIG` |
|---|---|---|
| Cada | 20 s | 12 s |
| Tras cualquier intervención | 35 s | 20 s |
| Palabras nuevas | 8 | 5 |

El modelo lee 12 frases y responde JSON con: hablar/callar, tipo (`confusion`, `atasco`,
`error-conceptual`, `fuera-de-tema`, `excluido`), destinatario y mensaje.

**`parseJudgeDecision` es el único punto de confianza**: si `speak: true`, el mensaje pasa por
`validateMessage` — **la misma política** que las intervenciones por reglas. Cualquier violación →
`speak: false`.

> **«Callar es lo normal.»** `speak: false` es la rama más común. Los logs registran solo códigos
> (`speak`, `why`, `ms`), nunca lo que dijeron.

### 9.8 `interventionPolicy.js` — la política (278 líneas)

El módulo más consultado del backend (6 dependientes). **8 reglas** sobre lo que Gemini devuelve:

| # | Regla | Rechaza |
|---|-------|---------|
| 1 | `empty` | vacío |
| 2 | `too-long` | > 220 caracteres |
| 3 | `format` | markdown, saltos de línea |
| 4 | `too-many-sentences` | > 2 oraciones |
| 5 | `no-question` | sin `?` |
| 6 | `missing-addressee` | no nombra al destinatario |
| 7 | `reveals-answer` | contiene el número, en dígitos o palabras |
| 8 | `off-topic` | fuera del problema |

**Defensa en profundidad sobre la respuesta:**
1. La respuesta esperada **nunca entra al prompt** (`buildInterventionPrompt` la omite). Razón
   documentada: *«un modelo no puede revelar lo que no sabe»*.
2. El texto generado se **rechaza** si la contiene, en dígitos o palabras (`revealsAnswer` +
   `extractNumbers`).

**Prompt injection:** lo que dijeron los niños y las notas de memoria van **entre «» como dato**,
nunca como instrucciones. `stripQuotes` los sanea.

**Prohibición de felicitar** (`SYSTEM_INSTRUCTION`): el prompt prohíbe evaluar y felicitar («lo
están haciendo bien») porque *«felicitar tras una respuesta la confirma o la desmiente sin
decirlo»*. Se descubrió probando con Gemini en vivo.

**`fallbackMessage`: 16 variantes deterministas** (señal × 1 persona vs grupo). Ejemplo real:

> «Estudiante B, ¡nos gustaría escucharte a ti también! ¿Nos cuentas con tus palabras qué han
> entendido sobre el problema que están conversando?»

Si Gemini falla, tarda > 6 s, no hay key o responde algo inválido, sale esto. **El tutor nunca queda
mudo.**

### 9.9 `tutor.js` — el mecanismo común (92 líneas)

```text
composeWithFallback:
  sin generador           → fallback, reason:'no-generator'
  generate() con timeout  → TutorTimeoutError → fallback, reason:'timeout'
  cleanMessage(raw)       → quita markdown, prefijos "Tutor:", comillas
  validateMessage(...)    → ok → { source:'gemini' }
                             ko → fallback, reason:'invalid:<motivo>'
```

### 9.10 La memoria (AtomicMemory) — dos momentos distintos

**Al redactar** (`afterLiveEventSaved.recallNotes`):

- Requiere `intervention.participantKey`; si no hay, `cache: 'off'`.
- Clave: `studentKeyOf({studentId, participantKey, scope})`:
  - uid de Firebase si está enlazado;
  - si no, `"<classroomId|createdBy>:<sha256(scope\0nombre)[0..16]>"` — **seudónimo, no anónimo**,
    y el scope va **dentro** del hash para que el mismo nombre en dos aulas dé claves distintas.
- **Cache en `live/state.memory.<clave>`**: una vez recordado, no se vuelve a llamar en la sesión.
- **Decisión fina documentada** (líneas 115-117): solo se cachea lo que **sí** se recordó, porque
  `recall` devuelve `[]` tanto si no hay memoria como si falla, y cachear ese `[]` le quitaría la
  memoria al resto de la sesión.
- **`memoryQueryOf` usa el mismo vocabulario que la nota** (búsqueda semántica). El comentario
  24-28 documenta el fallo real: buscar con el enunciado del problema no devolvía nada.

**Al cerrar** (`closeSession.js:131-159`):

Una oración factual por estudiante:
> «Sesión accept-001, multiplicación: comunicó 28% del tiempo; usó estrategia correcta; sin
> evidencia de argumentación.»

Sin transcripciones, sin citas, sin nombre, sin la respuesta. Tope 500 caracteres. Todo en
`Promise.all`; cada fallo se contabiliza en `steps.memory` y **nunca detiene el cierre**.

**Los tres adaptadores:**

| Archivo | Rol |
|---------|-----|
| `atomicMemory.js` (106 L) | Principal. HTTP directo. **Nunca lanza**: `reasonOf` → `timeout`/`network`/`http:<n>` |
| `firestoreMemory.js` (48 L) | Respaldo. `recall` **no busca por significado**: devuelve las `MAX_NOTES` más recientes |
| `memory.js` (32 L) | Compuesto: principal → si falla y el motivo no es `invalid`, respaldo |

Selección por env (`memoryEdge.js:17-29`):
```
MEMORY_ENABLED=false|0|off|no   → null (el tutor habla sin notas)
ATOMICMEMORY_API_URL + KEY      → primary=AtomicMemory, fallback=Firestore
sin ellas                       → primary=Firestore (sin respaldo)
```

**Detalle discovered en producción**: sin `content_class: 'summary'` el servicio devuelve
**HTTP 502**. Documentado en el docblock.

### 9.11 El latido (`heartbeat.js` + `useSessionHeartbeat`)

**El problema**: el motor solo despierta con eventos de Recall, y **el silencio no genera eventos**.
Si todos callan, nada se evalúa — ni `GROUP_SILENCE`, ni el observador.

**La solución**: cada evento real deja un **ancla** (tiempo de sesión + reloj real). `POST /api/tick`
calcula el elapsed y reevalúa:

```js
t = anchor.t + (now - anchor.wallMs) / 1000   // nunca retrocede
```

| Restricción | Valor |
|-------------|-------|
| `TICK_MIN_MS` | 15 s (una evaluación por sala, aunque haya 20 pantallas) |
| `TICK_MAX_IDLE_MS` | 10 min |
| Motivos de no correr | `no-anchor`, `throttled`, `idle` |
| Costo | 1 lectura si no toca; 2-3 lecturas y 2 escrituras si evalúa |

Lo llama **la pantalla de la sala** (cada ~20 s, pestaña visible) o un **cron externo** con
`x-tick-secret`. El frontend pausa con `document.visibilityState === 'hidden'` e ignora errores.

Con el latido se enciende `GROUP_SILENCE` (40 s sin que nadie hable, con ≥2 personas).

### 9.12 El cierre (`closeSession.js`, 211 líneas) — 6 pasos idempotentes

| # | Paso | Timeout | Si falla |
|---|------|---------|----------|
| 0 | Ya cerrada → devuelve el reporte guardado | — | `alreadyClosed: true` |
| 1 | `leaveBot(session.bot)` | 4 000 ms | `steps.leaveCall='failed:<motivo>'`, sigue |
| 2 | `getLiveState` + `getTranscripts` | — | **Firestore: detiene el cierre** |
| 3 | Resuelve problema y respuesta (cache → `private/answer` → legacy) | — | `expectedAnswer` undefined |
| 4 | Clasificador Gemini para frases dudosas | **16 000 ms** | `steps.classifier='failed'`, el reporte se queda con las reglas |
| 5 | `memory.remember` por estudiante (paralelo) | 4 000 ms | `steps.memory.failed++` |
| 5b | Aprendizaje: `getInterventions` → `outcomesOf` → perfil | 4 000 ms | `steps.learning='failed'` |
| 5c | `updateInsights(teacherUid, report)` | 4 000 ms | `steps.insights='failed'` |
| 6 | `saveClosure` (batch) | — | **Firestore: falla el cierre** |

> **Margen estrecho:** `vercel.json` da 30 s y los pasos 4 (16 s) + reintento (5 s) consumen ~21 s
> solo en clasificación.

### 9.13 El reporte de competencias (`competencyEvidence.js`, 238 líneas)

**Evidencia formativa. Nunca una nota.** Tres estados: `con evidencia` / `evidencia parcial` /
`sin evidencia suficiente`.

| Capacidad | Regla |
|-----------|-------|
| **Traduce** | `strongNeeded: 2`: ≥2 frases que nombren una operación con números → con evidencia. Si no: confusión al plantear + etiquetas del clasificador → **parcial** |
| **Comunica** | `share ≥ (1/n)·0.6` **y** `turns ≥ 3` |
| **Usa estrategias** | Las mismas reglas de respuesta del motor en vivo (`answerNumbersOf` + `expectedAnswer`) |
| **Argumenta** | `porque`/`ya que`/…, después de una respuesta y con números u operaciones |

- Hasta **2 citas textuales** de ≤120 caracteres con su minuto.
- `doubtfulSentences`: afirmaciones largas sin regla que las atrape (tope 6/estudiante, 20 totales).
- **Restricción clave**: la etiqueta de Gemini **solo sube de "sin evidencia" a "parcial"**, nunca a
  "con evidencia" (`labeledTranslate` entra como `weak`).

> Es conservador a propósito: muchas capacidades saldrán «sin evidencia suficiente» porque una
> reunión de pocos minutos y una transcripción automática no alcanzan para más.

### 9.14 El aprendizaje del tutor (`learning.js` + `interventionOutcome.js` + `studentProfile.js`)

**No es un modelo entrenado.** Es aprendizaje por conteos y memoria.

```text
1. ESTILO   Cada intervención se redacta con uno de tres estilos:
            'pregunta' (que explique con sus palabras)
            'pista'    (qué dato mirar)
            'paso'     (un solo paso concreto)

2. SELECCIÓN (learning.js)
            MIN_TRIES=2  → primero prueba cada estilo
            EXPLORE_RATE=0.15 → a veces explora otro
            DECAY=0.9  → lo viejo pesa menos
            rateOf → Laplace (suavizado)
            chooseStyle → explorar → azar → explotar

3. RESULTADO (interventionOutcome.js)
            Mira los 60 s posteriores a cada intervención:
            ¿dio la respuesta? ¿planteó la operación? ¿habló? ¿explicó?
            MIN_WORDS=6, EXPLAIN_WORDS=8
            Señales de grupo → 'unknown' (no se aprende de ellas)

4. PERFIL (studentProfiles/{clave})
            Conteos por habilidad, por señal y por estilo.
            clampCount + tope 10 000 (defensa contra documentos corruptos)
```

El perfil entra al prompt de la siguiente sesión: «suele participar poco…», «ha funcionado mejor el
estilo X».

**Honestidad del propio código**: `rateOf` es Laplace, `seededUnit` es FNV-1a determinista (el azar
sale de la semilla), y `docs/TESTING.md` dice: *«con una sesión los conteos son ruido, y el selector
explora a propósito»*.

### 9.15 Roles y contexto privado (`roles.js`)

```text
ROLE = { guia, aprendiz, par }   MIN_GAP = 0.15
```

Calculado por `mastery` del diagnóstico. Se guarda en `private/context` — **nunca visible para el
niño**; el prompt del Gemini prohíbe decir el nivel. `describeRoles` produce la línea de roles que
entra al prompt.

### 9.16 El banco de problemas (`problemBank.js`, 69 líneas)

6 constructores deterministas por habilidad (`addition`, `subtraction`, `multiplication`,
`division`, `fraction`, `estimation`) con rangos de 5.º-6.º de primaria.

```text
pickProblem({ skillIds, seed }) → { activityId, skillId, text, expectedAnswer }
```

Respuesta **siempre entera** y **nunca en el enunciado**. Reutiliza `seededUnit` de `learning.js`.

### 9.17 La entrega: chat + voz en paralelo

```js
deliver():
  Promise.all([ sendToChat(), speak() ])      // 4 s timeout cada uno
  deliveredTo = ['app', 'meet_chat'?, 'meet_voice'?]
  → UNA sola escritura (setDeliveredTo) si hubo >1 canal
```

- **Chat**: `POST /bot/{id}/send_chat_message/` con `{message, to:'everyone'}`.
- **Voz** (experimental, **apagada por defecto**): ElevenLabs `mp3_44100_64` (el plan gratuito no
  permite 192 kbps) + `eleven_flash_v2_5` (~75 ms). El docblock de `recall.sendAudio` advierte que
  **Google no recomienda `output_audio` para TTS dinámico**.

Solo se entrega si `createIntervention` devolvió `created: true` (un duplicado ya se entregó antes).

### 9.18 La unforeseen: un mp3 silencioso de 78 ms

`speak: true` inyecta un **mp3 silencioso generado byte a byte** (`silentMp3Base64`, líneas 72-78)
porque Recall exige `automatic_audio_output` para poder usar `output_audio` después.

### 9.19 El presupuesto de Firestore

Medido en producción con la sesión real reproducida (265 eventos, 0 reintentos):

| | Antes (todo crudo) | Ahora |
|---|---|---|
| Lecturas | 284 | **284** (1,07/evento) |
| Escrituras | 530 | **300** (1,13/evento) + 1 por intervención |
| Tiempo en servidor | 149 ms media | **115 ms** media (p95 162 ms) |

| Operación | Lecturas | Escrituras |
|-----------|----------|------------|
| `speech_on`/`speech_off` (87% del tráfico) | 1 | **1** (solo el estado) |
| Transcript, `join`, `leave` | 1 | 2 |
| Evento que toca evaluar (≤ cada 5 s) | 2 (+1 sesión) | igual |
| Evento repetido que no cambia nada | 1 | 0 o 1 |
| Intervención | 0 | 1 (id determinista) |

**Decisión de producto**: `speech_on`/`speech_off` **ya no se guardan crudos** en `liveEvents`. Se
pierde el registro crudo del habla; `fixtures/smoke-001.json` conserva el de la prueba real.

**La cuota es el límite**: escrituras 20 000 / 2,8 por s ≈ **118 minutos de sesión al día** (~111 con
la vista de pantalla).

**`live/view` existe por una razón concreta**: un `onSnapshot` sobre `live/state` cobra **1 lectura
por espectador por cambio**, y ese documento cambia ~2,5 veces por segundo. La vista pesa ~12 veces
menos por actualización que escucha.

### 9.20 Los 30 módulos core

| Grupo | Módulos |
|-------|---------|
| **Identidad/texto** | `ids`, `participants`, `text`, `studentKey`, `meetUrl`, `botRequest`, `protectAnswer`, `acceptanceSession` |
| **Eventos** | `recallEvents`, `recallPayload` (el inverso), `handleRecallWebhook`, `liveEngine`, `heartbeat` |
| **Números/lenguaje** | `spanishNumbers` (128 L, 0–1000 en palabras), `operations`, `text` |
| **Motor** | `liveState`, `signals`, `liveView`, `conversationJudge` |
| **Política** | `interventionPolicy` (278 L), `studentFeedback`, `competencyClassifier` |
| **Aprendizaje** | `learning`, `interventionOutcome`, `studentProfile` |
| **Competencias** | `competencies`, `competencyEvidence`, `classInsights`, `roles`, `problemBank` |
| **OAuth** | `googleOAuth` |

### 9.21 Adaptadores (8)

| Archivo | Líneas | Abstrae |
|---------|--------|---------|
| `recall.js` | 232 | `createBot`, `leaveCall`, `sendChatMessage`, `sendAudio`. **`fetchImpl` inyectable, no lee `process.env`** |
| `gemini.js` | 103 | Key en header `x-goog-api-key` (**nunca en la URL**), errores tipados |
| `elevenlabs.js` | 70 | TTS → mp3 base64. **Nunca lanza**: `{ok, status, code}` |
| `googleMeet.js` | 74 | `exchangeCode`, `refreshAccessToken`, `createSpace` |
| `atomicMemory.js` | 106 | 2 endpoints por HTTP |
| `firestoreMemory.js` | 48 | Respaldo en `students/{key}/memory` |
| `memory.js` | 32 | Compuesto primary+fallback |
| `sessionStore.js` | **524** | **Todo Firestore**: 30 métodos |

### 9.22 Configuración: `envManifest.js` (319 líneas)

**24 variables de servidor + 7 de frontend.** Es la fuente única de verdad. Un test
(`envManifest.test.js`, 11 tests) verifica:

- Toda variable `process.env.X` en `api/`, `src/` y `scripts/` **está en el manifiesto**.
- El manifiesto **no declara variables que nadie lee** (entradas muertas).
- Todo `import.meta.env.VITE_X` en `src/` está en el manifiesto.
- Toda credencial está marcada como secreta.
- `renderEnvExample` **nunca contiene un valor después de un `=`**.

**8 variables secretas**: `FIREBASE_SERVICE_ACCOUNT_B64`, `RECALL_API_KEY`,
`RECALL_WEBHOOK_TOKEN`, `GEMINI_API_KEY`, `ATOMICMEMORY_API_KEY`, `ELEVENLABS_API_KEY`,
`TICK_SECRET`, `GOOGLE_CLIENT_SECRET`.

**Semántica asimétrica de flags** (intencional y documentada): chat/memoria/judge se apagan con
`false|0|off|no` (default on); la **voz** se enciende con `true|1|on|yes` (default off).

---

## 10. Módulo 4 · Dashboard y gamificación

### 10.1 Los tres dashboards

| Página | Líneas | Contenido |
|--------|--------|-----------|
| `TeacherDashboard` | 450 | Métricas ilustradas con container queries, carrusel con scroll-snap, roster de estudiantes, atajos |
| `StudentDashboard` | 97 | **Versión reducida**: saludo, botón diagnóstico, lista de salas |
| `StudentsPage` | 100 | Directorio con progreso por destreza, badges de perfil |

`TeacherDashboard` usa un patrón de guarda de respuestas obsoletas:
```js
const roster = { uid, revision, data }
const current = roster?.uid === uid && roster?.revision === revision ? roster : null
```

### 10.2 Gamificación: **código muerto, completo y testeado**

`lib/gamification.js` (315 líneas, puro) implementa un sistema entero:

| Sistema | Detalle |
|---------|---------|
| **XP y niveles** | 300 XP/nivel, 40 por sesión, `level = floor(xp/300)+1` |
| **6 rangos** | Explorador(1) · Aprendiz(3) · Resolutor(5) · Experto(7) · Maestro(10) · Guardián del conocimiento(14) |
| **6 insignias** | `primer-paso`, `equilibrio`, `constancia`, `especialista`, `matematico-real`, `maestro` — cada una con `earned`, `hint` y `progress` |
| **4 misiones** | `diagnostico` (120 XT), `salas` (80), `debilidad` (150), `resultados` (60) |
| **SkillBoard** | 6 destrezas con 4 niveles visuales y gradiente de barra |

**7 componentes + 1 hook completos y testeados que ninguna pantalla usa**:

```
StudentHero.jsx (132)   StudentStats.jsx (77)   MissionCard.jsx (136)
SkillBoard.jsx (95)     BadgeShelf.jsx (86)     SessionShelf.jsx (115)
hooks/useStudentProgress.js (100)
```

`StudentDashboard` no usa nada de esto. La gamificación está **desconectada del producto**.

---

## 11. Sistema de diseño

### 11.1 Inventario

**18 primitivas** en `src/components/ui/`, agrupadas en `index.js`:

| Grupo | Componentes |
|-------|-------------|
| Superficies | `Button`, `Card`, `CardLink`, `Badge`, `ProgressBar`, `Icon`, `Logo` |
| Formularios | `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup` |
| Overlays | `Modal`, `ConfirmDialog` |
| Estados | `Spinner`, `Skeleton`, `SkeletonRow`, `LoadingAnimation`, `LoadingState`, `ErrorState`, `EmptyState`, `Alert` |
| Feedback | `ToastProvider`, `useToast` |
| Estructura | `PageHeader`, `Breadcrumbs`, `PageBody`, `Avatar`, `Tooltip` |
| **No en el barrel** | `ProgressRing.jsx` (120 L) — solo por ruta directa |

**35 iconos** SVG inline en `iconPaths.js` (navegación 8, acciones 17, estado 9, marca 1). `Icon`
con `title` es `role="img"`; sin `title` es `aria-hidden`.

### 11.2 Tokens (`tokens.js`, 151 líneas)

```js
palette = { forest:'#304744', brand:'#4CDB59', mint:'#E9F8EA', canvas:'#F8FAF6',
            white:'#FFFFFF', ink:'#263D48', stone:'#ABB1AB' }
```

> **Regla crítica de Tailwind v4:** sin config, Tailwind escanea clases **literales**. **Nunca
> interpolar** (`bg-[${color}]` no se genera). `palette` existe para estilos inline inevitables.

> **Contraste documentado:** `#4CDB59` **no alcanza AA como texto sobre blanco** — solo como fondo
> con texto `#263D48`.

### 11.3 La calidad del kit

El kit tiene detalles que los productos suelen omitir:

- **`Modal` con foco atrapado completo**: Tab cicla, Escape cierra, el foco vuelve al elemento
  origen, `body.overflow` bloqueado, `role="dialog" aria-modal`.
- **`Tooltip` con `aria-describedby`, no `title`**; en teclado se muestra inmediato.
- **`LoadingAnimation`** con video de marca y `onError` → fallback al icono, más
  `motion-reduce:hidden`.
- **`Logo variant="mark"`** recorta la cabeza del koala por CSS (`scale-[1.45]`) sin editar el
  archivo.
- **`Avatar`** con degradado determinista por hash del nombre (7 degradados).
- **Alias legacy** en `Badge.tone` (`slate`, `indigo`, `green`, `amber`, `red`) — deuda de
  compatibilidad.

### 11.4 Navegación (`layout-kit/navConfig.js`)

Fuente única con 8 ítems. `activeItemTo(pathname, items)` es el **único responsable** del indicador
activo, con dos reglas: coincidencia exacta respetando `matches[]`, y si no hay, prefijo más
específico.

`Sidebar` y `Navbar` usan el mismo resolvedor. `/dashboard` declara
`matches: ['/dashboard', '/dashboard/teacher', '/dashboard/student']` porque es un índice que
redirige por rol.

`Navbar.jsx` tiene un problema: su docblock describe título/usuario/avatar/logout, pero la
implementación actual **solo conserva el botón del menú** (28 líneas).

### 11.5 La deuda del sistema de diseño

A pesar del kit, **los colores están hardcodeados** en las features:

```jsx
// SessionsPage.jsx, SessionDetailPage.jsx, TutorPage.jsx, TeacherDashboard.jsx…
bg-[#2A7A35]  text-[#304744]  bg-[#E6EAE3]  bg-[#4CDB59]
```

`tokens.js` existe y el kit lo usa, pero las features lo evitan. Contradice la regla del propio
sistema de diseño.

---

## 12. Seguridad y datos de menores

### 12.1 El modelo de autoridad

```
┌────────────────────────────────────────────────────────────────┐
│  El navegador NUNCA es la autoridad.                           │
│                                                                │
│  UI (ProtectedRoute)  →  solo experiencia de usuario            │
│  firestore.rules       →  la barrera real de datos             │
│  Endpoints de server/ →  verifican ID token + leen el rol      │
│                        de users/{uid} en el servidor           │
└────────────────────────────────────────────────────────────────┘
```

- **El rol nunca se acepta del navegador.** El registro público siempre crea `role: 'student'`.
  La promoción la hace un admin directamente en Firestore (no existe endpoint para ello).
- Los endpoints **nunca confían en el rol que manda el cliente**: verifican el token y leen el rol
  del servidor.

### 12.2 El contrato HTTP del webhook

`handleRecallWebhook.js` implementa un contrato muy disciplined:

| Situación | Respuesta |
|-----------|-----------|
| Token incorrecto | **401** |
| Evento no normalizable | **200** |
| Firestore falla | **200** |
| Body malformado | **200** |
| El store no se puede construir | **200** |

> **Recall nunca reintenta en bucle.** Solo el fallo de autenticación merece un 401.

El token se compara en **tiempo constante**: `sha256` de ambos + `timingSafeEqual` (igualando
longitudes).

### 12.3 CORS

`src/http/cors.js` (62 líneas) — lista exacta, nunca `*`:

- `localhost:5173` **siempre** permitido, incluso con lista vacía.
- Origen desconocido en `OPTIONS` → 403 sin `Allow-Origin`; en request normal → pasa sin cabecera
  (el navegador bloquea la lectura).
- `parseAllowedOrigins` descarta `*`, rutas, `ftp:` y `javascript:`.

**Probado en producción**: 204 para el frontend, la preview, `edukolea.com`, `www.edukolea.com` y
`localhost:5173`; 403 para un origen ajeno, para uno que solo se le parece
(`edukolea.com.evil.example`) y para la variante `http://`.

### 12.4 El filtrado de errores

```js
// respond.js
expose:true  →  el mensaje va al body y al log   (solo los propios)
server-misconfigured → 500 con mensaje genérico fijo
cualquier otro → 500 { error:'internal', message:'Error interno.' }
```

Test explícito: un mensaje de librería filtrado por una excepción **nunca** llega al cliente.

### 12.5 El mapa de datos de menores

| Dato | Dónde | Quién lo lee |
|------|-------|--------------|
| Transcripciones (texto) | `liveEvents` | Docente + alumnos de esa sesión |
| Reparto de fala y últimas frases | `live/view` | Docente + alumnos de esa sesión |
| Estado interno del motor | `live/state` | **Nadie desde el navegador** |
| **Respuesta esperada** | `private/answer` | **Nadie desde el navegador** |
| Reporte de competencias | `summary/final` | **Solo el docente** |
| Una oración por estudiante | AtomicMemory (externo) / `students/{key}/memory` | **Solo el servidor** |

### 12.6 Las decisiones que **no** son del producto

`docs/SESSIONS_AGENT.md` §7 las lista explícitamente como **abiertas**:

1. Consentimiento de las familias para que un bot escuche y transcriba a menores.
2. Cuánto tiempo se conservan las transcripciones.
3. Si un servicio externo de memoria es aceptable para datos de menores.

> Hasta resolverlas, esto es un prototipo de demostración.

### 12.7 Los loggings correctos

| Se registra | **Nunca** se registra |
|-------------|----------------------|
| Códigos de error (`failed:http:429`) | El texto de una intervención (`LOG_INTERVENTION_TEXT` lo activa solo en depuración) |
| `speak`, `kind`, `why`, `ms` del observador | Lo que dijeron los niños |
| Nombres de variables faltantes | **Valores** de variables |
| `opsOf` (reads/writes/attempts/ms) | El `refreshToken` de Google |

`logger.js` pone `level` y `message` **al final** del objeto para que ningún dato los pise. El
comentario dice: *"ya pasó dos veces"*.

---

## 13. Testing

### 13.1 Números reales (medidos en `bbffbae`)

```text
Raíz:     52 archivos · 441 tests →  50 archivos / 440 tests en verde, 1 test fallando
Servidor: 69 archivos · 977 tests →  69 archivos / 977 tests en verde ✅
Lint:     0 errores
```

Líneas de prueba: **5 804** (frontend) + **9 105** (servidor) = **14 909**. Más de la mitad del
código de `server/` es prueba.

### 13.2 La convención que hace posible testearlo todo

**Cero `vi.mock` del sistema.** Todo por **inyección de dependencias**:

```js
createGeminiGenerator(env, { role, now, generateImpl, state })   // reloj y fetch inyectados
useLiveSession(sessionId, deps = REAL_FIRESTORE)                // Firestore falso inyectado
createSessionStore({ db, FieldValue })                          // doble de Firestore
InviteTutor({ invite = inviteTutor })                           // servicio inyectado
```

Además: `Date.now()` nunca se llama dentro de lógica pura (`timeAgo(createdMs, nowMs)` recibe el
"ahora" por parámetro), y los módulos `core/` **no importan nada** de `adapters/` ni de Firebase.

### 13.3 La suite más valiosa: `envManifest.test.js` (11 tests)

Verifica que ninguna variable de entorno se use sin declarar, que no haya entradas muertas, que
toda credencial esté marcada como secreta, y que `renderEnvExample` no filtre valores.

Es un test de **seguridad**, no de funcionalidad.

### 13.4 El oráculo del matching

`matchingAlgorithm.test.js` contrasta el blossom contra `exhaustiveBest` (enumeración exhaustiva)
para n ∈ {4,5,6,7} × 3 escenarios × subconjuntos de habilidades.

### 13.5 Los fixtures

| Fixture | Contenido |
|---------|-----------|
| `server/fixtures/smoke-001.json` (2943 L) | 265 eventos de una reunión real de Meet, 3 personas, ~110 s, anonimizada |
| `server/fixtures/smoke-002.json` (284 L) | 24 eventos: **primera conversación real de matemática** en Meet (un participante) |
| `src/features/matching/tests/fixtures/assessment-results-v1.json` | Paquete de resultados v1.0 |

`recallPayload.js` existe **para los tests**: es el inverso exacto del normalizador, y permite
round-trip (un test comprueba que los 265 eventos del fixture sobreviven al viaje de ida y vuelta).
`replaySignals` y `replayFixture.js` permiten reproducir una sesión sin Recall.

### 13.6 La tabla de honestidad (`docs/TESTING.md` §2)

`docs/TESTING.md` es probablemente el documento más valioso del repositorio. Mantiene una tabla de
~28 filas de **qué se probó, con qué datos y qué resultado**, incluyendo:

- Fechas reales (17-oct-2026, 18-oct-2026).
- Sesiones concretas (`accept-001`, `accept-live-1`…`accept-tick-2`).
- Fallos reales encontrados y corregidos (`cuarenta y | dos` leído como 40;
  `api_key_id_used_as_api_key`; un punto de más en la redirección de Google; reusar una sala con
  bot nuevo dejaba el motor sin evaluar).
- Distinción explícita entre lo que **el servidor verificó** y lo que **solo quien estaba en la
  reunión puede confirmar**.

Y una sección §3 de lo que **NO** se probó:

| Qué falta | Por qué importa |
|-----------|-----------------|
| Conversación de matemática real entre **dos o más** estudiantes | `smoke-002` tiene un participante: `SILENT_PEER` y `DOMINANCE` (necesitan ≥2) sin ejercitar |
| Que el mensaje llegue al **chat de Meet** | El servidor no ve el chat |
| El reporte con una conversación real | Nunca se generó |
| Que la memoria **cambie** lo que dice el tutor | El ciclo funciona; no se midió una diferencia atribuible |
| `WRONG_ANSWER` en vivo | Nunca se dio una respuesta equivocada real |
| Calidad pedagógica con niños | No se evaluó con ningún niño |
| Reglas de Firestore con el emulador | No hay Java en la máquina; se probó contra producción con un solo rol |
| La pantalla como estudiante | No se probó con cuenta de estudiante |
| Seguridad de las reglas frente a un estudiante malicioso | **Las reglas están escritas para impedirlo, pero no se atacaron** |
| Carga y el tope diario de Firestore | El límite de 118 min es una estimación |

### 13.7 La convención de nombres de describe

Los `describe` describen **comportamiento**, no nombres de función:

```js
describe('el reporte no toma como "dificultad" una frase que además responde', ...)
describe('never shows a grade (AD / A / B / C)', ...)
describe('ignora un texto que nombra a un niño si LOG_INTERVENTION_TEXT no está', ...)
```

---

## 14. Complejidad

### 14.1 Mapa de complejidad por módulo

| Módulo | LOC prod | LOC test | Complejidad | Tipo |
|--------|----------|----------|-------------|------|
| **Sesiones backend** | ~6 900 | **9 105** | **Muy alta** | Distribuida, asíncrona, con cuota |
| **Matching** | ~2 400 | ~2 600 | **Alta** | Algorítmica, combinatoria |
| **Evaluaciones** | ~2 900 | ~1 800 | Media-alta | Formularios, validación, máquina de estados |
| **Frontend core** (router, auth, layout, ui, shared) | ~5 200 | ~800 | Media | UI, estado, accesibilidad |
| **Dashboard** | ~1 300 | ~600 | Baja-media | presentación |
| **Sistema de diseño** | ~1 900 | ~400 | Baja-media | primitivas |
| **Infra** (api raíz, scripts, config) | ~800 | ~400 | Media | bordes |

### 14.2 Los 10 puntos más complejos del proyecto

**1. El motor de señales (`signals.js`, 274 líneas)**
Determinar si un niño está atascado leyendo transcripciones automáticas en español. Cada regla
tiene casos borde que solo aparecieron en producción: cortes de número (`cuarenta y | dos`),
preguntas que parecen respuestas (`¿cuánto son seis por ocho?`), operaciones nombradas que parecen
resultados, fillers que parecen palabras de respuesta.

**2. El emparejamiento combinatorio (`matchingAlgorithm.js` + `blossom.js`)**
Matching de peso máximo exacto + enumeración O(n³) de tríos + jerarquía lexicográfica del objetivo +
normalización de parejas prohibidas + determinismo byte-a-byte.

**3. El presupuesto de Firestore**
Obligó a un modelo de estado incremental, un documento de vista separado, podas agresivas, decisiones
de qué eventos guardar crudos, y un `epoch` al reclamar un bot nuevo. Es una restricción que se
siente en cada `sessionStore`.

**4. `interventionPolicy.js` (278 líneas)**
Ocho reglas sobre texto generado por un LLM, con defensa en profundidad contra la respuesta
esperada, contra prompt injection, y 16 variantes de respaldo deterministas.

**5. `StudentAttempt.jsx` (509 líneas)**
Reloj monótono anti-trampas, cola de guardado automático con reintento, control de concurrencia
optimista, restauración desde `sessionStorage`, accesibilidad de temporizador.

**6. `sessionStore.js` (524 líneas, 30 métodos)**
Todo Firestore del módulo de sesiones en una clase, con transacciones, `FieldValue`, y rutas que
cruzan colecciones (`ensureContext` lee N asignaciones).

**7. El cierre de sesión (6 pasos, cada uno con su timeout y su respaldo)**
Debe ser idempotente, nunca romperse por un servicio externo, reportar qué falló, y guardar todo en
un solo batch al final.

**8. La memoria y el perfil de aprendizaje**
Tres adaptadores, una clave seudónima con hash, un cache con una semántica de fallo muy sutil
(`recall` devuelve `[]` tanto si no hay memoria como si falla), y un selector de estilos con
exploración, decaimiento y suavizado de Laplace.

**9. La normalización de la transcripción**
`recallEvents` (entrante) y `recallPayload` (inverso, solo para tests) deben ser simétricos. El
round-trip de los 265 eventos del fixture es un test.

**10. El doble proyecto Vercel**
Dos juegos de variables, `ALLOWED_ORIGINS` que mantener, `server/` sin Git (despliegue manual por
CLI), y `server/` compartiendo carpeta con código de otro dominio.

### 14.3 Grafo de dependencias del backend (acoplamiento)

```
errors.js         (12 ←)   el más reutilizado
text.js           ( 6 ←)
signals.js        ( 7 ←)
interventionPolicy.js ( 6 ←)   ← el más consultado

liveState ─┬─> signals ─┬─> liveEngine ──────────> sessionStore
           │            ├─> interventionOutcome ──> learning ─┬─> interventionPolicy
           │            │                                  ├─> problemBank
           │            │                                  └─> afterLiveEventSaved
           │            ├─> competencyEvidence
           │            └─> replay (solo tests)
           └─> liveView ──────────────────────────────> sessionStore

text ─> spanishNumbers ─┬─> operations ─┬─> signals / competencyEvidence / interventionOutcome
                       ├─> interventionPolicy
conversationJudge ─> liveEngine + afterLiveEventSaved
heartbeat ─> sessionStore
```

**Acoplamiento notable:** `interventionPolicy` aparece en 6 módulos. Cualquier cambio en la política
de mensajes afecta al motor, al observador, al aprendizaje, al banco de problemas, al reporte de
competencias y al post-proceso.

### 14.4 Duplicación real

| Duplicado | Ubicación | Motivo |
|-----------|----------|--------|
| `normalizeName` / `foldText` | `server/src/sessions/core/participants.js` y `text.js` | Deliberado: `server/` es un proyecto independiente |
| `deterministicId` | `server/src/sessions/core/ids.js` y `src/shared/lib/utils.js` | Ídem |
| `CAPABILITIES` / `CAPABILITY_IDS` | `server/.../competencies.js` y `src/shared/constants/contracts.js` | Un test **compara** ambas listas |
| Validador de evaluaciones | `src/.../utils/validation.js` (311 L) y `server/assessments/domain.js` | Defensa en profundidad |
| Verificación de token | `api/assessments.js`, `api/group-sessions.js`, `api/assessments/matching-profile.js`, y los 9 bordes de `server/api/` | Cada borde es independiente |
| Rutas del frontend | `src/app/router.jsx` las declara **dos veces** (array `routes` + `<Route>` explícito) | Real |
| `firebaseAdmin.js` | `server/firebaseAdmin.js` **y** `server/src/firebaseAdmin.js` | La raíz es la variante vieja |

### 14.5 Los hallazgos de inconsistencia

| # | Hallazgo | Ubicación |
|---|----------|-----------|
| 1 | **Credenciales de la cuenta demo de docente en claro en el bundle** | `src/features/auth/demoAccount.js` |
| 2 | Gamificación completa y testeada **sin ningún consumidor** | 7 componentes + 1 hook |
| 3 | `finalized` en `statusLabels` pero **no** en `ASSESSMENT_STATUS` | `forms.js:1` vs `contracts.js:19-23` |
| 4 | Nota académica **calculada en el cliente** además del servidor | `ResultsPanel.jsx:138` |
| 5 | Rutas declaradas **dos veces** en el router | `router.jsx:34-47` y 61-96 |
| 6 | Roles como **strings literales** en 5 de 7 rutas en vez de `USER_ROLES` | `router.jsx` |
| 7 | `/api/assessments` usa ruta **relativa**; el resto del backend usa `SERVER_URL` absoluto | `assessmentService.js:7` vs `serverApi.js:31` |
| 8 | `Navbar.jsx` documenta una UI que **ya no implementa** | `Navbar.jsx:2-8` |
| 9 | `ProgressRing.jsx` (120 L) **fuera** del barrel de `ui` | `components/ui/index.js` |
| 10 | `saveLiveEvent` en `sessionStore` **solo lo usan sus tests** | `sessionStore.js` |
| 11 | `replaySignals` **solo lo usan sus tests** | `core/replay.js` |
| 12 | `studentProfile.adjustConfig` sin uso en producción | `studentProfile.js` |
| 13 | `matchingEvidence.missingFromCurrentDemo` y `educationalValidationPlan` son aspiracional | `assessmentMatching.js` |
| 14 | `MatchingGroups.jsx` es **código muerto** (muestra `JSON.stringify(group.studentIds)`) | `matching/components/` |
| 15 | `/api/tick` **sin `maxDuration`** en `server/vercel.json` | `server/vercel.json` |

---

## 15. Riesgos y deuda técnica

### 15.1 🔴 Críticos

**1. Credenciales de docente en el repositorio**
```js
// src/features/auth/demoAccount.js
export const DEMO_TEACHER = Object.freeze({
  email: 'faviusam@gmail.com',
  password: 'F@vio2005',
})
```
- Está en claro, versionado, y **embebido en el bundle** por `Login.jsx:9,45-47`.
- La cuenta **existe en producción** con rol `teacher` real en Firestore.
- La contraseña es trivialmente adivinable a partir del email (patrón nombre+año).
- El commit `0ebec8e Credenciales demo` queda en el historial aunque se borre el archivo.
- **Impacto:** cualquiera que visite la página obtiene acceso docente a datos de estudiantes reales,
  evaluaciones, `matchingResults`, y puede crear salas.

**Mitigación recomendada:**
1. **Rotar la contraseña ya.**
2. Mover la demo a un **proyecto Firebase de demo separado** con `.env.demo`.
3. Mejor: eliminar el botón y usar un **usuario temporal generado vía callable** con cuota y
   expiración.
4. Añadir un secret-scanning hook de pre-commit.

**2. `VITE_SERVER_URL` apunta a producción por defecto**
```js
// src/services/serverApi.js:7
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://koeduko.vercel.app'
```
Un `npm run dev` con un bug puede **escribir en producción** (crear salas, cerrar sesiones, guardar
memoria). Debería fallar rápido si no hay override explícito en desarrollo.

**3. Sin probar las reglas de seguridad contra un atacante**
Las reglas están escritas para impedirlo, pero **nunca se atacaron**. Es el riesgo de seguridad
mayor del sistema y el más fácil de cerrar: un test con el emulador de Firestore y un token de
estudiante ajeno a la sesión.

### 15.2 🟠 Altos

**4. Coste y consentimiento de datos de menores sin resolver.** Tres decisiones abiertas
(§12.6). Un bot que transcribe la voz de un niño y envía una nota a un servicio externo requiere
resolución legal antes de cualquier uso real.

**5. El backend crítico no está en Git.** `server/` no está conectado al repositorio Vercel: un
`push` no despliega el tutor. Un `npm run build` verde no dice nada sobre el módulo más complejo.
Mitigación parcial: la CLI publica el directorio de trabajo, así que un despliegue manual puede
incluir cambios sin commitear.

**6. `accessType: OPEN` en Google Meet.** Sin sala de espera, cualquiera con el enlace entra. El
enlace solo lo ven los integrantes de la sala, y se puede cambiar a `TRUSTED` con
`GOOGLE_MEET_ACCESS`. Pero en la configuración por defecto, obtener el enlace es entrar.

**7. El `state` de OAuth de Google caduca a los 7 días** mientras la app esté en modo «Pruebas».
Hay que reconectar.

**8. `api/group-sessions.js` no tiene CORS.** Es un endpoint en el proyecto raíz que el navegador
llama. Sin lista de orígenes, es llamable desde cualquier origen (con un token válido).

### 15.3 🟡 Medios

**9. Un test fallando en la raíz.** `StudentDashboard.test.jsx` (y una suite de matching) falla en
`main`. `docs/TESTING.md` documenta que los fallos son preexistentes y de otros módulos.

**10. El límite de Firestore no se ha probado bajo carga.** 118 min/día es una **estimación**
(medido: 118 sin la vista de pantalla). Un ensayo con el reproductor consume 300 escrituras cada uno.

**11. `closeSession` contra el presupuesto de Vercel.** 30 s de `maxDuration`, con 21 s solo en el
clasificador (16 s + 5 s de retry). Margen de ~9 s para todo lo demás.

**12. Cosas que dependen de terceros sin control:**
- La transcripción Deepgram confunde nombres y números (documentado con un caso real).
- La documentación de Recall dice que `output_audio` no es para TTS dinámico.
- La AtomicMemory devuelve 502 sin `content_class`.
- El proyecto de Google está en modo «Pruebas».

**13. `useOperation.js` descarta silenciosamente la segunda llamada.**
```js
if (lock.current) return   // línea 8
```
Si dos acciones se disparan a la vez, la segunda se pierde sin aviso y el usuario puede creer que se
guardó.

### 15.4 🟢 Bajos / deuda de estilo

**14. Colores hardcodeados** en las features, contra el sistema de diseño (§11.5).
**15. Sin paginación** en las listas de estudiantes (>30 son tarjetas).
**16. `.catch(() => null)`** en varias lecturas que degradan en silencio sin explicar por qué.
**17. `checkEnv.js` usa `shell: true`** en `execFileSync` (riesgo de inyección, aunque la entrada
viene de `parseArgs`).
**18. `students/{key}/memory` recall no busca por significado** — devuelve las N más recientes.
**19. Sin CSP ni headers de seguridad** en el lado cliente (depende de `vercel.json`).
**20. `studentId` sigue en `null`** en la asignación de participantes → la memoria depende del
nombre normalizado de Meet, que debe ser el mismo entre sesiones.

---

## 16. Métricas

### 16.1 Código

| Métrica | Valor |
|---------|-------|
| Archivos de producción | **214** |
| Archivos de prueba | **122** |
| LOC frontend (`src/`) | **18 984** |
| LOC backend de sesiones (`server/src` + `api` + `scripts`) | **15 301** |
| LOC de prueba (frontend) | **5 804** |
| LOC de prueba (servidor) | **9 105** |
| **Ratio prueba/producción en `server/`** | **~1,32×** |
| Módulos `core/` puros en el backend | **30** |
| Adaptadores | **8** |
| Endpoints backend B | **9** |
| Endpoints backend A | **3** |
| Componentes del kit UI | **18** |
| Iconos | **35** |
| Rutas del frontend | **15** |
| Variables de entorno declaradas | **31** (24 servidor + 7 frontend) |
| Secretas | **8** |
| Commits | **155** |
| Documentos en `docs/` | **18** |
| LOC de documentación | **3 447** (+ server/README, 349) |

### 16.2 Tests

```text
Servidor:  69 archivos ·  977 tests ·  100% verde   ·  8,8 s
Raíz:      52 archivos ·  441 tests ·  440 verde,  1 fallo  ·  22,6 s
Lint:      0 errores
```

### 16.3 Economía de Firestore por segundo de sesión

```text
2,8 escrituras/s   →  20 000 / 2,8  ≈  118 minutos de sesión al día
2,7 lecturas/s     →  50 000 / 2,7  ≈  313 minutos al día
                     ▲ las escrituras son el límite
```

Con `live/view` en pantalla: ~111 minutos/día.

---

## 17. Glosario

| Término | Significado |
|---------|-------------|
| **Ancla** | Par (tiempo de sesión, reloj real) que permite a `/api/tick` saber cuánto tiempo pasó sin eventos |
| **Anchor / epoch** | Al reclamar un bot nuevo se resetea `live/state` con `epoch: nowMs` para que los ids del bot anterior no choquen |
| **Apagado por defecto** | Feature con flag cuyo valor inicial es inactivo (la voz, el observador en some configs) |
| **Borde** | Un `api/*.js` de Vercel: único lugar que lee `process.env` |
| **Competencia** | «Resuelve problemas de cantidad» — el objetivo curricular del MVP |
| **Cooldown** | 60 s sin repetir la misma señal al mismo destinatario |
| **Cobertura común** | Solo se empareja con las destrezas que **todos** los estudiantes evaluaron |
| **Destreza** | Una de las 6 habilidades matemáticas; se mide con `mastery ∈ [0,1]` |
| **Dominancia / ratio** | `DOMINANCE` salta si alguien habla ≥70% del tiempo |
| **`epoch`** | Marca de generación del bot en `live/state` |
| **Evidencia formativa** | El reporte del cierre. **Nunca una nota**; la calificación es del docente |
| **Florecimiento (blossom)** | Algoritmo de Edmonds para matching de peso máximo |
| **Grupo de 2 o 3** | Restricción del emparejamiento. **Máximo 1 trío** |
| **Heartbeat / latido** | `POST /api/tick`: el reloj de la sala sigue corriendo aunque nadie hable |
| **Intervención** | Una acción del tutor: mensaje en la app + chat de Meet, con `signal` y `evidence` |
| **JudgementWindow** | Ventana de 180 s sobre la que se evalúan las señales |
| **Mastery** | Nivel de dominio de una destreza, `[0,1]`. **Nunca se imputa un 0** |
| **`live/state`** | Estado incremental del motor. **Ningún cliente lo lee** |
| **`live/view`** | Vista para la pantalla. Existe para ahorrar lecturas de Firestore |
| **`private/answer`** | La respuesta esperada. **Ningún cliente la lee** |
| **Punto fijo** | `round(utilidad × 10⁶)` para comparar enteros sin coma flotante |
| **Seudónimo, no anónimo** | La clave de memoria es `sha256(scope + nombre)` — los nombres son adivinables |
| **Señal** | Lo que el motor detecta: `WRONG_ANSWER`, `STUCK`, `SILENT_PEER`, `GROUP_SILENCE`, `DOMINANCE`, `CORRECT_ANSWER`, `CONVERSATION` |
| **Testigo (fixture)** | Traza real anonimizada de una sesión de Meet, reproducible sin Recall |
| **Trío** | Grupo de 3. **Máximo 1 por sesión de emparejamiento** |
| **Ventana** | Los últimos 180 s de la sesión, sobre los que se evalúa |

---

## Apéndice A · Los 8 casos borde más difíciles (y por qué existen)

Cada uno de estos se discovered **en producción**, no en diseño:

| Caso | Síntoma | Solución |
|------|---------|----------|
| Número cortado por la transcripción | «cuarenta y» + «dos» → el motor leía **40** en vez de 42 | `endsUnfinished` espera 5 s o une con el siguiente |
| Pregunta que parece respuesta | «¿cuánto son seis por ocho?» contaba como haber respondido 2 | `sentencesOf` descarta interrogativas |
| Operación nombrada que parece resultado | «seis por ocho» se leía como la respuesta | `namesOperation` → recalcula sobre `resultPartOf` |
| Confusión que no es confusión | «no se puede», «no se mueve» contaban como atascamiento | Guardas: `no se` solo al final de frase o seguido de cómo/qué/si |
| Gemini felicitando | «¡Muy bien!» tras una respuesta la confirmaba o la desmintía sin decirlo | Prohibido explícitamente en el prompt; ahora se pide verificar |
| Gemini con 3 oraciones | Saltaba la regla de ≤2 oraciones | `validateMessage` lo rechaza → sale el mensaje determinista |
| `recall` devolviendo `[]` | No se distinguía «no hay memoria» de «falló la llamada» | Solo se cachea lo que **sí** se recordó |
| Sala reusada con bot nuevo | El motor no evaluaba: el reloj del bot anterior arrancaba en 0 | `epoch` al reclamar |

---

## Apéndice B · Mapa de archivos → responsabilidad

### Frontend

```text
src/main.jsx, App.jsx              Bootstrap
src/app/router.jsx                 15 rutas (declaradas dos veces)
src/app/ProtectedRoute.jsx         Guard de UX (no de seguridad)
src/contexts/AuthContext.jsx       user, profile, role, login/logout
src/components/ui/                 18 primitivas + tokens + iconos
src/components/layout/             AuthLayout, DashboardLayout, Navbar, Sidebar
src/components/layout-kit/          navConfig.js (fuente única de navegación)
src/shared/constants/contracts.js  CONTRATOS COMPARTIDOS (no editar sin coordinar)
src/shared/lib/                    alerts.js (SweetAlert2), utils.js, demoData.js
src/services/firebase.js           Única instancia de Firebase cliente
src/services/serverApi.js          Único puente con server/
src/features/auth/                 Login, Register, ForgotPassword, DemoAccess
src/features/dashboard/            3 pages, 7 components, gamification (muerta)
src/features/assessments/          Page, 9 components, 2 services, 2 utils, hook
src/features/matching/             2 pages, 5 components, algoritmo, worker, 5 services
src/features/sessions/             3 pages, 13 components, 6 hooks, 7 services
src/features/ai/                   TutorPage + tutorService
src/pages/design-system/           DesignSystemPage (916 L) — SIN RUTA
```

### Backend de sesiones

```text
server/api/                        9 bordes (único lugar con process.env)
server/src/http/                   Handlers con DI, CORS, respond
server/src/sessions/core/          30 módulos puros (sin reloj, red ni Firebase)
server/src/sessions/adapters/      8 adaptadores + sessionStore (524 L)
server/src/sessions/               Orquestadores + config + auth + errors
server/src/{envManifest,firebaseAdmin,adminCredentials,logger}.js
server/scripts/                    checkEnv, writeEnvExample, replayFixture, protectAnswer
server/fixtures/                   smoke-001 (265 eventos), smoke-002 (24 eventos)
server/assessments/                ⚠️ Dominio ajeno (backend A) conviviendo aquí
server/firebaseAdmin.js            ⚠️ Duplicado de src/firebaseAdmin.js
```

---

## Apéndice C · Comandos

```bash
# Frontend
npm run dev                # solo Vite (las llamadas a /api/assessments fallan)
npx vercel dev             # frontend + API local de Vercel (necesario para evaluaciones)
npm run build
npm run lint
npm test                   # 441 tests
npm run test:watch

# Backend de sesiones
npm --prefix server ci
npm --prefix server test   # 977 tests
npm run check:env          # qué variables faltan, solo por nombre
npm run env:example        # regenera los .env.example desde el manifiesto

# Despliegue del backend (NO está en Git)
cd server && npx vercel --prod
node server/scripts/checkEnv.js --vercel production

# Reproducir una sesión real sin Recall
node server/scripts/replayFixture.js --session smoke-replay-001 --speed 4

# Reglas de Firestore
firebase deploy --only firestore:rules --project koeduko-app
```

---

*Documento generado a partir del análisis del repositorio en el commit `bbffbae`.
Fuentes primarias: `README.md`, `docs/ARCHITECTURE.md`, `docs/SESSIONS_AGENT.md`,
`docs/TESTING.md`, `server/README.md`, `server/src/envManifest.js`, y el código fuente.*
# KoEduko — Arquitectura

## 1. Resumen

KoEduko identifica conocimientos complementarios entre estudiantes, forma parejas
mediante optimización combinatoria y facilita sesiones de aprendizaje colaborativo
con apoyo de un tutor de IA.

**Alcance del MVP:** demostrar el funcionamiento del flujo de extremo a extremo.
El MVP **no demuestra** que la plataforma mejore el aprendizaje; no existe todavía
evidencia empírica y no debe afirmarse lo contrario.

## 2. Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 + Vite 8 (JavaScript + JSX, sin TypeScript) |
| Estilos | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Routing | React Router v7 |
| Autenticación | Firebase Authentication (email/password) |
| Datos | Cloud Firestore |
| Hosting del frontend | Vercel (el proyecto de la raíz) |
| **Backend privilegiado** | **`server/`: funciones serverless de Vercel (Node.js 22)** |
| IA | Gemini, invocado **solo** desde `server/` |
| Videollamadas | Google Meet |
| Bot en la reunión | Recall.ai (bot participante, transcripción con Deepgram en español) |
| Pruebas | Vitest + Testing Library |

### Plan de Firebase: Spark (gratuito)

El proyecto Firebase `koeduko-app` **no puede usar el plan Blaze**. Cloud Functions y sus secretos
lo exigen, así que **no se usan**. Firebase se limita a **Authentication, Firestore y Hosting**; todo
lo que necesita privilegios (claves de terceros, escribir en colecciones cerradas) vive en `server/`.

La cuota gratuita de Firestore es de **50 000 lecturas y 20 000 escrituras por día**, y condiciona el
diseño de la sesión en vivo: ver `server/README.md` ("Presupuesto de Firestore").

## 3. Estructura de directorios

```text
src/
├── app/                     # Router y guardas de ruta (compartido)
│   ├── router.jsx
│   └── ProtectedRoute.jsx
├── components/
│   ├── ui/                  # Primitivas reutilizables (Button, Card, States)
│   └── layout/              # Navbar, Sidebar, DashboardLayout
├── contexts/AuthContext.jsx # Estado de sesión y perfil
├── features/
│   ├── auth/                # DEV 1
│   ├── dashboard/           # DEV 1
│   ├── assessments/         # DEV 2
│   ├── matching/            # DEV 2
│   ├── sessions/            # DEV 3
│   └── ai/                  # DEV 3 (tutorService llama a server/api/ask-tutor)
├── shared/
│   ├── constants/contracts.js  # CONTRATOS COMPARTIDOS (no editar sin coordinar)
│   └── lib/                 # Utilidades puras + datos demo
├── services/firebase.js     # Instancias de Firebase (Auth, Firestore, Storage)
└── test/setup.js

server/                      # Proyecto Vercel independiente (único backend privilegiado)
├── api/                     # Bordes HTTP delgados; solo aquí se lee process.env
│   ├── recall-webhook.js    #   eventos en vivo de Recall
│   ├── start-session-bot.js #   el docente invita al bot a la reunión
│   └── ask-tutor.js         #   pista del tutor para un estudiante
├── src/sessions/
│   ├── core/                # Lógica pura y testeable (motor de señales, estado, política del tutor)
│   ├── adapters/            # Recall, Gemini y Firestore
│   └── http/                # Handlers con dependencias inyectadas (CORS, errores)
├── fixtures/                # Sesión real anonimizada (datos de prueba y plan B de la demo)
└── scripts/                 # Reproductor de sesiones contra el webhook desplegado

docs/               # Documentación compartida
firestore.rules     # Reglas de seguridad
firestore.indexes.json
firebase.json       # Firestore, Hosting y emuladores (sin Functions)
```

## 4. Límites entre módulos

1. **Ningún módulo importa código interno de otro `feature/`.**
   La comunicación es a través de:
   - `src/shared/constants/contracts.js` (contratos y constantes)
   - Firestore (colecciones documentadas en `FIRESTORE_SCHEMA.md`)
   - `src/components/ui/` (primitivas visuales)

2. `services/firebase.js` es la **única** instancia de Firebase en el navegador. Nadie llama
   `initializeApp` por su cuenta.

3. **`server/` es la única vía para operaciones privilegiadas y para llamar a Gemini o a Recall.**
   Las claves nunca llegan al navegador. Nada dentro de `server/` importa código de fuera de esa
   carpeta, y el navegador solo habla con él por HTTP, con el ID token de Firebase del usuario.

4. **Los datos de la sesión en vivo los escribe únicamente el servidor** (`firebase-admin`, que no pasa
   por las reglas). El navegador solo los **lee**, y solo si es el docente o un estudiante de esa
   sesión (ver §6).

## 5. Flujo de datos del MVP

```text
Auth (users)
   └─> Classroom (classrooms) ─> students
Diagnóstico (assessments)
   └─> knowledgeProfiles        [DEV 2]
Emparejamiento (matchingResults/pairs)
   └─> complementariedad        [DEV 2]
Sesiones (learningSessions, pairId)
   ├─> tutorInteractions/{id}   [DEV 3]  pistas bajo demanda (ask-tutor)
   └─> live/state, liveEvents, agentInterventions   [DEV 3]  sesión en vivo (ver §5.1)
```

### 5.1 Sesión en vivo con el bot

```text
Docente → POST /api/start-session-bot (Bearer = ID token de Firebase)
            └─ verifica el token y exige users/{uid}.role == "teacher"
            └─ reserva bot:{id:null,status:"requested"} en una transacción (anti-duplicados)
            └─ Recall: crea el bot con el enlace de Meet guardado en la sesión
Recall → POST /api/recall-webhook?token=...   (eventos en tiempo real)
            └─ compara el token en tiempo constante (401 si falla; 200 en todo lo demás)
            └─ normaliza el evento y abre UNA transacción de Firestore (processLiveEvent):
                 lee   learningSessions/{id}/live/state   (estado incremental del motor)
                 aplica el evento y, como mucho cada 5 s de sesión, evalúa señales
                 escribe el estado y, salvo speech_on/off, el liveEvent crudo (id determinista)
            └─ responde 200 y, con waitUntil, afterLiveEventSaved:
                 si el motor decidió intervenir → Gemini redacta (o mensaje de respaldo)
                 → create() en learningSessions/{id}/agentInterventions (id determinista)
Estudiante → POST /api/ask-tutor (Bearer = ID token de Firebase)
            └─ verifica el token; solo el docente o un estudiante de esa sesión (studentIds)
            └─ el mismo adaptador de Gemini y la misma política: nunca devuelve la respuesta
```

El motor de señales decide **si** se interviene y a quién; Gemini solo **redacta**. Si Gemini falla, tarda
más de 6 s, no hay key o responde algo que rompe la política, se usa un mensaje determinista.
Detalle, costos medidos y límites conocidos en `server/README.md`.

## 6. Roles y autoridad

- El **rol no se acepta desde el navegador**. El registro público siempre crea
  `role: 'student'`. La promoción a `teacher` la realiza un administrador directamente en
  Firestore (no existe un endpoint para ello).
- La UI usa `ProtectedRoute` solo para **experiencia de usuario** (evitar pantallas
  inútiles). La **autoridad real** está en `firestore.rules` y en los endpoints de `server/`.
- Los endpoints de `server/` **nunca confían en el rol que manda el cliente**: verifican el ID token y
  leen el rol de `users/{uid}`. `start-session-bot` exige docente; `ask-tutor` exige docente o un
  estudiante cuyo `uid` figure en `studentIds` de esa sesión.
- **Lectura de la sesión en vivo** (`liveEvents`, `transcriptSegments`, `agentInterventions`,
  `live/state`): solo el docente o un estudiante de **esa** sesión; `write: false` para todos los
  clientes. CORS: solo el origen del frontend (`ALLOWED_ORIGINS`) y `localhost:5173`.

## 7. Dependencias entre desarrolladores

```text
DEV 1 (auth/dashboard)  ──usará──>  resultados de DEV 2 (matchingResults)
                                        resultados de DEV 3 (learningSessions)

DEV 2 (matching)       ──consume──>  students + assessments (los crea DEV 1)

DEV 3 (sessions/ai)    ──consume──>  pairs de DEV 2
```

Ver `INTEGRATION_GUIDE.md` para el orden de merge.

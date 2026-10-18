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
| Hosting del frontend y endpoints de evaluaciones | Vercel (el proyecto de la raíz: Vite + Vercel Functions en `api/`) |
| Backend de evaluaciones | `api/` (handlers Vercel) + `server/assessments/` y `server/firebaseAdmin.js` (lógica privada) |
| **Backend de sesiones en vivo** | **`server/`: proyecto Vercel independiente (`ko_eduko`), funciones serverless Node.js 22** |
| IA | Gemini, invocado **solo** desde `server/` |
| Videollamadas | Google Meet |
| Bot en la reunión | Recall.ai (bot participante, transcripción con Deepgram en español) |
| Memoria por estudiante | AtomicMemory (HTTP directo) con respaldo en Firestore |
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

api/                         # Vercel Functions del frontend (proyecto de la raíz): evaluaciones
└── assessments.js           #   autenticación y dispatcher

server/                      # Aquí conviven DOS cosas independientes:
├── firebaseAdmin.js         #   (evaluaciones) Admin SDK usado por api/ de la raíz
├── assessments/             #   (evaluaciones) dominio y servicio privado
│
├── api/                     #   (sesiones) bordes HTTP delgados; solo aquí se lee process.env
│   ├── recall-webhook.js    #     eventos en vivo de Recall
│   ├── start-session-bot.js #     el docente invita al bot a la reunión
│   ├── ask-tutor.js         #     pista del tutor para un estudiante
│   └── close-session.js     #     cierra la sesión: reporte de competencias + memoria
├── src/http/                #   handlers con dependencias inyectadas (CORS, errores)
├── src/sessions/
│   ├── core/                #     lógica pura y testeable (motor de señales, estado, política del tutor, competencias)
│   └── adapters/            #     Recall, Gemini, AtomicMemory y Firestore
├── fixtures/                #   sesión real anonimizada (datos de prueba y plan B de la demo)
├── scripts/                 #   reproductor de sesiones y scripts de administración
└── .env.example             #   manifiesto de variables (sin valores)

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

2. `src/services/firebase.js` es la **única** instancia de Firebase cliente: nadie llama `initializeApp` por su
   cuenta en el navegador. `firebase-admin` se inicializa por separado y solo dentro de `api/` y `server/`.

3. **Para las sesiones en vivo, `server/` es la única vía para operaciones privilegiadas y para llamar a Gemini o a
   Recall.** Las claves nunca llegan al navegador. El código de sesiones dentro de `server/` no importa nada de
   fuera de esa carpeta, y el navegador solo habla con él por HTTP, con el ID token de Firebase del usuario.
   Las Vercel Functions de `api/` (evaluaciones) siguen el mismo principio: verifican el ID token con el Admin SDK.

4. **Los datos de la sesión en vivo los escribe únicamente el servidor** (`firebase-admin`, que no pasa
   por las reglas). El navegador solo los **lee**, y solo si es el docente o un estudiante de esa
   sesión (ver §6).

5. `npm run dev` inicia solo Vite. `npx vercel dev` sirve el frontend y las funciones HTTP de `api/` en local; esa API
   requiere `FIREBASE_SERVICE_ACCOUNT_JSON` como variable privada del servidor.

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
   ├─> live/view, liveEvents, agentInterventions   [DEV 3]  sesión en vivo (ver §5.1); lo único que lee el navegador
   ├─> live/state, private/answer                  [DEV 3]  solo el servidor (estado del motor y respuesta esperada)
   └─> summary/final                               [DEV 3]  reporte de cierre por competencias (solo el docente)
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
                 si el motor decidió intervenir →
                   recall de la memoria del destinatario (2 s máx., cacheado por estudiante y sesión)
                   → Gemini redacta con esas notas (o mensaje de respaldo)
                   → create() en learningSessions/{id}/agentInterventions (id determinista)
                   → si la intervención es nueva: mensaje en el chat de Meet (Recall) y deliveredTo ['app','meet_chat']
Estudiante → POST /api/ask-tutor (Bearer = ID token de Firebase)
            └─ verifica el token; solo el docente o un estudiante de esa sesión (studentIds)
            └─ el mismo adaptador de Gemini y la misma política: nunca devuelve la respuesta
Docente → POST /api/close-session (Bearer = ID token de Firebase)
            └─ saca al bot (Recall) → arma el reporte de competencias (reglas; Gemini solo clasifica
               frases dudosas) → recuerda a cada estudiante (AtomicMemory, con respaldo en Firestore)
            └─ guarda summary/final y marca la sesión "completed" (un lote). Cada paso externo tiene
               límite de tiempo y respaldo: ninguno puede romper el cierre; summary.steps dice qué falló
```

El motor de señales decide **si** se interviene y a quién; Gemini solo **redacta**. Si Gemini falla, tarda
más de 6 s, no hay key o responde algo que rompe la política, se usa un mensaje determinista.
Detalle, costos medidos y límites conocidos en `server/README.md`; comportamiento del agente en `SESSIONS_AGENT.md`.

## 6. Roles y autoridad

- El **rol no se acepta desde el navegador**. El registro público siempre crea
  `role: 'student'`. La promoción a `teacher` la realiza un administrador directamente en
  Firestore (no existe un endpoint para ello).
- La UI usa `ProtectedRoute` solo para **experiencia de usuario** (evitar pantallas
  inútiles). La **autoridad real** está en `firestore.rules` y en los endpoints de `server/`.
- Los endpoints de `server/` **nunca confían en el rol que manda el cliente**: verifican el ID token y
  leen el rol de `users/{uid}`. `start-session-bot` exige docente; `ask-tutor` exige docente o un
  estudiante cuyo `uid` figure en `studentIds` de esa sesión.
- **Lectura de la sesión en vivo** (`liveEvents`, `transcriptSegments`, `agentInterventions`, `live/view`):
  solo el docente o un estudiante de **esa** sesión; `write: false` para todos los clientes. **`live/state` y
  `private/answer` no los lee ningún cliente** (ahí está la respuesta esperada). `summary/final` solo lo lee el
  docente. CORS: solo el origen del frontend (`ALLOWED_ORIGINS`) y `localhost:5173`.

## 7. Dependencias entre desarrolladores

```text
DEV 1 (auth/dashboard)  ──usará──>  resultados de DEV 2 (matchingResults)
                                        resultados de DEV 3 (learningSessions)

DEV 2 (matching)       ──consume──>  students + assessments (los crea DEV 1)

DEV 3 (sessions/ai)    ──consume──>  pairs de DEV 2
```

Ver `INTEGRATION_GUIDE.md` para el orden de merge.

## 8. Decisiones y tradeoffs del módulo de sesiones

| Decisión | Por qué | Lo que cuesta |
| --- | --- | --- |
| **Vercel y no Cloud Functions** | Firebase está en el plan Spark; Cloud Functions y sus secretos exigen Blaze. | Un segundo proyecto de despliegue, CORS y verificación manual del ID token. |
| **Dos proyectos de Vercel desde un repo**: el frontend (raíz) y el backend de sesiones (`server/`, proyecto `ko_eduko`) | Despliegues independientes y secretos separados: el navegador nunca ve las claves de Gemini, Recall ni AtomicMemory. | Dos juegos de variables, `ALLOWED_ORIGINS` que mantener, y `server/` comparte carpeta con código de evaluaciones de otro módulo (conviven sin importarse). |
| **Bot participante (Recall.ai)** | Funciona con cualquier Meet sin extensión ni permisos del navegador de los niños. | El bot aparece en la reunión y el anfitrión debe admitirlo; la transcripción llega ~1,5 s tarde; Recall cobra por minuto. |
| **Deepgram vía Recall** (`nova-3`, español) | No se integra ni mantiene un servicio de voz propio. | Errores de transcripción en nombres y números; el idioma que Recall reporta (`en`) es ruido y no se lee. |
| **Las reglas deciden, el LLM solo redacta** | Es auditable y testeable; Gemini nunca decide, nunca ve la respuesta y su texto se valida (≤ 2 oraciones, nombra al destinatario, sin el resultado). | Solo 5 señales: cuando ninguna salta, el tutor calla. No es un tutor conversacional. |
| **Estado incremental + vista** (`live/state` para el motor, `live/view` para la pantalla) | La cuota gratuita de Firestore (50 000 lecturas y 20 000 escrituras al día) no permite releer la ventana por evento. | Tope de ~111 minutos de sesión al día (estimado) y dos documentos que mantener coherentes. |
| **La respuesta esperada fuera del documento de la sesión** (`private/answer`) | Los estudiantes leen ese documento. | Una lectura más por problema y una migración para sesiones viejas. |
| **AtomicMemory por HTTP directo, sin su SDK** | El SDK arrastra ~277 MB de binarios nativos (límite de Vercel: 250 MB) y 3 vulnerabilidades altas, para llamar a dos endpoints. | Mantener a mano el contrato de esas dos llamadas; si el servicio cambia, se rompe aquí. |
| **`studentKey` seudónimo** (uid, o `scope:hash(scope + nombre)`) | La memoria termina en un servicio externo: no debe llevar el correo ni el nombre. | Es seudónimo, no anónimo (los nombres son fáciles de adivinar), y solo funciona si el nombre en Meet es el mismo entre sesiones. |
| **Evidencia formativa, nunca una nota** | La calificación es del docente. Las reglas clasifican primero; Gemini solo etiqueta frases dudosas y su etiqueta nunca basta para «con evidencia». | El reporte es conservador: muchas capacidades salen «sin evidencia suficiente». |

Cada paso que depende de un servicio externo (Gemini, Recall, AtomicMemory) tiene límite de tiempo y respaldo:
ningún servicio externo puede dejar mudo al tutor ni romper el cierre de la sesión.

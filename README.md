# KoEduko

Plataforma educativa que identifica conocimientos complementarios entre
estudiantes, forma parejas mediante optimización combinatoria y facilita sesiones
de aprendizaje colaborativo con apoyo de un tutor de IA.

Competencia inicial: **«Resuelve problemas de cantidad»**, quinto de primaria.

> **Alcance.** Este proyecto demuestra el *funcionamiento* de la solución. **No se
> ha medido su efecto sobre el aprendizaje** y no debe afirmarse que la plataforma
> lo mejora. Esa evidencia no existe todavía.

## Stack

React 19 · Vite · Tailwind CSS v4 · React Router 7 · Firebase (Auth, Firestore,
Storage; plan gratuito, sin Cloud Functions) · Vercel Functions (`api/`, evaluaciones) ·
backend de sesiones en vivo en Vercel (`server/`) · Gemini · Recall.ai · AtomicMemory · Google Meet

## Instalación

```bash
git clone https://github.com/Favio-coder/Koeduko-hackandes.git
cd Koeduko-hackandes
npm ci
cp .env.example .env      # completar con los datos de tu proyecto Firebase
npm run dev
```

## Desarrollo local (frontend y backend)

`npm run dev` ejecuta solo Vite. Para que las solicitudes a `/api/assessments`
lleguen a la función backend de Vercel, ejecuta desde la raíz del repositorio:

```bash
npx vercel login
npx vercel link       # vincular el proyecto Vercel una vez
npx vercel dev
```

Esto sirve el frontend y `api/` en el mismo origen (por defecto,
`http://localhost:3000`). Se necesita Vercel CLI y una cuenta/proyecto Firebase.
Completa las variables públicas `VITE_FIREBASE_*` de `.env` desde
`.env.example`, y agrega `FIREBASE_SERVICE_ACCOUNT_JSON` con las credenciales de
una cuenta de servicio serializadas como JSON en una sola línea. Esa variable es
solo del backend: no debe llevar prefijo `VITE_`, copiarse al cliente ni
versionarse. En Vercel se configura como variable de entorno del proyecto.

El frontend sin backend Vercel puede arrancar con `npm run dev`, pero las
operaciones de evaluaciones que llaman a `/api/assessments` no funcionarán. La
función callable del tutor se despliega por separado desde `functions/`.

## Scripts

```bash
npm run dev         # servidor de desarrollo
npx vercel dev      # frontend + API local de Vercel
npm run build       # build de producción
npm run preview     # sirve el build
npm run lint        # ESLint
npm test            # pruebas (Vitest)
npm run test:watch  # pruebas en modo watch
```

## Estructura

```text
src/
├── app/            # router y guardas de ruta
├── components/     # ui/ (primitivas) y layout/ (Navbar, Sidebar, DashboardLayout)
├── contexts/       # AuthContext
├── features/       # auth, dashboard, assessments, matching, sessions, ai
├── shared/         # constants/contracts.js y lib/ (utilidades puras, datos demo)
├── services/       # firebase.js
└── test/setup.js
api/                # Vercel Functions del frontend (endpoints HTTP de evaluaciones)
server/             # contiene dos cosas independientes:
                    #   server/assessments/, server/firebaseAdmin.js  -> lógica privada de evaluaciones (usada por api/)
                    #   el resto (api/, src/, scripts/, fixtures/)    -> backend de sesiones en vivo y tutor IA,
                    #                                                   un proyecto Vercel aparte (ver server/README.md)
docs/               # arquitectura, esquema, contratos, tareas, integración, roadmap
```

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura, límites entre módulos, dependencias |
| [`docs/FIRESTORE_SCHEMA.md`](docs/FIRESTORE_SCHEMA.md) | Colecciones, campos, reglas e índices |
| [`docs/assessments-phase-2.md`](docs/assessments-phase-2.md) | Gestión docente de evaluaciones y pruebas de Fase 2 |
| [`docs/assessments-phase-3.md`](docs/assessments-phase-3.md) | Examen interactivo del estudiante y pruebas de Fase 3 |
| [`docs/assessments-phase-4.md`](docs/assessments-phase-4.md) | Calificación, resultados y contrato matching v1.0 |
| [`docs/assessments-phase-5.md`](docs/assessments-phase-5.md) | Auditoría final, validación y guía de despliegue Vercel |
| [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) | Contratos que deben respetar los 3 módulos |
| [`docs/TEAM_TASKS.md`](docs/TEAM_TASKS.md) | Tareas por desarrollador con criterios de aceptación |
| [`docs/INTEGRATION_GUIDE.md`](docs/INTEGRATION_GUIDE.md) | Git, PRs, resolución de conflictos |
| [`docs/HACKATHON_ROADMAP.md`](docs/HACKATHON_ROADMAP.md) | Cronograma, prioridades y riesgos |

## Desarrollo en equipo

Ramas: `feature/auth-dashboard`, `feature/matching-engine`, `feature/sessions-ai`.
Nadie hace push directo a `main`. Ver la guía de integración.

## Firebase

```bash
npm i -g firebase-tools
firebase login
firebase emulators:start                 # probar reglas de seguridad
firebase deploy --only firestore:rules,firestore:indexes
```

Variables requeridas:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (solo backend; requerida por la API Vercel)

`VITE_APP_LOCALE` es opcional. Las variables `VITE_FIREBASE_*` forman parte del
bundle del navegador; las reglas de Firestore y la autenticación, no el secreto
de la API key, son la barrera de seguridad. `FIREBASE_SERVICE_ACCOUNT_JSON` es
una credencial privada y debe mantenerse únicamente en el entorno del servidor.

## Servidor de sesiones en vivo y tutor IA

El backend privilegiado de sesiones es `server/`, un proyecto de Vercel independiente (`ko_eduko`). **No se usan
Cloud Functions**: exigen el plan Blaze de Firebase y el proyecto está en el plan gratuito. Tiene cuatro
endpoints: `/api/recall-webhook`, `/api/start-session-bot`, `/api/ask-tutor` y `/api/close-session`.

```bash
npm --prefix server ci
npm --prefix server test
cd server && npx vercel --prod      # las variables van como secretos del proyecto en Vercel
```

Gemini y Recall se invocan **solo** desde `server/`. Nunca desde el navegador, nunca en `.env`, nunca en
Firestore. El navegador llama al servidor con su ID token de Firebase (`VITE_SERVER_URL`, por defecto
`https://koeduko.vercel.app`). Detalle, costos y límites en `server/README.md` y `docs/ARCHITECTURE.md`.

## Estado actual

- Base compartida implementada: router, layouts, autenticación, contratos,
  reglas de Firestore, stub funcional de los tres módulos.
- Lint y build verdes; pruebas unitarias de utilidades compartidas pasando.
- El emparejamiento, las sesiones con Meet y el tutor IA son **puntos de
  extensión** asignados a los desarrolladores 2 y 3. Ver `docs/TEAM_TASKS.md`.
- Google Meet y Gemini **no han sido probados en un entorno real** en esta fase.
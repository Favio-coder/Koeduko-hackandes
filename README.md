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
Storage, Functions) · Gemini (desde Cloud Functions) · Google Meet

## Instalación

```bash
git clone https://github.com/Favio-coder/Koeduko-hackandes.git
cd Koeduko-hackandes
npm ci
cp .env.example .env      # completar con los datos de tu proyecto Firebase
npm run dev
```

## Scripts

```bash
npm run dev         # servidor de desarrollo
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
functions/src/      # Cloud Functions (tutor IA)
docs/               # arquitectura, esquema, contratos, tareas, integración, roadmap
```

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura, límites entre módulos, dependencias |
| [`docs/FIRESTORE_SCHEMA.md`](docs/FIRESTORE_SCHEMA.md) | Colecciones, campos, reglas e índices |
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

## Cloud Functions (tutor IA)

```bash
cd functions && npm ci
firebase functions:secrets:set GEMINI_API_KEY   # secreto del servidor
npm --prefix functions run deploy
```

La API de Gemini se invoca **solo** desde Cloud Functions. Nunca desde el
navegador, nunca en `.env`, nunca en Firestore.

## Estado actual

- Base compartida implementada: router, layouts, autenticación, contratos,
  reglas de Firestore, stub funcional de los tres módulos.
- Lint y build verdes; pruebas unitarias de utilidades compartidas pasando.
- El emparejamiento, las sesiones con Meet y el tutor IA son **puntos de
  extensión** asignados a los desarrolladores 2 y 3. Ver `docs/TEAM_TASKS.md`.
- Google Meet y Gemini **no han sido probados en un entorno real** en esta fase.
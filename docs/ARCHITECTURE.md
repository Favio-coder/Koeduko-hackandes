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
| Backend privilegiado | Firebase Cloud Functions (Node.js 22) |
| IA | Gemini, invocado **solo** desde Cloud Functions |
| Videollamadas | Google Meet (enlaces registrados manualmente en Fase 1) |
| Pruebas | Vitest + Testing Library |

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
│   └── ai/                  # DEV 3
├── shared/
│   ├── constants/contracts.js  # CONTRATOS COMPARTIDOS (no editar sin coordinar)
│   └── lib/                 # Utilidades puras + datos demo
├── services/firebase.js     # Instancias de Firebase
└── test/setup.js

functions/src/
├── index.js        # Punto de entrada (exporta las funciones)
├── admin.js        # requireUser / requireTeacher
└── agents/         # askTutor, tutorPrompt

docs/               # Documentación compartida
firestore.rules     # Reglas de seguridad
firestore.indexes.json
firebase.json
```

## 4. Límites entre módulos

1. **Ningún módulo importa código interno de otro `feature/`.**
   La comunicación es a través de:
   - `src/shared/constants/contracts.js` (contratos y constantes)
   - Firestore (colecciones documentadas en `FIRESTORE_SCHEMA.md`)
   - `src/components/ui/` (primitivas visuales)

2. `services/firebase.js` es la **única** instancia de Firebase. Nadie llama
   `initializeApp` por su cuenta.

3. Las **Cloud Functions** son la única vía para operaciones privilegiadas y para
   llamar a Gemini.

## 5. Flujo de datos del MVP

```text
Auth (users)
   └─> Classroom (classrooms) ─> students
Diagnóstico (assessments)
   └─> knowledgeProfiles        [DEV 2]
Emparejamiento (matchingResults/pairs)
   └─> complementariedad        [DEV 2]
Sesiones (learningSessions, pairId)
   └─> tutorInteractions/{id}   [DEV 3]
```

## 6. Roles y autoridad

- El **rol no se acepta desde el navegador**. El registro público siempre crea
  `role: 'student'`. La promoción a `teacher` la realiza una Cloud Function
  privilegiada o un administrador directamente en Firestore.
- La UI usa `ProtectedRoute` solo para **experiencia de usuario** (evitar pantallas
  inútiles). La **autoridad real** está en `firestore.rules`.

## 7. Dependencias entre desarrolladores

```text
DEV 1 (auth/dashboard)  ──usará──>  resultados de DEV 2 (matchingResults)
                                        resultados de DEV 3 (learningSessions)

DEV 2 (matching)       ──consume──>  students + assessments (los crea DEV 1)

DEV 3 (sessions/ai)    ──consume──>  pairs de DEV 2
```

Ver `INTEGRATION_GUIDE.md` para el orden de merge.
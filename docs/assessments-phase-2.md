# KoEduko — Fase 2: gestión docente de evaluaciones

## Alcance

La pantalla `/assessments` permite a docentes consultar evaluaciones de sus
cursos autorizados, crear borradores, editar borradores, asignar estudiantes y
publicar. El editor incluye tipo, escala, puntaje máximo, ponderación, fechas,
duración, intentos, modalidad de retroalimentación y constructor de preguntas
de opción múltiple y verdadero/falso. Cada pregunta guarda habilidad, puntaje y
respuesta correcta. La vista de resultados existente se conserva.

La API no acepta decisiones de autorización del cliente: verifica el Firebase
ID token, obtiene el rol de `users/{uid}` y valida la titularidad del curso y la
matrícula contra `assessmentCourseAccess/{courseId}`. Las preguntas completas
se mantienen en el backend; las respuestas correctas y explicaciones no se
incluyen en las preguntas que se envían al estudiante.

Esta fase no modifica matching, sesiones, Meet ni tutor IA y no amplía el
contrato de matching JSON `1.0`. No incluye cambios al flujo interactivo del
estudiante.

## Arquitectura y ejecución

- UI React: `src/features/assessments/`.
- Endpoint Vercel: `POST /api/assessments`, implementado en
  `api/assessments.js`.
- Dominio y persistencia: `server/assessments/` con Firebase Admin SDK.
- Persistencia: Cloud Firestore; reglas deniegan acceso cliente a las ACL y a
  los documentos de evaluaciones.
- Autenticación: Firebase Authentication para el cliente; Firebase ID token
  verificado por el endpoint para cada petición.

Configura las variables `VITE_FIREBASE_*` del cliente y la variable privada
`FIREBASE_SERVICE_ACCOUNT_JSON` del backend según [README.md](../README.md).
`npm run dev` ejecuta solo Vite; para desarrollar frontend y API en el mismo
origen, ejecuta `npx vercel login`, `npx vercel link` (una vez) y luego
`npx vercel dev` desde la raíz.

## Persistencia Firestore

El esquema autoritativo de Fase 2, los campos y los límites de lectura están en
[FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md). En resumen:

- `assessmentCourseAccess/{courseId}`: ACL provisionada por administración:
  docente, UIDs de estudiantes, competencia(s) y habilidades autorizadas.
- `assessmentModules/{assessmentId}`: metadatos, estado y revisión.
- `private/definition`: preguntas completas con claves, accesible solo desde
  backend.
- `public/questions`: preguntas sanitizadas sin respuesta correcta ni
  explicación.
- `assignments/{studentUid}/attempts/{attemptId}`: asignación, respuestas,
  revisiones y resultados, accesibles solo mediante la API autorizada.

La API mantiene claves, respuestas y notas fuera del acceso directo del
cliente. Las transiciones y la asignación se validan en servidor; la
publicación persiste los metadatos, definición y asignaciones dentro de una
transacción. Los IDs de estudiantes se validan contra la ACL vigente.

## Acciones de la API

Todas las acciones usan `POST /api/assessments` con
`{ "action": "...", "payload": {} }`:

| Acción | Uso |
| --- | --- |
| `bootstrap` | Cursos, competencias, habilidades, matrícula y evaluaciones visibles al usuario |
| `save` | Crear o actualizar un borrador con control de revisión |
| `detail` | Leer detalle docente o metadatos permitidos del estudiante |
| `publish` | Validar y publicar un borrador, creando asignaciones |
| `results` | Consultar resultados del docente responsable |
| `close`, `finalize` | Transiciones de estado protegidas |
| `export` | Exportar el contrato matching JSON `1.0` existente |

Las demás acciones de estudiante se mantienen fuera del alcance de la UI de esta
fase.

## Pruebas

```bash
npm test
npm run test:assessments:integration
npm run lint
npm run build
```

La suite de dominio valida campos, competencias permitidas, tipos de pregunta,
claves, puntajes y asignaciones. La suite de integración usa Auth y Firestore
Emulator para probar creación, edición, borradores, publicación, permisos,
matrícula, persistencia, intentos y reglas. También ejecuta el handler HTTP
para verificar token, rol, JSON inválido y métodos no permitidos. No se usa un
proyecto Firebase real.

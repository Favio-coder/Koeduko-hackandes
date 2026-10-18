# KoEduko — Rediseño de evaluaciones, Fase 1

## Alcance y conclusión

Esta fase audita el sistema existente y fija decisiones de arquitectura para
las fases siguientes. No realiza migraciones, no crea colecciones, no cambia
el algoritmo de matching ni modifica sesiones o tutor IA. Se instala
SweetAlert2, se incorpora un servicio de alertas reutilizable y se oculta el
campo «Ponderación prevista (%)» del editor. El valor heredado
`weightPercent` sigue siendo aceptado y almacenado: no se elimina ni se usa
como ponderación académica.

El flujo de evaluaciones ya tiene un backend protegido, publicación y
asignación, reanudación de intentos, guardado con control de revisión,
calificación objetiva y exportación de matching. No hay todavía un modelo de
áreas académicas independientes, calificaciones de curso ni promedios. Por
tanto, el objetivo de esta fase es preservar esas capacidades y no sustituirlas
por un modelo paralelo.

## Diagnóstico del sistema actual

### Módulos y persistencia real

- React vive en `src/features/assessments/`. El servicio cliente
  `assessmentRequest` obtiene el token de Firebase Authentication y llama al
  endpoint.
- `POST /api/assessments` verifica el ID token (incluida revocación), obtiene
  la identidad del token y delega al servicio de servidor.
- `server/assessments/service.js` comprueba el rol desde `users/{uid}`, la
  titularidad del docente, el curso ACL y la asignación del estudiante. Usa
  Firebase Admin SDK; el cliente no escribe las colecciones del módulo.
- `assessmentModules/{assessmentId}` es el documento de metadatos. La
  definición completa y privada está en `private/definition`; la copia
  `public/questions` omite respuesta correcta y explicación.
- `assessmentModules/{id}/assignments/{studentUid}` contiene un único estado
  por estudiante y evaluación. `attempts/{attemptId}` conserva el historial de
  intentos, respuestas, revisiones y resultados.
- La antigua colección `assessments` documentada en
  `docs/FIRESTORE_SCHEMA.md` es un contrato legacy, no la persistencia usada
  por esta API. No se propone duplicar o migrar colecciones en esta fase.

### Relaciones de identidad y contexto académico

- La identidad estable en evaluaciones es el UID de Firebase Authentication.
  Ese UID se usa como clave de asignación y como `result.studentId`. El campo
  `students/{studentId}.userId` es un modelo anterior y no es la clave que usa
  el módulo actual.
- `assessmentCourseAccess/{courseId}` es simultáneamente el catálogo ACL de
  cursos del módulo y la fuente de autoridad para `teacherId`, `studentIds`,
  competencias y habilidades. La matrícula usada por evaluaciones es
  `studentIds` de ese documento.
- `classrooms/{classroomId}` y `students/{studentId}` existen aparte, pero la
  ACL del curso no contiene una referencia obligatoria a `classroomId`.
  Tampoco hay una relación institucional persistida y compartida por estos
  documentos. La sincronización entre matrículas de aula y curso es un riesgo
  pendiente.
- En el módulo actual `competencyId` identifica la competencia evaluada y
  `skills` clasifica evidencia por habilidad. No existe colección ni clave
  `areaId`. La competencia no debe renombrarse o suponerse equivalente a un
  área curricular hasta acordar esa semántica académica.

### Intentos, calificación y promedio actuales

- Iniciar un intento crea un documento en una transacción, incrementa el
  contador de asignación y fija `activeAttemptId`. Si el intento sigue vigente,
  se devuelve el mismo intento para reanudarlo. Los vencidos cuentan dentro
  del límite.
- El botón «Guardar respuestas» persiste la revisión actual en el servidor;
  `sessionStorage` mantiene además una copia local de recuperación. Anterior y
  Siguiente también guardan en el servidor antes de cambiar de pregunta. Por
  eso el botón de guardado parece redundante, aunque es el único control
  explícito para guardar sin navegar. En modo de retroalimentación inmediata,
  guardar bloquea las respuestas ya corregidas.
- El envío final requiere todas las respuestas, valida intento, plazo y
  revisión, y califica en el servidor. Las respuestas correctas no se confían
  al navegador. Repetir el envío de un intento ya calificado devuelve el
  resultado persistido.

  Se deben reutilizar el endpoint `assessmentRequest`, las acciones existentes
  (`bootstrap`, `save`, `detail`, `publish`, `results`, `close`, `finalize`,
  `export`, `start`, `saveAnswers`, `submit` y `review`), las validaciones de
  `server/assessments/domain.js`, el control de revisión y las transacciones del
  servicio. Las pruebas de dominio, UI e integración existentes cubren buena
  parte de estas garantías y deben ampliarse en vez de reemplazarse.
- La política implementada para intentos múltiples es «último intento
  enviado»: el documento de asignación apunta al resultado del último envío
  calificado; los intentos anteriores se conservan como historial. Un intento
  incompleto no se califica, y cerrar una evaluación cancela intentos abiertos
  sin fabricar notas.
- La calificación actual es objetiva. `result.overallScore` y `maxScore`
  conservan puntaje bruto; `result.skills` contiene puntaje, máximo, mastery y
  `evidenceCount`. `scaledScore` se calcula en una escala elegida por
  evaluación (0–20 **o** 0–100), no siempre en escala académica 0–20.
- No existe un agregado de calificaciones por área ni una fórmula de promedio.
  No se debe interpretar `assignment.result` como promedio de curso.
- `weightPercent` se valida entre 0 y 100 y se persiste en metadatos, pero no
  interviene en la nota ni en ningún promedio. Su significado académico no
  está definido. La UI conserva el campo en el objeto de datos para mantener
  compatibilidad de guardado, pero ya no lo muestra.

### Matching

El backend exporta resultados finalizados como `StudentKnowledgeProfile` v1.0
con propiedades exactas `schemaVersion`, `courseId`, `assessmentId`,
`competencyId`, `generatedAt`, `status` y `students`. El perfil por estudiante
conserva UID, puntaje bruto, máximo y evidencia por habilidad. La nota
normalizada no forma parte de ese contrato. La exportación rechaza asignaciones
faltantes, resultados inválidos e intentos activos.

`normalizeAssessmentResults` adapta el contrato v1.0, pero la documentación de
la fase anterior señala que el matching operativo sigue usando perfiles de
demostración y no consume automáticamente el endpoint. No se cambia esta
integración, el algoritmo, ni nombres o propiedades del contrato. No se deben
generar perfiles finalizados desde resultados incompletos.

### Validaciones y seguridad observadas

Ya existen validaciones de rol, curso, titularidad, matrícula ACL, fechas,
límites, preguntas, puntos, respuestas permitidas, revisión optimista,
retroalimentación y estado de intento. Publicación, envío, cierre y
finalización usan transacciones. La regla global de Firestore deniega el
acceso cliente a `assessmentCourseAccess` y `assessmentModules`.

Riesgos y faltantes que deben resolverse en fases siguientes:

1. **Reglas legacy:** `firestore.rules` permite a cualquier usuario autenticado
   leer un documento publicado en `assessments/{assessmentId}`. El esquema
   legacy incluye `correctIndex`; si siguen existiendo documentos con ese
   formato, la clave puede quedar expuesta. Cualquier docente también puede
   leer todos los documentos de esa colección, incluidos borradores. La
   autorización tampoco se limita al curso del lector. Confirmar uso y aplicar
   una regla segura antes de volver a exponer esa colección.
2. **Matrícula duplicada:** no hay enlace obligatorio entre roster de
   `classrooms` y `assessmentCourseAccess`; una discrepancia puede dejar
   accesos o asignaciones desactualizados.
3. **Esquema ACL:** `studentIds`, competencias y habilidades se consideran
   datos administrativos confiables; se requiere endurecer la validación de
   forma y consistencia de estos documentos y definir la autoridad para
   sincronizarlos.
4. **Contrato HTTP:** el handler valida tamaño y objeto exterior, pero falta
   una validación uniforme del esquema de `action` y `payload`; entradas
   malformadas pueden acabar como error interno en vez de error de cliente.
5. **Finalización acoplada:** `finalize` actualmente exige resultado para
   cada estudiante asignado porque la transición también habilita la
   exportación completa de matching. No existe la finalización académica
   independiente que permita excluir una entrega faltante de un promedio.
6. **Calificación:** no hay estado de corrección manual, `submittedAt`
   explícito ni nota canónica `normalizedScore20`. `gradedAt` representa la
   calificación automática al envío.
7. **Reintentos de creación:** los envíos de nota son idempotentes por intento
   ya calificado y los guardados usan revisión; una petición de creación de
   borrador sin ID estable puede crear otro borrador si el cliente repite una
   petición cuyo primer resultado no recibió.
8. **Escala/peso:** el selector actual admite escala 0–100, y el campo
   `weightPercent` no tiene semántica ni aplicación académica.
9. **Reglas de otras entidades:** las reglas actuales permiten a cualquier
   docente leer perfiles de usuario y leer/escribir estudiantes y aulas sin
   comprobar titularidad del curso. El módulo de evaluaciones hace controles
   adicionales en su API, pero las reglas directas deben evaluarse por separado
   para evitar acceso transversal entre docentes.

## Modelo académico propuesto sin colecciones duplicadas

La propuesta reutiliza documentos y referencias ya existentes. No se crea
otra colección de notas, estudiantes, cursos o perfiles en esta fase.
La relación lógica es Institución (sin referencia común actual) → curso
(`assessmentCourseAccess/{courseId}`) → área por acordar (hoy
`competencyId`) → evaluación → asignación e intentos → calificación canónica
→ promedio derivado.

| Relación | Fuente canónica existente | Uso/decisión |
| --- | --- | --- |
| Institución | No existe un identificador institucional común | No inventar una colección. Si se requiere multiinstitución, añadir una referencia estable a los cursos y definir su fuente antes de migrar. |
| Curso | `assessmentCourseAccess/{courseId}` | Mantener `courseId` como referencia estable de evaluaciones; sincronizarlo con `classroomId` solo mediante una regla de dominio explícita. |
| Área | No existe entidad `area`; actualmente se persiste `competencyId` | Mantener la competencia como tal. Definir el mapeo curricular antes de reutilizarla como área o agregar `areaId`. |
| Evaluación | `assessmentModules/{assessmentId}` y `private/definition` | Una evaluación referencia el curso y la competencia/área acordada, define puntaje máximo y política de intentos. No duplicar definición en otra colección. |
| Intentos | `assignments/{studentUid}/attempts/{attemptId}` | Historial inmutable del estudiante por evaluación; cada intento referencia implícitamente su evaluación y asignación padre. |
| Calificación por evaluación | `assignments/{studentUid}` | Registro canónico por pareja evaluación-estudiante; selecciona un solo intento según política y no crea una nota por cada intento. |
| Promedio | Derivado de calificaciones canónicas del estudiante para el curso/área | Calcular desde resultados elegibles; no almacenar un segundo resultado autoritativo en una colección paralela. Si se materializa por rendimiento, debe ser una proyección reconstruible e idempotente. |

Campos objetivo de una calificación individual (no implementados todavía):

```text
studentId          UID estable de Firebase Authentication
courseId           referencia al curso ACL
areaId             referencia acordada; mientras tanto no inventar ni duplicar
assessmentId       ID de assessmentModules
attemptId          intento seleccionado por la política institucional
score              puntos brutos obtenidos
maxScore           puntaje máximo
normalizedScore20  round(score / maxScore * 20, 2)
submittedAt        fecha de entrega efectiva
correctionStatus   pending | graded (y finalized si la política lo requiere)
academicWeight     opcional; único en los metadatos de la evaluación
skills             evidencia existente: skillId, score, maxScore,
                   mastery y evidenceCount
```

Conservar puntajes brutos y las propiedades del contrato matching. El valor
normalizado 0–20 es una nota académica adicional, no un reemplazo de puntos,
mastery ni del perfil v1.0. La escala de presentación 0–100 no cambiará la
escala académica canónica.

## Decisiones para promedios

1. Una evaluación debe estar cerrada a cambios y sus resultados corregidos/
   finalizados para ser elegible. La finalización académica por estudiante o
   curso debe desacoplarse de la condición de cohorte completa que exige hoy
   la exportación matching.
2. Incluir solo una calificación válida por evaluación-estudiante. La política
   existente «último intento enviado y calificado» es el comportamiento
   provisional recomendado; cambiar a mejor intento o criterio institucional
   requiere una decisión explícita y migración lógica controlada.
3. Un estudiante sin entrega no obtiene cero automáticamente. Una calificación
   ausente se excluye; un intento activo, incompleto o cancelado no entra al
   promedio. Si un intento anterior sí fue calificado, se conserva ese último
   resultado válido según la política de intentos.
4. Sin ponderaciones académicas explícitas, el promedio es la media aritmética
   de las notas normalizadas a 0–20 de evaluaciones elegibles.
5. Si se acuerdan ponderaciones, se definen una sola vez en los metadatos de
   cada evaluación (por área y período definidos), se validan en servidor y se
   aplican solo a las calificaciones elegibles:
   `sum(nota20 * peso) / sum(pesos elegibles)`. Una entrega faltante no
   aporta cero ni peso al denominador. `weightPercent` heredado no se considera
   una ponderación académica hasta definir semántica y compatibilidad.
6. El documento de asignación es la única fuente de la nota de esa evaluación.
   El promedio se deriva de esas fuentes para no contar repetidamente varios
   intentos ni duplicar una evaluación.
7. Toda modificación de una calificación obliga a recalcular el agregado
   correspondiente desde las fuentes canónicas; los reintentos deben ser
   idempotentes. No hay recálculo de promedios implementado actualmente.

## SweetAlert2 y UX

`src/shared/lib/alerts.js` centraliza confirmaciones, errores, advertencias,
éxitos, acciones destructivas y confirmación de entrega final. El examen usa
el servicio para preguntar antes del envío. La API conserva la autoridad:
SweetAlert2 no sustituye ninguna validación, autorización, transacción ni
respuesta de error de backend.

Superficies que requieren rediseño móvil en fases posteriores:

- `AssessmentEditor`: formulario largo, asignación de estudiantes, constructor
  de preguntas y controles por pregunta; revisar orden, densidad y acciones en
  pantallas estrechas.
- `StudentAttempt`: progreso, navegación y acciones de guardar/finalizar; hacer
  más evidente qué se guarda automáticamente al navegar y qué persiste solo
  localmente.
- `ResultsPanel`: matriz con varias habilidades y desbordamiento horizontal;
  definir una presentación móvil sin ocultar puntajes ni estados.
- Listado y detalle de evaluación en `AssessmentsPage`: asegurar jerarquía de
  fechas, disponibilidad e intentos en ancho reducido.

## Archivos y módulos afectados o auditados

- Interfaz: `src/features/assessments/` — editor, examen, preguntas,
  resultados, listado, servicio, formularios y pruebas.
- Servicio HTTP y matching: `api/assessments.js`,
  `api/assessments/matching-profile.js`.
- Dominio y persistencia: `server/assessments/domain.js`,
  `server/assessments/service.js`, `server/firebaseAdmin.js`.
- Seguridad/persistencia: `firestore.rules`, `firestore.indexes.json`,
  `docs/FIRESTORE_SCHEMA.md`.
- Identidad/modelo relacionado: `src/contexts/AuthContext.jsx`,
  `src/features/dashboard/pages/StudentsPage.jsx`,
  `src/shared/constants/contracts.js`.
- Matching auditado, sin modificar: `src/features/matching/services/`,
  `src/features/matching/tests/`.
- Referencias anteriores: `docs/assessments-phase-2.md` a
  `docs/assessments-phase-5.md`, `docs/ARCHITECTURE.md`,
  `docs/API_CONTRACTS.md`.
- Cambios de esta fase: `package.json`, `package-lock.json`,
  `src/shared/lib/alerts.js`, `src/shared/lib/alerts.test.js`,
  `src/features/assessments/components/StudentAttempt.jsx`,
  `src/features/assessments/tests/StudentAttempt.test.jsx` y
  `src/features/assessments/components/AssessmentEditor.jsx`.

## Pendientes de las fases 2 a 5

- **Fase 2 — Dominio académico:** acordar institucionalidad, relación curso-
  aula, significado de área vs competencia, período académico, política de
  intentos y ponderaciones; formalizar el esquema compatible y las reglas de
  validación, sin borrar ni migrar destructivamente datos.
- **Fase 3 — Calificación y promedios:** introducir escala canónica 0–20,
  entrega/estado de corrección, elegibilidad, deduplicación por evaluación,
  promedio simple/ponderado y recálculo idempotente; pruebas de datos ausentes,
  múltiples intentos, cambios de nota y concurrencia.
- **Fase 4 — Experiencia docente/estudiante:** resolver la ambigüedad de guardar
  respuestas, rediseñar editor, resultados y examen móvil, y aplicar el
  servicio de alertas también a confirmaciones y acciones destructivas donde
  corresponda. Mantener mensajes de error del backend.
- **Fase 5 — Seguridad e integración:** corregir/retirar de forma segura la
  lectura legacy de `assessments`, validar esquema del payload y ACL, revisar
  matrícula y operaciones repetidas/concurrentes; validar exportación exacta
  de StudentKnowledgeProfile v1.0 sin modificar matching; ejecutar emuladores,
  pruebas, lint y build antes de cualquier despliegue.

## Validación de esta fase

- `npm run test:assessments:integration`: 8/8 pruebas pasan en emuladores
  locales.
- Pruebas focalizadas de alertas y evaluaciones: 39/39 pasan.
- `npm test`: 161 pasan y 8 fallan en dashboard, matching y galería del
  sistema de diseño; no corresponden a archivos de esta fase.
- `npm run lint`: falla por dos errores en archivos no modificados por esta
  fase: import `Alert` sin uso en `src/features/dashboard/pages/StudentsPage.jsx`
  (archivo con cambios locales previos) e import `React` sin uso en
  `src/features/matching/components/MatchingGroups.jsx`. El lint de los
  archivos modificados pasa.
- `npm run build`: pasa; Vite mantiene el aviso existente de bundle principal
  superior a 500 kB.

La instalación de SweetAlert2 notificó 8 vulnerabilidades moderadas en el
árbol de dependencias. No se ejecutó `npm audit fix` para evitar actualizar
dependencias ajenas al alcance; revisar los avisos en una tarea de dependencias.

## Límites

El repositorio incluye pruebas de dominio de evaluaciones, componentes React,
pruebas de matching y pruebas de integración con Firebase Auth/Firestore
Emulator. No se conectó a Firebase de producción, no se ejecutaron migraciones
ni se desplegó.

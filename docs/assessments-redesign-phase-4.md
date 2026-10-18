# KoEduko — Calificaciones, historial y promedios, Fase 4

## Resultado

La nota académica se calcula y persiste al entregar, usando el resultado que
calcula el servidor para el intento. El historial y los promedios se derivan
de las evaluaciones y asignaciones existentes; no se creó una colección
paralela ni un agregado que pueda quedar desactualizado. El estudiante consulta
solo sus notas y un docente puede consultar las evaluaciones propias del curso
autorizado y sus estudiantes matriculados.

## Modelo y persistencia

- La identidad estable del alumno es su UID de Firebase Authentication, usado
  como clave de `assessmentModules/{assessmentId}/assignments/{studentUid}`.
- `assessmentModules/{id}` conserva curso, área, puntaje máximo y configuración
  académica. `academicWeightPercent` es opcional y no reutiliza el campo
  heredado `weightPercent`.
- La asignación mantiene el resultado vigente y referencia el último intento
  enviado en `lastAttemptId`. El intento conserva respuestas, resultado y
  `academicGrade`; intentos anteriores siguen disponibles como historial, pero
  no se cuentan como notas adicionales.
- `academicGrade` registra `score20` sin redondear, puntaje bruto, máximo,
  estado `graded`, fecha de corrección e ID del intento fuente. El resultado
  bruto y los resultados por `skillId` se siguen guardando en `result`.
- La acción docente `regrade` vuelve a calificar las respuestas persistidas
  con la definición privada y la lógica objetiva del servidor. Solo si el
  resultado cambia actualiza asignación e intento y agrega
  `gradeChanges/{changeId}` con docente, fecha, valor anterior y nuevo.
- No se almacenan promedios redundantes: el endpoint `grades` calcula
  historial y agregados al consultar. Una recalificación queda reflejada en la
  siguiente lectura sin sincronizar cachés.

## Reglas de nota y promedio

1. Se normaliza cada resultado válido con `puntaje bruto / puntaje máximo * 20`.
   El servidor conserva precisión completa; la presentación redondea a dos
   decimales.
2. El promedio se agrupa por estudiante, curso y área, con una sola fila por
   evaluación y el resultado vigente del último intento enviado.
3. Solo participan resultados con estado `graded` y resultado válido.
   Evaluaciones pendientes, intentos activos e incompletos aparecen en el
   historial, pero no se convierten a cero ni entran en el promedio.
4. Si ninguna evaluación calificada tiene `academicWeightPercent`, se usa
   promedio aritmético. Si todas tienen peso válido (> 0 y <= 100), se
   normalizan los pesos entre las evaluaciones calificadas y se calcula el
   promedio ponderado; no se exige que la suma original sea 100.
5. Una combinación de evaluaciones calificadas con y sin peso produce un
   error de configuración visible, en lugar de mezclar fórmulas implícitamente.
   `weightPercent` permanece compatible, pero no participa en la nota ni en
   el promedio.

## API, autorización e idempotencia

- `POST /api/assessments`, acción `grades`: un estudiante recibe su propio
  historial; cualquier `studentId` del payload se ignora. El docente debe
  indicar un curso cuya ACL le pertenece. Solo se incluyen evaluaciones de su
  autoría y estudiantes de la matrícula ACL.
- `POST /api/assessments`, acción `regrade`: requiere docente responsable y
  estudiante asignado, y recalcula solo el último intento calificado. La nota
  nunca se acepta como valor enviado por el cliente.
- La entrega ya persiste resultado bruto, calificación normalizada, estado y
  marca temporal dentro de la misma transacción que finaliza el intento. La
  respuesta repetida devuelve el resultado ya guardado; no crea otra
  calificación.
- La recalificación lee y modifica intento, asignación y auditoría dentro de
  una transacción. Dos solicitudes concurrentes no generan doble auditoría si
  la primera ya dejó el resultado actualizado.
- Firestore Rules mantienen denegada la lectura/escritura directa de intentos,
  resultados, auditoría y notas; las rutas usan Firebase Auth y Firebase Admin
  SDK.

## Contrato de matching

La Fase 4 no modifica el algoritmo ni los nombres de propiedad de
`StudentKnowledgeProfile v1.0`. La calificación académica se añade al lado del
resultado actual sin cambiar su estructura. La recalificación actualiza el
resultado oficial del último intento; la exportación existente sigue exigiendo
evaluación finalizada y datos completos. No se crean perfiles desde intentos
incompletos.

## Interfaz

- El estudiante accede a «Mis calificaciones», agrupadas por área con nota,
  fecha y estado; los promedios se destacan y los pendientes no muestran una
  nota ficticia.
- El docente abre «Historial y promedios por área» desde resultados y puede
  consultar notas por alumno. La recalificación solicita confirmación,
  refresca resultados e historial y muestra si hubo cambios.
- Las vistas reutilizan componentes accesibles y tabla con desplazamiento
  horizontal contenido en pantallas estrechas.

## Archivos afectados en la Fase 4

- `server/assessments/gradebook.js`
- `server/assessments/service.js`
- `server/assessments/domain.js`
- `server/assessments/integration.test.js`
- `src/features/assessments/components/GradeHistoryPanel.jsx`
- `src/features/assessments/components/AssessmentEditor.jsx`
- `src/features/assessments/components/ResultsPanel.jsx`
- `src/features/assessments/pages/AssessmentsPage.jsx`
- `src/features/assessments/tests/domain.test.js`
- `src/features/assessments/tests/GradeHistoryPanel.test.jsx`
- `src/features/assessments/tests/AssessmentsPage.student.test.jsx`
- `src/features/assessments/utils/forms.js`
- `src/features/assessments/utils/validation.js`
- `docs/FIRESTORE_SCHEMA.md`
- `docs/API_CONTRACTS.md`

## Validación

- Pruebas de dominio e interfaz focalizadas: **51/51 pasaron**.
- Integración Firebase Emulators: **9/9 pasaron**, incluida persistencia,
  promedio 10/20 + 16/20 = 13/20, segundo intento, nota pendiente, consulta por
  docente/estudiante, recalificación concurrente, auditoría y permisos.
- Suite completa: **203/210 pasaron**. Los 7 fallos se encuentran en suites
  de dashboard y matching, no en el módulo de evaluaciones.
- `npm run lint`: los archivos focalizados de evaluaciones pasan ESLint. El
  lint global reporta dos errores no pertenecientes a los archivos de esta
  fase: `src/features/dashboard/pages/StudentsPage.jsx` (import `Alert` sin
  uso) y `src/features/matching/components/MatchingGroups.jsx` (import `React`
  sin uso).
- El contrato `StudentKnowledgeProfile v1.0` conserva la forma y pasa su prueba
  de integración existente.
- Build de producción: **pasó**. Vite reporta el aviso ya existente de un
  bundle principal mayor de 500 kB.

## Riesgos y pendientes para la Fase 5

- La ACL de cursos continúa siendo la autoridad de matrícula del módulo. La
  relación entre esa matrícula y `classrooms` / `students` permanece fuera de
  este cambio.
- Los pesos académicos se normalizan respecto del conjunto de evaluaciones
  calificadas. La institución debe confirmar si espera otra semántica cuando
  una evaluación ponderada todavía no se ha corregido.
- Las preguntas abiertas requieren un flujo de revisión docente antes de
  considerarse calificadas; la calificación automática actual se limita a
  preguntas objetivas existentes.
- Completar pruebas visuales con navegador en anchos móviles/escritorio y
  revisar accesibilidad de tablas extensas.
- Resolver o revisar los fallos de las suites generales de dashboard y
  matching fuera del alcance de esta fase.

No se modificaron el algoritmo de matching, sesiones ni tutor IA. No se
realizaron migraciones destructivas, commits, pushes ni despliegues.

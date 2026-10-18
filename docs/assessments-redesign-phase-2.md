# KoEduko — Rediseño del constructor de evaluaciones, Fase 2

## Resultado

El editor docente se reorganizó en cuatro secciones: información general,
configuración, preguntas y revisión/publicación. Conserva la experiencia y
persistencia actuales de borrador, asignación, vista previa, preguntas
objetivas, retroalimentación, fechas e intentos; no crea endpoints ni colecciones
de evaluaciones nuevos.

Se implementó el campo opcional de descripción y la selección explícita de
área. Para no inventar entidades duplicadas ni inferir que área equivale a
competencia, el catálogo autorizado es `areas: [{ id, label }]` dentro del
documento ACL `assessmentCourseAccess/{courseId}` y la evaluación conserva
`areaId` junto a su `competencyId`. El servidor verifica ambos contra los
catálogos del curso. No se migraron ni borraron documentos existentes.

## Experiencia del constructor

- **Información general:** nombre, curso autorizado, área ACL, competencia
  autorizada, tipo y descripción opcional.
- **Configuración:** escala de presentación existente, puntaje máximo total,
  duración, fechas, intentos, retroalimentación y matrícula de estudiantes.
- **Preguntas:** enunciado, tipo objetivo, habilidad autorizada, alternativas
  editables de opción múltiple, una respuesta correcta mediante radio, puntaje
  por pregunta y explicación opcional. Verdadero/falso conserva sus dos
  alternativas estándar. Añadir o quitar opciones respeta el rango 2–6.
- **Revisión:** resumen de puntajes, preguntas, curso/área, estudiantes,
  advertencias y acciones de borrador/publicación.
- La navegación por secciones usa enlaces accesibles por teclado. El diseño
  usa las tarjetas y campos existentes, con grids adaptables y controles
  flexibles en ancho móvil.
- Eliminar preguntas, cambiar de curso si se descartan preguntas, salir con
  cambios y publicar requieren confirmación SweetAlert2. Un aviso de salida
  del navegador protege los cambios no guardados.
- Los errores locales quedan bajo el campo correspondiente. Los errores de
  backend se muestran en SweetAlert2 y, cuando se puede reconocer el campo,
  también junto a este. El estado de carga conserva el bloqueo de operaciones.
- Se quitaron «Ponderación prevista (%)» y el antiguo panel separado de
  configuración. El campo persistido `weightPercent` no se elimina ni se usa
  para cambiar el puntaje de pregunta, nota o promedio.

## Validación implementada

La utilidad frontend `src/features/assessments/utils/validation.js` proporciona
feedback inmediato. El servidor continúa siendo autoridad mediante
`validateAssessment` en `server/assessments/domain.js`; no se confía en las
validaciones visuales para permisos o persistencia. Al publicar, el cierre debe
estar en el futuro, igual que exige el servidor; los borradores pueden conservar
fechas vencidas mientras se editan.

Se validan en cliente y servidor: título no vacío y longitud máxima de 200;
curso, área y competencia autorizados; descripción de hasta 3000 caracteres;
fechas parseables y ordenadas; duración positiva de hasta 1440 minutos para
nuevas evaluaciones; intentos enteros entre 1 y 10; puntaje total positivo;
preguntas hasta 60; enunciados hasta 2000 caracteres; alternativas de 2 a 6 y
hasta 500 caracteres; alternativa no vacía al publicar; selección correcta
única y dentro de rango; habilidad autorizada; puntajes enteros de pregunta
entre 1 y 1000; explicación hasta 2000 caracteres; y suma de pregunta igual al
puntaje máximo al publicar.

Los duplicados exactos de enunciado se bloquean con normalización Unicode NFC,
espacios y mayúsculas/minúsculas. Las alternativas duplicadas también se
bloquean con normalización equivalente. El formulario calcula similitud léxica
Jaccard de tokens; con similitud de al menos 0.8 muestra una advertencia y pide
confirmación docente. Esa heurística solo advierte y no reescribe ni bloquea
contenido. No hay comparación algebraica ni se bloquean respuestas
matemáticamente equivalentes.

Un borrador puede conservar enunciados o alternativas todavía vacíos y una
pregunta sin selección final. Esos datos no se pueden publicar hasta completar
la validación. El servidor sigue validando estructura, identificadores,
catálogos y límites también al guardar borradores.

## Compatibilidad y seguridad

- No se cambió `POST /api/assessments` ni la política de permisos: el endpoint
  verifica el ID token; `server/assessments/service.js` resuelve rol, ACL y
  titularidad desde Firestore.
- La publicación sigue validando a cada estudiante asignado y persiste estado,
  definición privada, preguntas públicas sanitizadas y asignaciones en una
  transacción. Las respuestas correctas y explicaciones siguen en
  `private/definition`; la publicación al estudiante no las expone.
- Los borradores y las preguntas admitidas usan las colecciones y acciones
  existentes. No se cambió el contrato StudentKnowledgeProfile v1.0, matching,
  sesiones, Meet ni tutor IA.
- `areas` es opcional al leer el documento ACL para compatibilidad de lectura,
  pero una evaluación nueva o editada debe incluir un `areaId` presente en el
  catálogo autorizado. Los administradores deben aprovisionar áreas en cursos
  existentes antes de continuar editando o publicando evaluaciones; no se
  inventa una asociación área-competencia ni se ejecuta una migración.
- Para compatibilidad, una evaluación existente con duración cero puede
  guardarse si conserva su ID. Las evaluaciones nuevas requieren duración
  positiva. Al editar un documento heredado, el editor indica el valor sin
  límite y permite cambiarlo a uno positivo.
- El campo heredado `weightPercent` sigue validado, preservado y almacenado por
  backend; queda fuera del formulario hasta acordar su semántica académica.

## Archivos afectados

- `src/features/assessments/components/AssessmentEditor.jsx`
- `src/features/assessments/components/QuestionEditor.jsx`
- `src/features/assessments/utils/forms.js`
- `src/features/assessments/utils/validation.js`
- `src/features/assessments/tests/AssessmentEditor.test.jsx`
- `src/features/assessments/tests/validation.test.js`
- `src/features/assessments/tests/domain.test.js`
- `server/assessments/domain.js`
- `server/assessments/service.js`
- `server/assessments/integration.test.js`
- `docs/FIRESTORE_SCHEMA.md`

## Validación de calidad

- Pruebas de `src/features/assessments/tests`: **63/63 pasaron**.
- Integración de evaluaciones en Firebase Emulators: **8/8 pasaron**, incluyendo
  permisos, reglas Firestore, publicación, protección de respuestas y contrato
  matching.
- ESLint focalizado en los archivos del módulo de evaluaciones modificados:
  **pasó**.
- `npm run build`: **pasó**. Vite mantiene el aviso de bundle principal mayor
  que 500 kB.
- Suite completa `npm test`: **190/196 pasaron**. Los 6 fallos corresponden a
  suites de dashboard y matching; las 5 suites de evaluaciones pasan cuando se
  ejecutan focalizadamente.
- `npm run lint`: no pasa por dos errores fuera de los archivos de esta fase:
  `src/features/dashboard/pages/StudentsPage.jsx` (import `Alert` sin usar) y
  `src/features/matching/components/MatchingGroups.jsx` (import `React` sin
  usar). No se modificaron para evitar cambios no relacionados.

No se conectó a producción, no se migraron datos y no se desplegó.

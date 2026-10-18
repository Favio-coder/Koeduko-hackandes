# KoEduko — Fase 3: examen interactivo del estudiante

## Alcance entregado

La pantalla `/assessments` mantiene el listado autorizado que entrega
`bootstrap`. El estudiante puede abrir evaluaciones asignadas, ver si el plazo
está abierto y si le quedan intentos, e iniciar o retomar el intento. El examen
muestra una pregunta por pantalla, alternativas accesibles, progreso, estado de
pregunta sin responder y controles de anterior/siguiente. En móvil los
controles se ajustan con envoltura flexible y el contenido mantiene un ancho
legible en escritorio.

Las respuestas se guardan en el servidor al navegar y con el botón **Guardar
respuestas**. Un borrador local de `sessionStorage` recupera cambios recientes
de la misma revisión si se recarga la página. La copia local se valida contra
las preguntas y rangos de alternativas antes de restaurarse; el servidor sigue
siendo autoritativo y aplica control de revisión. El intento activo se retoma
con el mismo ID al volver a iniciar la evaluación.

Antes del envío se muestra una confirmación. El envío final persiste las
respuestas y bloquea el intento mediante la API autorizada; reintentar la misma
petición no crea otro intento ni reemplaza la primera entrega. La pantalla
completada también se muestra al volver a cargar el detalle de un intento ya
entregado. No se presenta una calificación en esta experiencia.

## Límites de seguridad y backend

No se crea infraestructura nueva. El cliente usa `assessmentRequest` y
`POST /api/assessments`; Firebase Authentication suministra el ID token y el
servidor valida identidad, rol, asignación, estado, fechas, intentos y revisión.
Firestore almacena respuestas mediante Firebase Admin SDK. El endpoint
`start` entrega preguntas sin `correctAnswer` ni `explanation`, y el envío
definitivo no permite editar las respuestas posteriormente.

Esta fase reutiliza las operaciones `start`, `saveAnswers` y `submit` que ya
existían en el servicio de evaluaciones. No añade el motor de calificación ni
cambia el contrato JSON de matching; la lógica de calificación preexistente en
el servidor queda fuera de los cambios de esta fase.

## Pruebas

```bash
npx vitest run src/features/assessments/tests/StudentAttempt.test.jsx \
  src/features/assessments/tests/AssessmentsPage.student.test.jsx
npm run test:assessments:integration
npm run lint
npm run build
```

Las pruebas de UI cubren el listado asignado, navegación, pregunta sin
responder, persistencia y recuperación local, envío confirmado, estado
completado y estructura adaptable. Las pruebas de integración con Auth y
Firestore Emulator cubren identidad autenticada, acceso autorizado y denegado,
ausencia de claves en preguntas, guardado real, recuperación del intento,
envío final idempotente, bloqueo de nuevos intentos y persistencia de la
entrega. Ninguna prueba usa un proyecto Firebase real.

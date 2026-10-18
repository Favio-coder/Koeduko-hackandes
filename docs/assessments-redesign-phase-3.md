# KoEduko — Experiencia del estudiante, Fase 3

## Resultado

Se rediseñó la vista de resolución priorizando pantallas estrechas, lectura
clara, selección accesible y avance entre preguntas. No se recibió una imagen de
referencia en esta sesión; la propuesta adapta las especificaciones visuales al
verde institucional y a los componentes existentes.

La cabecera identifica curso y evaluación, muestra un cronómetro numérico y
mantiene un mensaje neutral de acompañamiento. Cada pregunta se presenta con
texto amplio y alternativas en tarjetas seleccionables; la opción elegida tiene
un borde, fondo e indicador de selección visibles. El progreso cuenta preguntas
respondidas, no tiempo. La navegación anterior/siguiente se adapta a una fila
de botones en escritorio y una cuadrícula de ancho completo en móvil. El botón
«Finalizar examen» aparece al llegar a la última pregunta.

## Guardado y entrega

- Se eliminó el botón explícito «Guardar respuestas». Elegir una alternativa
  actualiza la UI y envía `saveAnswers` inmediatamente.
- Las solicitudes de guardado se serializan. Si hay otro cambio durante una
  petición, se envía después la revisión más reciente, evitando competir por la
  misma revisión optimista o guardar un valor antiguo al final.
- El estado de guardado distingue guardando, guardado y error. Un error de red
  conserva la respuesta visible y en `sessionStorage`, ofrece reintentar y
  vuelve a persistir un cambio local recuperado cuando se reabre el intento.
- «Siguiente» y «Anterior» solo cambian la pregunta; no envían peticiones.
- Antes de entregar, se advierten las preguntas pendientes y se navega a la
  primera sin responder. La entrega requiere confirmación de SweetAlert2, espera
  que el guardado actual termine y usa su revisión más reciente. Un bloqueo
  local evita solicitudes de envío duplicadas.
- En evaluaciones de diagnóstico/examen no se muestran aciertos, errores ni
  claves durante la resolución. Solo la práctica con `feedbackMode: immediate`
  mantiene la retroalimentación habilitada por el docente; el cliente muestra
  un mensaje neutral y su explicación, no la respuesta correcta.

## Cronómetro y vencimiento

Al iniciar o reanudar, el servidor devuelve `serverNow` junto al `attempt` y
calcula/persiste `attempt.expiresAt` según el plazo de la evaluación y su
duración. El cliente ancla el cronómetro a ese tiempo del servidor y al reloj
monotónico disponible, para que cambiar el reloj de pared durante la sesión no
reinicie el conteo. Al recargar, la acción `start` devuelve el mismo intento y
un nuevo ancla del servidor; la fecha de expiración guardada no cambia.

Se presenta `MM:SS` y, cuando queda al menos una hora, `HH:MM:SS`. Los avisos
accesibles se limitan a los umbrales de cinco minutos, un minuto y vencimiento,
sin anunciar cada segundo. Al llegar a cero, se bloquean selección y entrega,
se mantienen las respuestas ya guardadas y no se crea una nota ni se envía una
respuesta tardía automáticamente. El intento vencido no produce calificación;
el servidor lo rechaza con conflicto, y el siguiente inicio aplica la política
existente para reemplazarlo y contabilizar el intento.

`server/assessments/service.js` sigue validando `Date.now() < expiresAt` dentro
de la transacción tanto para `saveAnswers` como para `submit`; el contador del
navegador solo presenta tiempo y no es una autoridad de seguridad. La
autorización de asignación, el límite de intentos, la validación de alternativas,
la revisión y la idempotencia final siguen en el servidor.

## Archivos afectados

- `src/features/assessments/components/StudentAttempt.jsx`
- `src/features/assessments/components/QuestionCard.jsx`
- `src/features/assessments/tests/StudentAttempt.test.jsx`
- `server/assessments/service.js`
- `server/assessments/integration.test.js`

## Validación de calidad

- Pruebas del módulo de evaluaciones: **68/68 pasaron**.
- Integración de evaluaciones en Firebase Emulators: **8/8 pasaron**, con
  verificación del tiempo de servidor y rechazo de guardado/envío después del
  vencimiento.
- ESLint focalizado en los archivos afectados: **pasó**.
- `npm run build`: **pasó**; Vite conserva el aviso de bundle principal mayor
  de 500 kB.
- Suite completa `npm test`: **193/201 pasaron**. Los 8 fallos están en suites
  de design system, dashboard y matching; las suites de evaluaciones pasaron
  focalizadamente.

Las pruebas de UI validan autosave, cambios rápidos serializados, recuperación
local tras fallo de red, entrega confirmada y sin duplicados, preguntas sin
responder, cuenta regresiva con formato de hora, bloqueo al vencimiento y
estructura responsive. Los controles usan breakpoints móviles/escritorio; no
se ejecutó una inspección visual de navegador a resoluciones físicas de
320/375/390/768 px y escritorio.

No se modificaron matching, sesiones ni tutor IA. No se hicieron commits,
pushes ni despliegues.

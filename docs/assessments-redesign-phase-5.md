# KoEduko — Integración con matching y preparación para producción, Fase 5

## Arquitectura final

La Fase 5 conecta resultados y calificaciones existentes con la pantalla real
de matching sin crear colecciones o perfiles duplicados:

1. `POST /api/assessments` autentica cada operación con Firebase Authentication
   y `server/assessments/service.js` verifica rol, ACL del curso, titularidad y
   matrícula mediante Firebase Admin SDK.
2. El servidor valida intentos y alternativas, califica preguntas objetivas y
   guarda el resultado bruto y `academicGrade` en la transacción de entrega.
3. El historial y el promedio del área se derivan de evaluaciones y
   asignaciones canónicas. No se guarda un agregado que pueda quedar obsoleto.
4. El docente cierra y finaliza una evaluación cuando cada asignación tiene un
   resultado válido y no hay intentos abiertos.
5. Al elegir «Preparar perfiles para matching» desde resultados, la interfaz
   navega a `/matching?courseId=...&assessmentId=...`. La pantalla llama al
   endpoint autenticado `GET /api/assessments/matching-profile`, que construye
   el perfil en vivo desde asignaciones finalizadas y lo devuelve sin caché.
   Una recalificación posterior se refleja en la siguiente consulta.
6. El adaptador existente valida `StudentKnowledgeProfile v1.0` y solo expone
   habilidades con evidencia. El optimizador no se inicia hasta que el docente
   pulsa «Agrupar».

La preparación de perfiles es una proyección determinista de los resultados
canónicos, no una nueva colección ni un trabajo de emparejamiento en segundo
plano. Lecturas repetidas son idempotentes; no modifican notas, resultados ni
datos de matching. Una ruta de matching asociada a evaluación no recurre a
datos demo si hay errores de autenticación, autorización, estado o red.

## Contrato y reglas académicas

`StudentKnowledgeProfile v1.0` permanece exactamente con las propiedades:

```text
schemaVersion, courseId, assessmentId, competencyId, generatedAt, status,
students[{ studentId, overallScore, maxScore,
  skills[{ skillId, score, maxScore, mastery, evidenceCount }] }]
```

El endpoint comprueba la finalización, la integridad del resultado y la
asignación de cada estudiante. No añade notas normalizadas, promedios,
nombres, fechas de entrega ni otros campos al contrato. Por habilidad,
`mastery = score / maxScore`; `evidenceCount` es el número de preguntas
calificadas asociadas a esa habilidad. Habilidades sin evidencia no se
fabrican como puntaje cero. El promedio académico por área permanece separado
de mastery y no alimenta el algoritmo.

La nota se normaliza como `puntaje bruto / puntaje máximo * 20`. Se conserva
precisión completa y la UI presenta dos decimales. El promedio usa solo
resultados válidos corregidos, una evaluación por estudiante según el último
intento enviado. Sin pesos se calcula la media aritmética; con pesos
`academicWeightPercent` consistentes se normalizan y aplican esos pesos. Los
pendientes, intentos incompletos y evaluaciones no entregadas no son cero ni
entran al promedio. El campo legacy `weightPercent` se conserva sin efecto
académico.

## Seguridad y compatibilidad Vercel

- El endpoint de matching sigue siendo `GET` y verifica ID token, revocación,
  identidad docente, titularidad de la evaluación y acceso ACL al curso.
- Las respuestas correctas permanecen en `private/definition`. Las reglas de
  Firestore deniegan acceso cliente a las colecciones de evaluaciones y
  asignaciones; las pruebas de emulador ejercitan esas reglas.
- El endpoint establece `Cache-Control: no-store`. Los errores de estado
  incompleto, identidad y permisos no producen perfiles parciales ni perfiles
  demo.
- El proyecto usa Vercel con build `npm run build` y salida `dist`, según
  `vercel.json`. Las funciones API de `api/` usan Firebase Admin. `FIREBASE_SERVICE_ACCOUNT_JSON`
  debe permanecer como variable de entorno server-side de Vercel; no debe
  publicarse como variable `VITE_*`. La configuración cliente solo usa
  variables Firebase `VITE_*` públicas y está protegida por Auth y Rules.
- No se añadieron dependencias, colecciones, migraciones ni permisos.
- No se modificaron el algoritmo de optimización, el contrato compartido, Meet,
  sesiones o tutor IA.

## QA y resultados ejecutados

- Pruebas focalizadas de evaluaciones y del flujo de perfiles: **89/89
  pasaron**.
- Integración con Firebase Auth y Firestore Emulators: **9/9 pasaron**.
  Verifica publicación, envío, calificación, promedio, permisos, reglas,
  contrato v1.0, `mastery`, `evidenceCount` y regeneración del perfil después
  de una recalificación.
- Suite completa: **208/215 pasaron**. Los 7 fallos son los de base ya
  observados en dashboard/matching: 3 en dashboard y 4 en pruebas antiguas de
  matching que esperan datos/tamaños de grupos distintos. Las pruebas nuevas
  de integración y servicio de perfiles sí pasan.
- `npm run lint`: falla por dos errores fuera de esta integración:
  `Alert` sin uso en `src/features/dashboard/pages/StudentsPage.jsx` y `React`
  sin uso en `src/features/matching/components/MatchingGroups.jsx`. ESLint
  focalizado en los archivos de esta fase: pasó.
- `npm run build`: pasó. Se mantiene el aviso Vite por el chunk Firebase de
  **577.69 kB** minificado (>500 kB).
- Vercel CLI local: `vercel` está instalado, pero no existe vínculo de proyecto
  `.vercel/project.json` y falta `FIREBASE_SERVICE_ACCOUNT_JSON` en el entorno
  actual. Por tanto, no se ejecutó `vercel dev`, que requeriría enlazar un
  proyecto y obtener credenciales privadas. No se expusieron ni se añadieron
  secretos.
- No se ejecutó una prueba visual en dispositivos reales ni se desplegó.

Las pruebas de UI anteriores cubren guardado automático, reanudación,
cronómetro, vencimiento, entrega, interacción por teclado y layout responsive
adaptable. La prueba de integración nueva verifica la lectura autenticada del
perfil desde la ruta real de matching, la ausencia de fallback demo ante error
y que el worker solo se construye después de la acción docente. La integración
de emulador verifica el formato exacto v1.0 y actualización del perfil después
de recalificar.

## Cambios de la Fase 5

- `src/features/assessments/components/ResultsPanel.jsx`: sustituye la descarga
  JSON por navegación autenticable a matching al finalizar.
- `src/features/assessments/services/assessmentService.js`: elimina el helper
  de descarga manual; las acciones de evaluaciones existentes permanecen.
- `src/features/matching/pages/MatchingPage.jsx`: carga el perfil seleccionado
  automáticamente, conserva el estado de carga/error y nunca usa demo como
  fallback en una integración fallida.
- `src/features/matching/services/assessmentProfileService.js`: llama al
  endpoint existente con un ID token. La importación de Firebase Auth es
  diferida para no cargarla en la ruta demo sin evaluación.
- Pruebas: `ResultsPanel.test.jsx`,
  `MatchingAssessmentIntegration.test.jsx`,
  `assessmentProfileService.test.js` y ampliación de
  `server/assessments/integration.test.js`.
- Documentación: este archivo, `src/features/matching/README.md` y
  `docs/API_CONTRACTS.md`.
- No se modificaron `server/assessments/domain.js`, el endpoint,
  `matchingAlgorithm.js`, contratos compartidos o Firestore Rules.

## Problemas pendientes

- La suite completa ya tenía fallos documentados en matching y dashboard antes
  de esta fase; volver a ejecutar y reportar el conteo actualizado antes de
  aprobar producción.
- El lint global tiene dos errores ajenos a esta integración: `Alert` sin uso
  en `src/features/dashboard/pages/StudentsPage.jsx` y `React` sin uso en
  `src/features/matching/components/MatchingGroups.jsx`.
- No se pudo ejecutar Vercel Dev sin enlazar un proyecto ni configurar de forma
  segura las variables privadas de Firebase Admin.
- El adaptador de matching admite solo la competencia y los identificadores de
  habilidad implementados por el módulo actual. Evaluaciones válidas con
  competencias o habilidades no soportadas deben mostrar error; no se inventan
  equivalencias ni se altera el algoritmo en esta fase.
- Antes de producción, ejecutar QA de navegador a 320, 375, 390, 768 px y
  escritorio, y confirmar el acceso a la evaluación/perfil con cuentas de
  prueba en un entorno staging conectado.

## Guía de despliegue

No se publica en producción en esta fase. Para preparar una publicación
posterior, con autorización explícita:

1. Resolver o aceptar formalmente los fallos de la suite global y lint.
2. Enlazar el proyecto Vercel correcto y configurar las variables cliente
   Firebase `VITE_FIREBASE_*` y `FIREBASE_SERVICE_ACCOUNT_JSON` en los entornos
   correspondientes; verificar que la cuenta de servicio tenga solo los
   permisos Firebase requeridos.
3. En staging, ejecutar `vercel dev` con secretos locales fuera del repositorio
   y validar Auth, Functions y el endpoint de matching contra el proyecto de
   staging/emuladores, nunca accidentalmente contra producción.
4. Ejecutar `npm test`, `npm run test:assessments:integration`,
   `npm run lint` y `npm run build`.
5. Revisar el diff y los cambios de entorno, crear un preview deploy y aprobar
   manualmente el despliegue de producción cuando los checks estén verdes.
6. Validar publicación, entrega, notas, promedio, lectura de perfil matching y
   rechazo de acceso no autorizado en producción con cuentas designadas.

## Procedimiento de rollback

El cambio no incluye migraciones ni escrituras de perfiles redundantes, por lo
que el rollback es de código/configuración:

1. En Vercel, seleccionar la última implementación de producción conocida como
   estable y volver a promoverla siguiendo el procedimiento de rollback del
   proyecto.
2. Verificar que vuelvan a funcionar `POST /api/assessments`,
   `GET /api/assessments/matching-profile` y autenticación.
3. No borrar evaluaciones, intentos, notas o auditorías. No rotar ni cambiar
   secretos salvo que haya una sospecha concreta de exposición; si ocurre,
   rotarlos en Vercel y Firebase, nunca en el código.
4. Si se revierte la interfaz, el contrato y el endpoint se mantienen para
   consumidores existentes; ocultar nuevamente la entrada del adaptador no
   invalida las notas guardadas.

No se realizó despliegue, commit, push, migración destructiva ni cambio de
permisos Firestore.

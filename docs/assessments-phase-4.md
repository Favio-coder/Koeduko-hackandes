# KoEduko — Fase 4: calificación y contrato de matching

## Calificación y persistencia

Las preguntas objetivas se califican en `server/assessments/domain.js`, en el
servidor, usando las respuestas enviadas y la definición privada almacenada en
`assessmentModules/{assessmentId}/private/definition`. No se usa IA. Cada
pregunta correcta suma sus puntos enteros y cada pregunta incorrecta suma cero.

`grade` agrega evidencia solo para los `skillId` presentes en preguntas
calificadas:

- `overallScore`: puntos brutos obtenidos.
- `maxScore`: puntos brutos máximos configurados.
- Por conocimiento: `score`, `maxScore`, `mastery = score / maxScore` y
  `evidenceCount` como número de preguntas asociadas.

La conversión a nota se guarda aparte en `scaledScore`:
`round(overallScore / maxScore * scale, 2)`. No sustituye ni modifica los
puntajes brutos ni el contrato StudentKnowledgeProfile. La transacción del
envío final persiste respuestas, revisión, resultado, nota convertida y fecha
de calificación en el intento y en la asignación. Repetir un envío ya
calificado devuelve el resultado persistido y no recalcula ni duplica evidencia.

La validación del resultado exige puntajes enteros en rango, `mastery` entre 0
y 1, evidencia positiva y sumas consistentes. No se crean registros de
conocimiento sin preguntas/evidencia.

## Panel docente

`src/features/assessments/components/ResultsPanel.jsx` consulta los resultados
del servidor y muestra:

- estudiante, estado e intentos;
- puntaje bruto obtenido/máximo, separado de nota en escala docente;
- matriz de conocimientos con mastery, puntaje bruto, máximo y cantidad de
  preguntas con evidencia;
- “Sin evidencia” para conocimientos que no aparecen en las preguntas del
  intento;
- controles de cierre/finalización deshabilitados cuando hay resultados
  pendientes.

El servidor vuelve a validar las condiciones al finalizar; no confía en el
estado de los botones del cliente. No se modifica el algoritmo de matching.

## Endpoint de exportación

`GET /api/assessments/matching-profile?courseId=...&assessmentId=...` verifica
Firebase ID token, rol docente, ACL del curso, titularidad de la evaluación y
estado finalizado. Rechaza parámetros ausentes y evaluaciones no finalizadas o
con resultados incompletos.

Una respuesta exitosa contiene exactamente estas propiedades y ninguna
adicional:

```json
{
  "schemaVersion": "1.0",
  "courseId": "id-real-del-curso",
  "assessmentId": "id-real-de-la-evaluacion",
  "competencyId": "id-real-de-la-competencia",
  "generatedAt": "fecha-de-finalizacion",
  "status": "finalized",
  "students": [
    {
      "studentId": "uid-real",
      "overallScore": 8,
      "maxScore": 10,
      "skills": [
        {
          "skillId": "addition",
          "score": 5,
          "maxScore": 5,
          "mastery": 1,
          "evidenceCount": 1
        }
      ]
    }
  ]
}
```

Los valores del ejemplo son ilustrativos. El endpoint usa resultados
persistidos y verificados; comprueba que cada asignación esté calificada y no
tenga intento activo antes de construir el JSON. `generatedAt` corresponde a
la fecha de finalización persistida. La estructura v1.0 y su orden de
propiedades se mantienen; no se agregan campos ni se incluyen campos de nota
escalada, respuestas o explicación.

## Pruebas

```bash
npx vitest run src/features/assessments/tests/domain.test.js
npm run test:assessments:integration
npm run lint
npm run build
```

La suite prueba calificación, agregación por conocimiento, mastery,
evidenceCount, integridad de sumas, escala 0–100 independiente de puntaje
bruto, envío idempotente, autorización, forma exacta del JSON y denegación de
exportación incompleta. Las pruebas de backend usan Auth y Firestore Emulator.

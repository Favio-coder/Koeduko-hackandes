# Especificación de investigación para el emparejamiento de KoEduko

Esta especificación concreta la [guía y sus fuentes](README.md). Incluye una prueba computacional con 40 perfiles simulados. No supone que el diagnóstico esté calibrado ni que el efecto educativo haya sido demostrado.

## Decisión 1: definir la actividad antes de evaluar al compañero

Primera unidad: fracciones aditivas en quinto de primaria. Las seis dimensiones U/M/E/P/T/J del banco describen desempeño observado. No son personalidades ni capacidades estables.

El matching debe devolver **grupo + contenido + roles iniciales + apoyos + motivos**. La propuesta es que dos estudiantes trabajen una actividad pertinente, no que se agrupen porque sus números sean distantes.

Por ejemplo, una sesión puede incluir equivalencia y cálculo con denominadores distintos. Una fortaleza en representación puede aportar una explicación de equivalencia; una fortaleza en cálculo puede aportar el procedimiento. Debe existir una tarea que conecte esos aportes. La discrepancia entre puntajes, por sí sola, no garantiza esa conexión.

## Decisión 2: separar cuatro familias de datos

| Familia | Variables | Función |
| --- | --- | --- |
| Desempeño matemático | Unidad/representación, magnitud, equivalencia, procedimiento aditivo, traducción, justificación | Identificar evidencia de fortalezas y necesidades pertinentes |
| Preparación para una tarea | Prerrequisitos de esa actividad y evidencia disponible | Evitar proponer una actividad que necesite aprendizajes previos aún no observados |
| Calidad de evidencia | Tareas observadas, puntos, respuestas, versión, eventos técnicos, rúbrica | Distinguir desconocimiento de datos insuficientes y revisar decisiones |
| Restricciones de participación | Aula, disponibilidad, accesibilidad y prohibiciones docentes explícitas | Determinar candidatos permitidos; no aumentar una supuesta capacidad matemática |

La preparación para aprender una tarea no es equivalente a una nota media ni a una medida validada de zona de desarrollo próximo. Es una regla pedagógica provisional que se debe comprobar con el docente y el estudiante.

## Decisión 3: representar prerrequisitos por actividad

Además del vector de desempeño, definir metadatos del banco de actividades. Ejemplo de propuesta, pendiente de revisión:

```javascript
{
  activityId: 'equivalence-before-fraction-addition-v1',
  targetDimensions: ['equivalence', 'additiveProcedures'],
  prerequisiteEvidence: ['identifyCommonUnit', 'recognizeEqualParts'],
  participationProtocol: 'represent-explain-solve-check',
}
```

Si falta evidencia de prerrequisitos, la ruta es completar el diagnóstico o usar una actividad preparatoria con apoyos. No declarar que el estudiante «no puede aprender» ni hacer que una regla automática sustituya el juicio docente.

Los grafos cumplen aquí dos funciones distintas:

1. Un mapa de dependencias de **tareas/contenidos** ayuda a elegir actividades y apoyos.
2. Un grafo de **estudiantes y grupos candidatos** sirve para optimizar la asignación.

Los arcos de prerrequisitos deben proponerse y revisarse pedagógicamente. Una correlación entre dos puntajes no demuestra que una habilidad sea prerrequisito causal de otra.

## Decisión 4: elegir un objetivo explícito de optimización

El prototipo evalúa dos alternativas exactas:

**A. Utilidad total:** maximizar la suma Q(G) de oportunidades y preferencia recíproca descrita en la guía.

**B. Cobertura primero:** entre particiones completas, maximizar primero cuántos estudiantes tienen alguna oportunidad positiva de recibir apoyo según esa fórmula; después maximizar Q(G).

La alternativa B usa orden lexicográfico, no pesos elegidos al azar para ocultar prioridades. La cobertura completa de personas, tamaños y restricciones se aplica antes en ambas alternativas. No se fuerza una oportunidad cuando la información no la permite.

En el prototipo, «oportunidad positiva» significa una diferencia favorable en al menos una coordenada, ponderada por el margen de mejora. No es ayuda observada ni mejora pronosticada. Una diferencia pequeña puede deberse al error de medición: antes de usarla en una decisión real debe definirse qué evidencia basta y cómo se revisan casos inciertos.

Para una primera evaluación de KoEduko orientada a reciprocidad, llevaría B como hipótesis principal y A como comparación. Eso refleja una prioridad del proyecto por la participación de todos, no una prueba de superioridad educativa. La tutoría asimétrica sigue siendo una opción pedagógica y aprender al explicar no está completamente capturado por la fórmula.

## Decisión 5: comprobar el algoritmo con resultados completos

Se ejecutó el prototipo Node con `edmonds-blossom@1.0.0`, licencia MIT, conservado con su procedencia. Usa pesos enteros exactos para esta fixture de seis dimensiones y λ = 1. Es una implementación de investigación separada de la aplicación.

Resultados de la fixture de 40 estudiantes y 960 puntuaciones sintéticas:

| Regla de asignación | Utilidad Q total | Personas con oportunidad positiva según el modelo |
| --- | ---: | ---: |
| Óptimo de utilidad total | 11,546875 | 35 de 40 |
| Óptimo de cobertura y después utilidad | 10,403645833 | 40 de 40 |
| Greedy sobre Q | 10,533854167 | 36 de 40 |
| Parejas adyacentes por promedio | 7,5625 | 38 de 40 |
| Matching que maximiza coseno | 2,635416667 | 25 de 40 |

En 500 agrupamientos aleatorios, Q tuvo media 7,067703125 y máximo 9,424479167.

Estas comparaciones ilustran diferencias de objetivos en **una sola fixture artificial**. La utilidad favorece al método que la optimiza por construcción; no se deben presentar estos números como una comparación de aprendizaje, eficacia educativa o superioridad general sobre coseno.

Las dos primeras asignaciones contienen veinte parejas y cubren a los cuarenta una sola vez. La primera alcanza una puntuación mayor y deja menos personas con apoyo detectable. La segunda cumple una prioridad de cobertura antes de optimizar puntuación. Esta diferencia muestra por qué la palabra «óptimo» necesita un objetivo definido.

Tiempos de una ejecución local: aproximadamente 4 ms para el matching de utilidad con 40; aproximadamente 3,6 s para examinar todos los tríos del caso de 39. No son un benchmark estadístico ni una garantía de latencia del producto.

Para 39 estudiantes se evaluaron los 9 139 tríos posibles, resolviendo exactamente el matching de los otros 36 en cada caso. Se obtuvo una partición de 18 parejas y un trío con utilidad 11,713541667. No comparar directamente ese total con el de 40 como si midieran eficacia: cambia la población y un trío permite otro tipo de cobertura.

## Decisión 6: restricciones y resultado que debe ver el docente

Política: 0 → sin grupos; 1 → espera/apoyo individual; par → parejas; impar ≥ 3 → un trío y el resto parejas, si las restricciones permiten cobertura completa.

La salida del producto debería incluir:

```javascript
{
  status: 'optimal', // O feasible, infeasible, needsDiagnosis, empty, waiting.
  objectiveVersion: 'support-coverage-then-opportunity-v1',
  instrumentVersion: 'fractions-v1',
  groups: [{
    studentIds: ['student-A', 'student-B'],
    activityId: 'activity-selected-for-these-students',
    contributions: [/* evidencia por integrante y actividad */],
    supportFlags: [/* datos escasos, asimetrías, prerrequisitos por revisar */],
  }],
  pendingStudentIds: [],
}
```

Este es un contrato propuesto, no un campo que ya exista en Firestore. En particular, `Pair` y `pairId` del repositorio requieren evolución coordinada para admitir tríos.

## Qué quedó comprobado y qué sigue siendo hipótesis

Comprobado en esta demostración:

- Casos 0–9 contrastados con enumeración completa.
- Sesenta casos adicionales con vectores artificiales contrastados con enumeración.
- Restricciones de pareja, un caso imposible, datos ausentes, identificadores duplicados y perfiles iguales.
- Invariancia del resultado de 40 al invertir el orden de entrada con esta implementación.
- Veinte parejas para 40; dieciocho parejas y un trío para 39.
- Priorización lexicográfica contrastada con enumeración pequeña.

Pendiente antes de uso educativo:

- Validar banco, rúbricas, dimensiones, precisión y cortes.
- Incorporar preparación y actividad seleccionada a la puntuación. El prototipo ejecutado evalúa las seis dimensiones con igual peso y todavía no aplica esos prerrequisitos.
- Medir participación y ayuda real; no inferirlas de diferencias de puntaje.
- Evaluar aprendizaje individual bajo condiciones comparables.
- Revisar y probar la dependencia y la infraestructura antes de integración productiva.

## Reproducir

Desde la raíz del repositorio:

```powershell
node exa-results/koeduko-diagnostico-y-agrupamiento-2026-10-17/simular.mjs
node exa-results/koeduko-diagnostico-y-agrupamiento-2026-10-17/optimizar.mjs
```

Los datos y resultados se escriben en esa misma carpeta. El generador pequeño conserva sus propias comprobaciones en `comprobaciones.json`; la ejecución del optimizador completo queda en [resultado-optimizacion.json](resultado-optimizacion.json).

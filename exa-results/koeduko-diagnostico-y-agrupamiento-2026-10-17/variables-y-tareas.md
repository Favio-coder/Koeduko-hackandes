# Banco inicial propuesto: fracciones aditivas, quinto de primaria

Estas 24 tareas son propuestas originales para revisión docente y pilotaje. Los artículos citados en la [guía](README.md) fundamentan contenidos y mecanismos; no validan estos ítems ni estos puntos de corte. Revisar lenguaje, representaciones, accesibilidad y contenido efectivamente enseñado antes de aplicarlas.

Cada tarea tiene una dimensión principal para puntuar. Puede movilizar otras: los indicadores no son factores independientes. La simulación genera registros de puntos para estos identificadores, no respuestas textuales reales.

| ID | Dimensión | Consigna o especificación de la tarea | Evidencia/clave orientativa | Máximo |
| --- | --- | --- | --- | --- |
| U1 | Unidad/representación | Una tira está dividida en 4 partes iguales y 3 están coloreadas. Escribe la fracción coloreada | 3/4 de la tira completa | 1 |
| U2 | Unidad/representación | Se muestran dos figuras: una con cuatro partes iguales y otra con cuatro partes desiguales; ambas tienen una parte coloreada. ¿En cuál se garantiza 1/4 de la unidad? | En la de partes iguales; fijar gráficamente una partición desigual inequívoca | 1 |
| U3 | Unidad/representación | Representa 2/3 de una tira mediante una partición y coloreado | Tres partes iguales, dos coloreadas | 1 |
| U4 | Unidad/representación | Se cambia la unidad de referencia: dos barras iguales forman ahora una unidad. Una barra está coloreada. ¿Qué fracción de la nueva unidad está coloreada? | 1/2 | 1 |
| M1 | Magnitud/comparación | Compara 3/4 y 2/3 | 3/4 > 2/3 | 1 |
| M2 | Magnitud/comparación | Marca 3/4 en una recta de 0 a 1 con cuatro intervalos iguales | Tercera marca después de 0 | 1 |
| M3 | Magnitud/comparación | Decide si 2/3 está por debajo o por encima de 1/2 | Por encima | 1 |
| M4 | Magnitud/comparación | Ordena 1/3, 1/2 y 3/4 de menor a mayor | 1/3 < 1/2 < 3/4 | 1 |
| E1 | Equivalencia | Completa 1/2 = □/8 | 4 | 1 |
| E2 | Equivalencia | Decide si 2/3 y 4/6 representan la misma cantidad | Sí, con unidad común | 1 |
| E3 | Equivalencia | Escribe una fracción equivalente a 3/4 con denominador 8 | 6/8 | 1 |
| E4 | Equivalencia | Se muestran dos tiras de igual longitud: una con 1/2 coloreado y otra con 2/4. Decide si hay la misma cantidad coloreada | Sí; fijar misma unidad en los dibujos | 1 |
| P1 | Procedimiento aditivo | Calcula 2/7 + 3/7 y muestra pasos | 5/7 | 1 |
| P2 | Procedimiento aditivo | Calcula 5/6 − 1/6 y muestra pasos | 4/6 o 2/3; aceptar equivalentes | 1 |
| P3 | Procedimiento aditivo | Calcula 1/2 + 1/4 y muestra pasos | 3/4 | 1 |
| P4 | Procedimiento aditivo | Calcula 3/4 − 1/2 y muestra pasos | 1/4 | 1 |
| T1 | Traducción | Una receta usa 1/2 taza de un ingrediente y se agrega 1/4 de taza del mismo ingrediente. Escribe la operación para conocer el total; no la resuelvas | 1/2 + 1/4 | 1 |
| T2 | Traducción | De una cinta de 3/4 de metro se corta 1/4 de metro. Escribe la operación para conocer lo que queda | 3/4 − 1/4 | 1 |
| T3 | Traducción | Dos recorridos miden 1/3 y 1/6 de kilómetro. Escribe la operación para conocer la distancia conjunta | 1/3 + 1/6 | 1 |
| T4 | Traducción | Dos cantidades de agua son 3/4 y 1/2 de litro. Escribe la operación para saber cuánto mayor es la primera | 3/4 − 1/2 | 1 |
| J1 | Justificación | Un compañero propone 1/2 + 1/3 = 2/5. Explica si es correcto y por qué | No; los denominadores describen unidades fraccionarias diferentes. Justificación con representación o unidades comunes; no basta decir «está mal» | 2 |
| J2 | Justificación | Explica por qué 1/2 y 2/4 pueden señalar el mismo punto en una recta | Misma unidad y misma magnitud, aunque cambie la partición | 2 |
| J3 | Justificación | Un compañero afirma que 1/8 > 1/4 porque 8 > 4. Evalúa la afirmación | Con misma unidad, dividir en más partes iguales da partes menores; 1/8 < 1/4 | 2 |
| J4 | Justificación | Después de calcular 1/2 + 1/4, explica cómo comprobarías si el resultado tiene sentido | Una comprobación pertinente: representación, comparación de magnitudes o deshacer la operación; evaluar coherencia de la explicación | 2 |

Criterio para las tareas de J: 0, 1 o 2 según la rúbrica descrita en la guía. Construir ejemplos de respuestas para cada nivel y observar concordancia entre correctores. Para P, guardar los pasos aunque la puntuación inicial sea binaria: permiten distinguir errores y revisar la rúbrica más adelante.

Las tareas cercanas pueden dar pistas unas a otras. Alternar orden, preparar formas equivalentes y comprobar efectos durante el pilotaje. No aplicar la misma lista antes y después como única evidencia de aprendizaje: puede medir recuerdo de respuestas.

## Contrato de datos sugerido

```javascript
const item = {
  id: 'E1',
  primaryDimension: 'equivalence',
  maxPoints: 1,
  rubricVersion: 'proposal-v1',
  prerequisiteDimensions: [], // Metadato revisado por docente, no inferido automáticamente.
}

const scoredResponse = {
  studentId: 'sim-001',
  itemId: 'E1',
  responseStatus: 'answered', // También distinguir omitted, notPresented, interrupted.
  awardedPoints: 1,
  scoringSource: 'synthetic-generator', // En aplicación real: regla o corrector documentado.
  simulated: true,
}
```

No conceder automáticamente un punto en equivalencia porque un problema compuesto salió bien: identificar qué evidencia de la respuesta permite atribuirlo. Tampoco descontar simultáneamente en cinco dimensiones por una única cuenta incorrecta sin reglas explícitas.

## Prerrequisitos opcionales

Antes de una actividad, pueden añadirse tareas de multiplicación/división con naturales y de lectura de la situación. Deben separarse del diagnóstico principal y servir para elegir apoyos. La selección de factores o denominadores comunes no equivale a exigir un diagnóstico global de todas las operaciones. Si se incorporan al matching, hay que explicar su relevancia específica y validar las medidas.

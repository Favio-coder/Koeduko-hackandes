# KoEduko: del diagnóstico matemático a grupos explicables

Fecha de consulta: 17 de octubre de 2026. Propuesta de investigación y diseño para quinto de primaria; no es una validación de eficacia del producto.

La [especificación de decisiones](DECISIONES.md) concreta esta guía e incorpora el antecedente directo de Lechuga y Doroudi y la prueba ejecutada con 40 estudiantes. [Resultados reproducibles](resultado-optimizacion.json).

## 1. Recomendación concreta

Comenzar con **problemas de representación, comparación, equivalencia, adición y sustracción de fracciones en quinto de primaria**, dentro de «Resuelve problemas de cantidad». Construir perfiles a partir de respuestas y rúbricas, seleccionar una actividad pertinente y formar parejas —con un único trío si el número es impar— mediante optimización con restricciones.

La arquitectura propuesta combina dos herramientas:

- **Vectores explícitos:** representan evidencias del desempeño por dimensión. Cada coordenada tiene una definición y tareas que la sustentan.
- **Grafos y optimización:** seleccionan grupos sin repetir estudiantes y considerando el conjunto del aula.

No hay evidencia suficiente para identificar una lista universal de «mejores variables» ni una fórmula pedagógicamente óptima para KoEduko antes de evaluarlo. Sí es posible escoger variables defendibles y una solución matemáticamente óptima respecto de un objetivo declarado.

Flujo:

```text
Competencia y objetivo de sesión
    → tareas e indicadores observables
    → respuestas y corrección por rúbrica
    → perfil + cantidad/calidad de evidencia
    → ruta de actividad y apoyos
    → oportunidades de ayuda entre estudiantes
    → selección global de parejas/trío
    → explicación, revisión docente y sesión
    → evaluación individual y actualización del perfil
```

## 2. Por qué acotar el contenido a fracciones

El [Programa curricular de Educación Primaria del MINEDU](https://www.minedu.gob.pe/curriculo/pdf/programa-nivel-primaria-ebr.pdf#page=142), página impresa 142 —página 142 del PDF enlazado—, describe para quinto el trabajo con expresiones aditivas de fracciones, representaciones, estrategias de cálculo y justificación. El estándar del ciclo V abarca más contenidos que el desempeño específico de quinto: no se deben confundir ambas referencias.

La guía del [IES/What Works Clearinghouse sobre enseñanza de fracciones](https://ies.ed.gov/ncee/wwc/PracticeGuide/15) otorga evidencia moderada a reconocer fracciones como números y a comprender el sentido de los procedimientos. Esto respalda incluir magnitudes, representaciones y comprensión, además de cuentas. Otras recomendaciones de esa guía tienen evidencia mínima; no todas tienen el mismo nivel.

[Siegler et al. (2012)](https://doi.org/10.1177/0956797612440101) encontraron que el conocimiento de fracciones y división en primaria predecía desempeño matemático posterior en dos bases longitudinales. Es un argumento de relevancia del contenido, no prueba de que emparejar estudiantes en fracciones cause mejoras futuras.

Esta primera unidad **no equivale a evaluar toda la competencia de cantidad**, mucho menos toda la matemática. Naturales, decimales, proporcionalidad, geometría y datos requieren unidades y diagnósticos propios. La división y las equivalencias multiplicativas pueden evaluarse como prerrequisitos de apoyo, sin convertir automáticamente cada operación en un eje del matching.

## 3. Las seis dimensiones propuestas y su justificación

Las dimensiones siguientes son indicadores operativos del prototipo. No se afirma que sean seis factores psicológicos independientes ni escalas ya validadas.

| Código | Qué observar | Ejemplo original de tarea | Utilidad para la sesión | Fundamento |
| --- | --- | --- | --- | --- |
| U: unidad y representación | Identifica la unidad y partes iguales; relaciona figura y símbolo | Explicar por qué colorear 3 de 4 partes desiguales no garantiza representar 3/4 | Evitar que una cuenta correcta oculte errores sobre qué se está midiendo | MINEDU; IES; Hecht y Vagi 2010/2012 |
| M: magnitud y comparación | Ubica y compara fracciones mediante referencias y recta numérica | Comparar 3/4 y 2/3; ubicar 3/4 entre 0 y 1 | Discutir orden y plausibilidad de resultados | IES; Hecht y Vagi 2010/2012 |
| E: equivalencia | Reconoce y construye fracciones de igual valor y explica la conservación de la cantidad | Mostrar por qué 2/3 y 4/6 representan la misma cantidad | Conectar representaciones y denominadores comunes | MINEDU; IES |
| P: procedimientos aditivos | Resuelve adición y sustracción con fracciones en el alcance enseñado | Resolver 1/2 + 1/4 y registrar pasos | Identificar necesidades de práctica procedimental | MINEDU; Rittle-Johnson et al. 2015 |
| T: traducción de problemas | Construye una expresión matemática desde una situación, separando planteamiento y cálculo | Escribir la operación para sumar dos cantidades de una receta, sin resolverla | Distinguir un error de modelación de uno de cálculo | MINEDU; Hecht y Vagi 2010/2012 |
| J: justificación y análisis de errores | Explica una transformación o detecta un error matemático con una razón pertinente | Evaluar la afirmación 1/2 + 1/3 = 2/5 y justificar | Diseñar intercambios de explicaciones y comprobar comprensión | MINEDU; Fuchs et al. 1997 |

En un estudio de 181 estudiantes seguidos de cuarto a quinto, [Hecht y Vagi (2012)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3225691/) identificaron diferencias entre fortalezas conceptuales y procedimentales. No todos los estudiantes con dificultades de cálculo mostraban el mismo perfil conceptual. Los autores también advierten que las tareas conceptuales y procedimentales pueden movilizar ambos tipos de conocimiento: las medidas no son puras.

El estudio longitudinal relacionado de [Hecht y Vagi (2010)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3002259/) examinó cálculo, planteamiento de problemas y estimación con fracciones. Ambos trabajos utilizan la misma cohorte; no se deben contar como dos replicaciones independientes.

La revisión de [Rittle-Johnson, Schneider y Star (2015)](https://link.springer.com/article/10.1007/s10648-015-9302-x) sustenta que conocimiento conceptual y procedimental pueden apoyarse en ambas direcciones. Esto no demuestra que un estudiante fuerte en uno deba emparejarse siempre con otro fuerte en el otro.

**Qué cambia respecto del ejemplo actual:** `addition`, `subtraction` o `fraction` no son variables intrínsecamente incorrectas. Falta especificar su contenido, tareas, interpretación, precisión y pertinencia para la actividad. `fraction: 0.8` agrupa demasiadas cosas para explicar por qué se propone un compañero.

**Qué no incluir inicialmente como criterio automático:** popularidad, personalidad, «estilo visual/auditivo», sexo, rapidez bruta o una supuesta inteligencia obtenida del examen. Tampoco inferir atención, motivación o capacidad de colaborar únicamente por aciertos. Una variable puede predecir resultados en un estudio y aun así no ser apropiada, medible o necesaria para esta aplicación.

Registrar necesidades de accesibilidad, idioma de interacción y restricciones docentes cuando sean pertinentes para participar. Son condiciones de la actividad, no etiquetas de capacidad matemática.

## 4. ANTES: diseñar un examen que produzca evidencia interpretable

[Mislevy, Almond y Lukas (2003), diseño centrado en evidencias](https://www.ets.org/research/policy_research_reports/publications/report/2003/hsgs.html), proporciona el principio: definir qué se quiere inferir, qué desempeño lo sustentaría y qué tarea permitiría observarlo. La elección de variables precede al algoritmo.

Propuesta inicial, pendiente de revisión docente y pilotaje:

1. Un banco con 24 tareas breves: cuatro por cada dimensión U, M, E, P, T y J. Ajustar duración después del piloto; 24 no es una cantidad validada por los artículos.
2. Mezclar tareas gráficas, respuestas numéricas, elección de expresiones y explicaciones. No reducir J a acertar una alternativa.
3. Para P, incluir denominadores iguales y diferentes y problemas del contenido ya enseñado. No incorporar división de fracciones por copiar una prueba extranjera.
4. Para T, corregir el planteamiento por separado del cálculo: una cuenta equivocada no invalida una expresión bien construida.
5. Para U/M/E/P/T, usar inicialmente criterios de acierto 0/1 por tarea; para J, una rúbrica 0/1/2. Se pueden incorporar rúbricas parciales en las demás dimensiones tras definirlas.
6. Registrar ausencia, omisión, interrupción técnica y respuesta incorrecta como eventos distintos. Definir de antemano cómo se puntúan omisiones; un ítem no presentado nunca es evidencia de incapacidad.

Rúbrica inicial de J: 0 = sin justificación válida o con contradicción central; 1 = identifica una idea pertinente pero incompleta; 2 = presenta una razón matemática suficiente y coherente para la tarea. Es una propuesta que exige ejemplos de anclaje y revisión de concordancia entre correctores. La extensión del texto y la ortografía no deben sustituir la calidad matemática.

Banco sugerido: ver [variables-y-tareas.md](variables-y-tareas.md). Las tareas son originales del prototipo; no constituyen una prueba estandarizada ni una reproducción de los instrumentos citados.

### Cómo obtener el número de cada coordenada

Para estudiante i y dimensión k:

```text
p[i,k] = suma de puntos obtenidos / suma de puntos posibles
         en las tareas efectivamente puntuadas de esa dimensión
```

Ejemplo: tres aciertos en cuatro tareas de equivalencia producen `observedScore = 0.75`. No significan una probabilidad calibrada de 75 % de dominio de la equivalencia. Con cuatro tareas, el indicador es poco preciso y cambia considerablemente por una sola respuesta.

Guardar junto al puntaje:

```javascript
{
  studentId: 'sim-001',
  assessmentId: 'fractions-v1',
  domainId: 'fractions-additive-grade5',
  instrumentVersion: 'proposal-v1',
  evidence: {
    equivalence: {
      observedScore: 0.75,
      earnedPoints: 3,
      possiblePoints: 4,
      observedItems: 4,
      expectedItems: 4,
      itemIds: ['E1', 'E2', 'E3', 'E4']
    }
  }
}
```

Si faltan todas las tareas, `observedScore = null`. No usar `0` para sustituir lo desconocido. `toKnowledgeProfiles()` actualmente utiliza `?? 0`; ese comportamiento no sería adecuado para datos reales sin distinguir estas situaciones.

Los errores elegidos en distractores pueden generar **hipótesis a comprobar** —por ejemplo, sumar numeradores y denominadores—, no diagnósticos definitivos. [Ni y Zhou (2005)](https://doi.org/10.1207/s15326985ep4001_3) revisan las dificultades relacionadas con el conocimiento de naturales al aprender racionales. Una respuesta aislada no identifica inequívocamente el mecanismo del error.

### Validación de las variables

- Revisión de alineación curricular y contenido por docentes de quinto.
- Entrevistas breves de resolución para comprobar qué razonamiento provocan las tareas.
- Pilotaje de comprensión, tiempos, dificultad, efectos de lectura y funcionamiento de distractores.
- Concordancia de corrección de respuestas abiertas y estabilidad de indicadores con formas equivalentes.
- Análisis de cobertura y solapamiento: E, U y M no deben contar tres veces como si fueran información independiente solo porque tienen nombres distintos.
- Comparación de decisiones con y sin cada variable. Más variables no implica mejor decisión.

Con una primera aula de 40 estudiantes, usar puntuaciones transparentes y revisión docente. No presentar un modelo IRT/DINA entrenado desde cero en esa aula como diagnóstico validado. La calidad depende de la especificación de ítems, atributos, muestra y test; [Uyumaz y Çokluk Bökeoğlu (2017)](https://doi.org/10.22521/jesr.2017.71.4) muestran problemas por errores de la matriz Q y condiciones de estimación. No existe un mínimo muestral universal que por sí solo valide el instrumento.

## 5. DURANTE: ramificar hacia actividades, no fijar etiquetas personales

La ramificación propuesta selecciona **qué trabajar y con qué apoyos**. Un estudiante puede necesitar varias rutas y cambiar después de una sesión. No se propone dividir permanentemente el aula en «bajos, medios y altos» ni aplicar k-means como clasificación de capacidad.

| Evidencia observada | Ruta de actividad | Apoyo propuesto |
| --- | --- | --- |
| Problemas con unidad o magnitud | Representaciones y recta numérica | Material visual y modelado docente |
| Representaciones suficientes, equivalencia inestable | Equivalencia y conservación de cantidad | Comparación de modelos y justificación |
| Comprensión relativamente mayor que procedimiento | Adición/sustracción explicada | Conectar modelo con pasos de cálculo |
| Procedimiento relativamente mayor que comprensión | Sentido del procedimiento y análisis de errores | Justificar cada transformación |
| Dificultad en T con mejor desempeño en P | Planteamiento de problemas | Separar elegir operación de resolverla |
| Desempeño alto en lo evaluado | Profundización | Problemas de varias estrategias y contraejemplos |
| Evidencia insuficiente o contradictoria | Completar diagnóstico | Preguntas adicionales y revisión docente |

Si se necesitan umbrales para una demo, se pueden declarar rangos operativos como `<0.50`, `0.50–<0.75`, `>=0.75`. Son **parámetros provisionales**, no niveles oficiales MINEDU ni puntos de corte establecidos por los papers. Con pocas tareas, conservar además la evidencia y evitar decisiones rígidas cerca de los cortes.

Antes de agrupar, el docente define el objetivo de la sesión y las dimensiones pertinentes. Para una actividad de equivalencia no conviene premiar que dos estudiantes difieran en una destreza que esa actividad no utilizará. Las rutas pueden solaparse; convertirlas en compartimentos excluyentes reduce candidatos y puede impedir grupos útiles.

## 6. DESPUÉS: qué significa que dos estudiantes puedan ayudarse

Hay dos objetivos pedagógicos diferentes:

- **Tutoría dirigida:** uno ofrece ayuda en un objetivo específico; el tutor también puede aprender explicando. No requiere que ambos tengan fortalezas cruzadas.
- **Colaboración/tutoría recíproca:** se planifican oportunidades para que ambos aporten y alternen funciones. Es el objetivo inicial recomendado para KoEduko, no una superioridad universal establecida.

[Fuchs et al. (1996)](https://doi.org/10.2307/1163279) encontraron mejores explicaciones y desempeño del tutorado con tutores de mayor rendimiento que con tutores medios, en un contexto de tutoría entrenada a estudiantes con dificultades matemáticas. Esto muestra que la ayuda asimétrica puede ser pertinente.

En cambio, [Fuchs et al. (1998)](https://doi.org/10.2307/1163424) observaron mejor interacción y trabajo de estudiantes de alto rendimiento cuando resolvían tareas complejas con compañeros de rendimiento similar. La tarea y el objetivo importan.

[Kneser y Ploetzner (2001)](https://doi.org/10.1016/S0959-4752(00)00015-3) estudiaron colaboración con conocimientos complementarios en física de secundaria. Fundamentan considerar aportes integrables, pero no validan la transferencia directa a primaria.

Por tanto, no afirmar «la ciencia establece que un estudiante que sabe debe juntarse siempre con uno que no sabe». La pregunta es **quién puede aportar qué, a qué tarea, con qué apoyos y qué aprenderá cada participante**.

Un antecedente directo es [Lechuga y Doroudi (publicación en línea 2022)](https://doi.org/10.1007/s40593-022-00309-y): propone parejas complementarias junto con contenido para trabajar, distinguiendo conocimiento y preparación para aprender. Incluye un trío en cantidades impares. Evalúa agrupamientos simulados con datos reales de álgebra; no demuestra eficacia educativa de ese emparejamiento ni transferencia a quinto.

### Propuesta numérica para poder probar esa hipótesis

La fórmula siguiente es una **construcción inicial de KoEduko**, no una ecuación extraída de los papers ni un predictor calibrado de aprendizaje.

Sean `p[i,k]` los puntajes observados y `w[k]` los pesos de las dimensiones que usa la sesión, no negativos y con suma 1. Como punto de partida, usar pesos iguales entre las dimensiones relevantes; documentar y revisar su solapamiento.

```text
aporte(j → i, k) = w[k] × (1 − p[i,k]) × max(0, p[j,k] − p[i,k])

u[i,G] = suma sobre k del mayor aporte(j → i, k), con j en G y j ≠ i

Q(G) = suma de u[i,G] + λ × |G| × mínimo de u[i,G]
```

Interpretación:

- La primera expresión identifica una diferencia favorable al posible compañero en una dimensión donde el estudiante tiene margen de mejora.
- El máximo por dimensión evita contar dos veces la misma oportunidad en un trío.
- La suma reconoce apoyo potencial en una o ambas direcciones.
- El término del mínimo favorece que el integrante con menor oportunidad también reciba apoyo. No impide tutoría dirigida cuando no hay fortalezas cruzadas.
- `λ` expresa cuánto prioriza el diseño la reciprocidad. Comparar `0`, `0.5` y `1`; no atribuir un valor al respaldo de un paper. La demostración usa `1` solo como escenario.

Esta utilidad representa **oportunidades hipotéticas de recibir ayuda**. No incluye todo el aprendizaje posible de explicar, discutir o resolver juntos. Por eso no sirve para descartar parejas con conocimientos similares ni para ordenar el valor de los estudiantes. Una utilidad cero significa que este modelo no detecta diferencias aprovechables; no que la colaboración carezca de valor.

No usar puntajes ausentes en la fórmula. En una actividad, exigir evidencia mínima en las dimensiones seleccionadas o devolver una recomendación provisional para revisión. El número mínimo de tareas y las reglas de admisión son parámetros del instrumento, no constantes científicas.

`Q(G)` está en una escala de utilidad grupal. Para mostrar un índice en `[0,1]`, puede usarse `Q(G) / (|G| × (1+λ))`; es una normalización, no una probabilidad. La optimización debe sumar `Q(G)`, no la media de cada grupo sin considerar su tamaño.

## 7. Vectores, coseno, clustering y grafos: comparación

| Herramienta | Para qué sirve | Limitación para KoEduko | Decisión propuesta |
| --- | --- | --- | --- |
| Vector explícito U/M/E/P/T/J | Representar el perfil de evidencias | Su validez depende del examen, no de escribir una lista numérica | Sí, representación principal |
| Similitud coseno | Comparar dirección de perfiles | Omite la escala; no identifica por sí misma ayuda ni exclusividad de grupos | Solo referencia o visualización |
| Distancia euclidiana | Medir diferencias absolutas si las escalas son comparables | Máxima diferencia no implica máxima oportunidad de aprender | Referencia exploratoria |
| Embeddings semánticos de texto | Buscar problemas o respuestas de contenido parecido | Cercanía semántica no equivale a competencia matemática ni a pareja adecuada | Reservar para recuperación de contenido, con evaluación propia |
| k-means/clustering | Explorar patrones o visualizar perfiles | No impone grupos de 2/3 ni prueba una ruta educativa válida | No usar como motor de asignación |
| Matching ponderado en grafo general | Elegir parejas globalmente sin duplicados | Un matching ordinario contiene aristas de dos personas, no tríos | Recomendado para cantidad par |
| Partición de conjuntos con parejas/tríos | Elegir grupos compatibles de tamaños permitidos | Necesita solver y reportar si probó optimalidad | Recomendado si se unifica todo el problema |
| Algoritmos genéticos | Buscar soluciones con muchos objetivos/restricciones | En general no certifican el óptimo | No necesarios como primera opción para este alcance |

La [definición oficial de coseno en scikit-learn](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.cosine_similarity.html) es el producto escalar dividido por el producto de normas. Por tanto, los perfiles `[0.9,0.9]` y `[0.3,0.3]` tienen coseno 1, aunque sus desempeños sean muy distintos. Con un vector cero, la fórmula matemática no está definida y la biblioteca necesita una convención; tampoco se debe confundir eso con ausencia de datos.

El ejemplo semántico de gato/perro puede servir para explicar proximidad en un embedding, pero no justifica variables diagnósticas. KoEduko necesita coordenadas interpretables y un objetivo de asignación explícito. **Vector es representación; coseno es una medida; grafo es la estructura de candidatos; matching es la optimización.**

## 8. Tamaños del aula y tratamiento del trío

Política solicitada, suponiendo estudiantes elegibles y sin restricciones incompatibles:

| N | Grupos | Estado |
| --- | --- | --- |
| 0 | Ninguno | Sin estudiantes; no ejecutar asignación |
| 1 | Ninguno | Espera o actividad individual asistida; no inventar compañero |
| 2 | Una pareja | Revisar pertinencia y apoyos; es la única composición posible |
| 3 | Un trío | Planificar participación de los tres |
| 4 | Dos parejas | Comparar las tres particiones posibles |
| 5 | Una pareja y un trío | Comparar las diez elecciones de trío |
| N par, N≥2 | N/2 parejas | Cada estudiante aparece una vez |
| N impar, N≥3 | (N−3)/2 parejas y un trío | Cada estudiante aparece una vez |
| 40 | Veinte parejas | 780 parejas candidatas antes de restricciones |
| 41 | Diecinueve parejas y un trío | 820 parejas y 10 660 tríos candidatos antes de restricciones |

La regla par/impar es una **política operativa de inclusión y tamaño**, no un descubrimiento de un paper. [Fuchs et al. (2000)](https://doi.org/10.1086/499639) compararon parejas y grupos de cuatro en aulas de tercero y cuarto: las parejas obtuvieron mejores indicadores en varias dimensiones de participación y trabajo, bajo esas condiciones. No compararon directamente parejas con tríos ni prueban la regla exacta propuesta.

El antecedente algorítmico de Lechuga y Doroudi citado arriba sí contempla un trío, lo que proporciona un precedente de implementación, sin establecer superioridad causal de esa política.

En un trío, usar funciones rotativas: propone, explica/contrasta y verifica; después intercambiar. La asignación de esos tres roles es una propuesta de actividad que debe observarse, no una intervención validada por la referencia anterior. Comprobar que nadie quede como observador permanente.

Si hay restricciones docentes incompatibles con la cobertura total, devolver `INFEASIBLE` o una solución parcial explícita según la política elegida. «Todos en grupos» y «todas las restricciones se cumplen» no pueden garantizarse simultáneamente para cualquier entrada. No relajar una prohibición silenciosamente.

## 9. Cómo obtener una asignación global óptima

### Cantidad par: grafo general y Blossom ponderado

Cada estudiante es un nodo. Cada pareja permitida es una arista con peso `Q({i,j})`. Buscar un matching de cardinalidad máxima y, dentro de esa cardinalidad, peso máximo. Si se exige cobertura completa, verificar que todas las personas estén cubiertas; cardinalidad máxima no implica siempre cobertura total en un grafo con restricciones.

No separar artificialmente el aula en «tutores» y «tutorados» para poder usar el algoritmo húngaro: sería otro problema, con roles fijos y restricciones adicionales.

La [implementación documentada de NetworkX](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.matching.max_weight_matching.html) usa Blossom/primal-dual y tiene complejidad `O(N³)`. Para 40 personas es una opción técnicamente razonable; el rendimiento real debe medirse en la implementación elegida. No hace falta backtracking exponencial para 40.

Escalar pesos a enteros, documentando la precisión. La optimalidad obtenida será respecto de esos pesos redondeados. Mantener orden de entrada e implementación estables; si se exige salida canónica entre empates, resolver un criterio secundario sin alterar el objetivo principal, no agregar un hash suficientemente grande como para cambiarlo.

### Cantidad impar con exactamente un trío: dos opciones exactas

**A. Enumerar todos los tríos permitidos y resolver el resto con Blossom.**

```text
Para cada trío T permitido:
    resolver el matching óptimo sobre V \ T
    si cubre a todos los restantes:
        evaluar Q(T) + peso del matching restante
Elegir el mayor total con desempate documentado
```

Es exacto para la política «un trío y el resto parejas» porque toda partición válida tiene uno de los tríos enumerados. No elegir primero el mejor trío aisladamente ni agregar al sobrante a una pareja ya optimizada: esas heurísticas pueden empeorar la solución global.

El número de subproblemas crece como `C(N,3)` y cada matching tiene costo cúbico en esa implementación. Para 41 son 10 660 resoluciones sobre 38 nodos; se debe medir antes de prometer una respuesta interactiva. Su crecimiento aproximado es `O(N⁶)`. No afirmar que agregar tríos conserva el costo de un único Blossom.

**B. Un modelo de partición de conjuntos con CP-SAT/MILP.**

Construir candidatos `G` de tamaño 2 y, cuando corresponda, 3. Variable binaria `x[G]` indica si se selecciona el grupo.

```text
Maximizar Σ Q(G) × x[G]

Para cada estudiante i: Σ x[G] de los grupos que contienen i = 1
Si N es par: Σ x[G] sobre tríos = 0
Si N es impar y N≥3: Σ x[G] sobre tríos = 1
Eliminar candidatos que incumplan restricciones duras
```

Con 41 son 11 480 candidatos antes de filtros. Es un tamaño de modelo que merece una prueba de rendimiento, no una garantía de tiempo. Esta opción permite incorporar restricciones adicionales y objetivos secundarios con mayor claridad.

[OR-Tools CP-SAT](https://developers.google.com/optimization/cp/cp_solver) distingue `OPTIMAL`, `FEASIBLE`, `INFEASIBLE` y `UNKNOWN`. Si hay límite de tiempo y devuelve `FEASIBLE`, la interfaz debe decir «solución factible; optimalidad no demostrada». `UNKNOWN` no significa que el problema sea imposible. Reportar tiempo, valor, cota y brecha cuando estén disponibles, además de versión y configuración.

**Elección recomendada:** formular el modelo general de parejas/trío como contrato lógico. Para el primer caso de 40, usar matching ponderado exacto; para impares, escoger enumeración exacta o CP-SAT según la implementación y los benchmarks. La librería concreta debe decidirse considerando que el frontend actual es JavaScript y las Functions son Node: NetworkX y los ejemplos Python de OR-Tools no son dependencias directamente ejecutables en React. El diseño matemático no obliga a cambiar de stack; puede utilizarse una implementación JavaScript evaluada de Blossom o un servicio de optimización aislado.

## 10. Ejemplo numérico pequeño, para entender el porqué

Supongamos una sesión que utiliza dos dimensiones con el mismo peso:

```text
A = [0.90, 0.40]
B = [0.40, 0.90]
C = [0.90, 0.90]
D = [0.40, 0.40]
```

Con la fórmula propuesta y `λ=1`:

- A/B: cada persona recibe una oportunidad de apoyo de `0.15`; `Q=0.60`.
- C/D: D recibe `0.30` y C recibe `0`; `Q=0.30`.
- A/C y B/D: cada pareja obtiene `Q=0.15`.
- A/D y B/C: cada pareja obtiene `Q=0.15`.

La partición A/B + C/D suma `0.90`; las otras dos suman `0.30`. Bajo este objetivo, la primera es óptima. Incluye una pareja con aportes cruzados y otra asimétrica: exigir reciprocidad absoluta podría excluir innecesariamente a participantes.

Esto ilustra el funcionamiento de una hipótesis numérica. Los valores no proceden de un ensayo y la superioridad de la puntuación no demuestra superioridad de aprendizaje. Si cambian tarea, pesos o objetivo, puede cambiar la asignación.

## 11. Simular 40 estudiantes de manera útil

En lugar de dibujar 40 listas arbitrarias de decimales:

1. Definir el banco y su relación con las dimensiones.
2. Generar perfiles latentes artificiales con un componente común y variaciones conceptuales/procedimentales. Solo sirven al generador.
3. Generar resultados de ítems bajo supuestos declarados de dificultad y ruido.
4. Calcular el perfil observable a partir de los puntos, igual que en el pipeline futuro.
5. Entregar al matching solo evidencias observadas; no permitirle ver los valores latentes que generaron las respuestas.
6. Usar semillas fijas y versionar el escenario.

El archivo [simular.mjs](simular.mjs) genera 40 perfiles y 960 registros de puntuación ficticios. Los puntajes por dimensión se derivan de esos registros; no son resultados de niños ni de un instrumento calibrado. Las puntuaciones de J simulan una corrección por rúbrica; no se inventan respuestas textuales ni se afirma haberlas corregido automáticamente.

También verifica por enumeración los tamaños 0–9 y el ejemplo de cuatro estudiantes. Es una demostración pequeña del contrato y de la fórmula; **no es el solver de producción para 40**. Los datos quedan en `simulacion-40.json` y el resumen en `comprobaciones.json`.

El prototipo posterior [optimizar.mjs](optimizar.mjs) sí ejecuta Blossom para 40 y enumera todos los tríos con matching exacto restante para 39. Contrasta con enumeración pequeña, restricciones y escenarios adicionales. Los [resultados](resultado-optimizacion.json) incluyen dos objetivos: maximizar utilidad y priorizar cobertura de oportunidades. La comparación y sus límites están explicados en [DECISIONES.md](DECISIONES.md). No es una integración productiva ni una evaluación educativa.

Escenarios adicionales a preparar antes de integrar: todos similares; todos con dificultad; todos avanzados; una persona avanzada entre muchas con dificultad; fortalezas cruzadas; respuestas ausentes; ítems mal especificados; pares prohibidos; empates y sensibilidad a una respuesta distinta. No fabricar únicamente un aula con fortalezas perfectamente balanceadas que favorezca el objetivo elegido.

## 12. Qué puede aportar KoEduko y cómo comprobarlo

La contribución propuesta es organizar evidencia por habilidad, sugerir actividad y compañeros con razones revisables, reducir la asignación manual y mantener trazabilidad de lo que sucede después. La mejora del aprendizaje y la superioridad sobre otras reglas siguen siendo hipótesis.

Separar dos evaluaciones:

**Verificación computacional:** cobertura, tamaño de grupos, ausencia de duplicados, restricciones, determinismo, optimalidad sobre el objetivo y tiempo. Comparar con enumeración en casos pequeños y registrar el estado del solver en aulas completas.

**Evaluación educativa:** comparar las asignaciones propuestas con otras reglas manteniendo iguales actividades, tiempo, instrucciones, tutor IA y apoyo docente. En un primer estudio puede bastar una comparación bien diseñada con asignación aleatoria; más adelante comparar también nivel similar y tutoría alto/bajo, con protocolos pedagógicos coherentes.

Medir antes/después a cada estudiante, usar problemas equivalentes no repetidos y añadir transferencia y retención si es viable. Observar calidad de explicaciones, participación de todos y cambios de ruta. Analizar la dependencia entre integrantes de un grupo. Cuarenta estudiantes constituyen un piloto; no prometer potencia estadística ni atribuir un efecto causal por observar una mejora pre/post sin comparación adecuada.

Para estudiar las variables, realizar ablaciones —por ejemplo, retirar J o unir U/M/E— y contrastar estabilidad, utilidad docente y resultados educativos. Probar varios `λ` comprueba sensibilidad del diseño, no valida el valor que produzca la mayor puntuación en datos fabricados con los mismos supuestos.

El [experimento de Fuchs et al. (1997)](https://doi.org/10.1086/461863), en 40 aulas y durante 18 semanas, favoreció la formación en explicaciones conceptuales además de ayuda elaborada. Respalda preparar las interacciones, no confiar en que una asignación por sí sola genere una buena sesión.

## 13. Encaje con el repositorio actual

No se modificaron los contratos ni el código de la aplicación durante esta investigación.

- `demoData.js`: útil como fixture inicial, pero hay que distinguir desconocido de cero y derivar las variables de un diagnóstico definido.
- `contracts.js`: sustituir o ampliar los identificadores actuales exige versionar perfiles/instrumento y coordinar los módulos consumidores; no renombrar campos sin migración.
- `KnowledgeProfile`: añadir evidencia, dominio e instrumento; no llamar «probabilidad de dominio» a un promedio de puntos.
- `Pair`: el modelo de dos identificadores no representa un trío. Propuesta de siguiente versión: `Group { id, studentIds, size, objectiveScore, explanation, evidenceSummary, supportFlags }`.
- `matchStudents`: evolucionar el retorno a `groups`, estado de resolución y estudiantes pendientes, preservando compatibilidad mediante adaptadores si se necesita.
- Sesiones: pasar de `pairId` a una referencia de grupo de forma coordinada; revisar UI, permisos, reglas de Firestore e integrantes autorizados.
- `API_CONTRACTS.md` y `TEAM_TASKS.md`: hoy prescriben dejar un sobrante en cantidades impares. La petición de formar un trío reemplaza ese criterio para el diseño nuevo; hay que actualizar documentos y pruebas al implementarlo.
- `FIRESTORE_SCHEMA.md`: el ejemplo `options: [15,17,8]` tiene `correctIndex: 0` aunque la respuesta explicada es 17. La clave correcta sería 1. Es una inconsistencia documental que ilustra por qué revisar las claves del banco antes de producir perfiles; no se corrigió como parte de esta guía.

Orden de implementación sugerido: banco/rúbricas → corrección y evidencia → rutas → utilidad explicable → solver y extremos → previsualización docente → persistencia/sesiones → piloto educativo.

## 14. Fuentes principales y límites

| Referencia verificable | Tipo y cercanía | Qué sustenta / qué no |
| --- | --- | --- |
| [MINEDU (2016), Programa curricular de Educación Primaria](https://repositorio.minedu.gob.pe/handle/20.500.12799/4549) | Fuente curricular peruana | Alineación de contenido y capacidades; no eficacia del matching |
| [Siegler et al. (2010), Developing Effective Fractions Instruction, IES](https://ies.ed.gov/ncee/wwc/PracticeGuide/15) | Guía de práctica basada en evidencia | Contenidos y representaciones para enseñar fracciones; no pesos de parejas |
| [Siegler et al. (2012), Early Predictors of High School Mathematics Achievement](https://doi.org/10.1177/0956797612440101) | Estudio longitudinal | Relevancia predictiva de fracciones/división; no causalidad del agrupamiento |
| [Hecht y Vagi (2010), Sources of Group and Individual Differences in Emerging Fraction Skills](https://doi.org/10.1037/a0019824) | 181 estudiantes, cuarto a quinto; texto en PMC | Dimensiones de desempeño con fracciones; no regla de parejas |
| [Hecht y Vagi (2012), Patterns of Strengths and Weaknesses in Children’s Knowledge about Fractions](https://doi.org/10.1016/j.jecp.2011.08.012) | Misma cohorte; texto en PMC | Perfiles conceptuales/procedimentales distintos; no demostrar que deban emparejarse entre sí |
| [Rittle-Johnson, Schneider y Star (2015), Not a One-Way Street](https://doi.org/10.1007/s10648-015-9302-x) | Revisión | Relación bidireccional concepto/procedimiento; no orden universal de instrucción |
| [Mislevy, Almond y Lukas (2003), A Brief Introduction to Evidence-Centered Design](https://doi.org/10.1002/j.2333-8504.2003.tb01908.x) | Marco de evaluación ETS | Relación entre inferencias, tareas y evidencia; no validación del banco propuesto |
| [Ni y Zhou (2005), Teaching and Learning Fraction and Rational Numbers](https://doi.org/10.1207/s15326985ep4001_3) | Revisión | Dificultades relativas a conocimiento de naturales; no etiqueta diagnóstica por un distractor |
| [Fuchs et al. (1996), The Relation Between Student Ability and the Quality and Effectiveness of Explanations](https://doi.org/10.2307/1163279) | Tutoría entrenada en matemática | Ayuda asimétrica puede ser pertinente; contexto específico |
| [Fuchs et al. (1997), Enhancing Students’ Helping Behavior…](https://doi.org/10.1086/461863) | Experimento en aulas | Preparación en explicaciones; no fórmula de compatibilidad |
| [Fuchs et al. (1998), High-Achieving Students’ Interactions and Performance…](https://doi.org/10.2307/1163424) | Matemática de tercero/cuarto, muestra focal pequeña | Límite a la heterogeneidad universal; no demostrar homogeneidad universal |
| [Fuchs et al. (2000), Effects of Workgroup Structure and Size…](https://doi.org/10.1086/499639) | Parejas frente a grupos de cuatro | Evidencia contextual de tamaño; no comparación directa pareja/trío |
| [Kneser y Ploetzner (2001), Collaboration on the Basis of Complementary Domain Knowledge](https://doi.org/10.1016/S0959-4752(00)00015-3) | Física, secundaria | Aportes complementarios integrables; transferencia a quinto sin validar |
| [Alegre et al. (2019), Peer Tutoring in Mathematics in Primary Education: A Systematic Review](https://doi.org/10.1080/00131911.2018.1474176) | Revisión de primaria | Estrategia general de tutoría; no superioridad de una regla concreta |
| [Wang, Yang y Li (publicación en línea 2024), A Systematic Review of Intelligent Grouping in Collaborative Learning](https://doi.org/10.1080/10494820.2024.2444538) | Revisión de 34 artículos, 2000–2023 | Panorama y límites de agrupamiento automático; no algoritmo universal ganador |
| [Uyumaz y Çokluk Bökeoğlu (2017), Effect of Q-Matrix Misspecification…](https://doi.org/10.22521/jesr.2017.71.4) | Estudio de simulación DINA | Riesgos de especificación/estimación; no un mínimo muestral universal |
| [NetworkX, max_weight_matching](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.matching.max_weight_matching.html) | Documentación técnica primaria | Matching exacto y condiciones numéricas; no resultado educativo |
| [Google OR-Tools, CP-SAT Solver](https://developers.google.com/optimization/cp/cp_solver) | Documentación técnica primaria | Restricciones y estados de resolución; no garantía de tiempo para este modelo |
| [scikit-learn, cosine_similarity](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.cosine_similarity.html) | Documentación técnica primaria | Definición y cálculo del coseno; no validez pedagógica |
| [Lechuga y Doroudi (en línea 2022), Three Algorithms for Grouping Students](https://doi.org/10.1007/s40593-022-00309-y) | Antecedente algorítmico directo; texto completo abierto | Diseño de parejas y contenido; no evaluación causal de aprendizaje |
| [Matt Krick, EdmondsBlossom](https://github.com/mattkrick/EdmondsBlossom) | Implementación JavaScript MIT | Prototipo ejecutable; ver licencia y procedencia en `vendor/` |

## 15. Alcance de la búsqueda y afirmación defendible

Se usó Exa para 18 búsquedas con 86 resultados solicitados en cuatro líneas: currículo/contenido matemático; medición/perfiles; composición e interacción; optimización. Hubo duplicados. Se seleccionaron 21 fuentes principales, combinando currículo, artículos originales, revisiones y fuentes técnicas. Se consultaron textos completos abiertos de Hecht y Vagi y Lechuga y Doroudi, páginas y secciones públicas, resúmenes editoriales y documentación oficial. Para el PDF curricular se utilizó además extracción de texto web para localizar el desempeño de quinto.

Es una investigación orientada a decisiones del proyecto, no una revisión sistemática con protocolo exhaustivo ni un metaanálisis. Cuando solo se pudo revisar el resumen, no se infirieron detalles metodológicos ausentes. Las fórmulas, los seis indicadores operativos, los umbrales, el banco, las rutas, la política de un trío y el generador de datos son propuestas de KoEduko que requieren evaluación.

> KoEduko organiza evidencias del desempeño en fracciones de quinto de primaria para proponer actividades y grupos explicables. La selección considera oportunidades de ayuda y restricciones de participación; se optimiza una función explícita, informada por literatura sobre diagnóstico matemático y aprendizaje entre pares. La optimalidad computacional se refiere a esa función, mientras que la utilidad pedagógica y el efecto sobre el aprendizaje se evaluarán mediante un piloto con mediciones individuales y condiciones comparables.

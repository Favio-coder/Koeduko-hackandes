# Variables y método de agrupamiento de KoEduko

Consulta dirigida: 17 de octubre de 2026. Alcance: resultados ya calculados → agrupamiento → JSON.

El JSON es la representación interna del servicio, no una pantalla ni una entrada manual. createMatchingResult recibe KnowledgeProfile[] conforme a contracts.js; la interfaz únicamente presenta los grupos. El contrato define la estructura, mientras que el productor del diagnóstico proporciona los resultados.

## Conclusión

La propuesta es un modelo de oportunidades de apoyo por habilidad, inspirado en antecedentes educativos, y una optimización global exacta del objetivo definido. Aún no es un método de emparejamiento validado educativamente para KoEduko. La prueba matemática, la validez del diagnóstico y el efecto educativo son evaluaciones diferentes.

assessments sigue siendo una interfaz inicial con datos ficticios. Los puntajes compartidos no son resultados calculados de un examen. Las réplicas para probar 40 no son una muestra independiente para validar aprendizaje.

## Variables y feedback

Se usan addition, subtraction, multiplication, division, fraction y estimation: puntajes ya normalizados en [0,1]. Se conservan por compatibilidad con los datos disponibles; no constituyen por sí solos el mejor instrumento validado.

Para el paquete AssessmentResults 1.0 se usa únicamente el subconjunto declarado con evidencia positiva común al aula. El ejemplo recibido contiene adición, sustracción y fracciones; las otras tres variables no se imputan. mastery es el puntaje proporcionado, evidenceCount conserva su significado de cantidad de evidencias y no determina un peso de confianza no validado. score/maxScore y la nota global se conservan separadamente. Este adaptador no cambia la fundamentación ni convierte los pesos del agrupamiento en coeficientes validados.

| Ámbito solicitado | Uso y evidencia faltante |
| --- | --- |
| A. Matemática | Solo seis puntajes amplios. Faltan resolución de problemas, razonamiento, comprensión del enunciado, tipos de error, ítems y prerrequisitos. Un puntaje de operaciones no mide automáticamente esos constructos. |
| B. Lectura | No hay comprensión literal, inferencial, crítica pertinente al grado, ideas principales o interpretación. Se declara null. |
| C. Colaboración | Explicaciones, escucha, turnos, ayuda y construcción conjunta requieren rúbricas y observaciones repetidas; no se infieren de la nota. |
| D. Convivencia | Solo se admite una lista de parejas prohibidas explícita como restricción dura. No se deducen afinidad, conflictos o comodidad. |
| E. Evolución | Un examen no permite medir progreso, uso de pistas, participación o historial de grupos. Se declara null. |

Feedback para el diagnóstico futuro: acotar primero la unidad y objetivo curricular. En fracciones se podrían medir unidad/representación, magnitud, equivalencia, procedimiento, planteamiento y justificación con tareas específicas. No convertir las seis variables actuales en esos indicadores mediante equivalencias inventadas. Son propuestas que necesitan validación.

Se distinguen simulated, observed, estimated y provided_score. observed requiere conteos declarados consistentes con el puntaje; no certifica respuestas auténticas ni calidad psicométrica. Sin conteos, no se inventa cantidad de ítems. Cero aciertos es distinto de no haber evaluado.

No se puntúa por nombre, identificador, grado o características personales. Los criterios no medidos no reciben valores o pesos ficticios.

## Fuentes contrastadas

| Fuente original | Aporte y límite |
| --- | --- |
| [Edmonds (1965), Maximum matching and a polyhedron with 0,1-vertices](https://doi.org/10.6028/jres.069b.013) | Fundamenta la optimización ponderada global de parejas. No valida pesos educativos. |
| [Lechuga y Doroudi (2022 en línea), Three Algorithms for Grouping Students](https://doi.org/10.1007/s40593-022-00309-y) | Perfiles por habilidad, preparación y contenido por grupo. Evalúa agrupamientos simulados con datos reales de álgebra; no prueba ganancias de aprendizaje causadas por el algoritmo. |
| [Alegre et al. (2018 en línea/2019 en volumen), Peer tutoring in mathematics in primary education](https://doi.org/10.1080/00131911.2018.1474176) | Revisión de 50 estudios: respalda investigar tutoría estructurada en primaria. Efectos de programas completos no validan esta fórmula. |
| [Fuchs et al. (1998), High-Achieving Students’ Interactions and Performance…](https://doi.org/10.3102/00028312035002227) | Con diez estudiantes de alto rendimiento de tercero/cuarto, parejas homogéneas mostraron ventajas en tareas complejas. No es una regla universal. |
| [Wu, Zhang y Wang (2023), Student Performance, Peer Effects, and Friend Networks](https://doi.org/10.1257/pol.20200563) | Intervención aleatorizada de compañeros de pupitre alto-bajo: mejoró matemática de los de menor rendimiento en ese contexto de primaria de China. No valida pesos de KoEduko. |
| [Fuchs et al. (2015), Is Word-Problem Solving a Form of Text Comprehension?](https://pmc.ncbi.nlm.nih.gov/articles/PMC4391820/) | Distingue aritmética, lenguaje y comprensión específica de problemas en segundo grado. Justifica medir por separado; no establece una regla causal de pairing. |

El texto aportado antes por el usuario, [Duran, Flores, Mosca y Santiviago, Tutorías entre iguales](https://ddd.uab.cat/pub/artpub/2014/48466b2d3618/art3_duran.pdf), se conserva como antecedente conceptual de tutoría y roles. Su ejemplo de primaria se refiere a lectura y no acredita los pesos matemáticos de esta implementación.

## Seis estrategias: cuándo y límites

| Modalidad | Puede convenir cuando | Limitación y estado actual |
| --- | --- | --- |
| Complementariedad | Hay fortalezas distintas y un foco común pertinente | Se implementan oportunidades matemáticas; ser distintos no prueba preparación o capacidad de enseñar. |
| Tutoría entre pares | Hay ventaja específica y estructura de interacción | Se identifican apoyos dirigidos/recíprocos, sin roles permanentes ni ejecución de tutorías. |
| Homogéneo | Preparación similar y enseñanza diferenciada | Alternativa documentada; no es el objetivo activo. Promedios similares pueden ocultar perfiles diferentes. |
| Dificultades compartidas | Necesidad común con guía suficiente | Sin ayuda pueden reforzarse errores. No se presume IA disponible o eficaz. |
| Profundización | Dominio pertinente y mayor demanda | Solo se detecta un criterio provisional; no se generan retos. |
| Adaptativo | Nuevas mediciones comparables e historial | Se recalcula con nuevas entradas; no hay seguimiento ni reagrupamiento programado. |

Ninguna modalidad es universalmente superior. La función activa es una hipótesis acotada, no un selector validado de la mejor pedagogía para cada niño.

### Combinaciones de matemática y lectura

Alto/En desarrollo se definirían por competencia y tarea con cortes del instrumento, no como etiquetas permanentes. Cuatro combinaciones de matemática por cuatro de lectura son 16 casos. Guía hipotética para revisión docente:

| Matemática / Lectura | Alto–Alto | Alto–En desarrollo | En desarrollo–Alto | En desarrollo–En desarrollo |
| --- | --- | --- | --- | --- |
| Alto–Alto | Considerar profundización | Explorar apoyo lector 1→2 | Explorar apoyo lector 2→1 | Guía para comprensión del enunciado |
| Alto–En desarrollo | Apoyo matemático 1→2 | Ayuda concentrada en 1: evitar dependencia | Aportes cruzados | Apoyo matemático y guía lectora |
| En desarrollo–Alto | Apoyo matemático 2→1 | Aportes cruzados | Ayuda concentrada en 2: evitar dependencia | Apoyo matemático y guía lectora |
| En desarrollo–En desarrollo | Refuerzo matemático guiado | Apoyo lector y refuerzo matemático | Apoyo lector y refuerzo matemático | Refuerzo de ambas con acompañamiento |

Esta matriz no se aplica a los perfiles actuales: falta lectura. Tampoco está validada como política; la tarea, las explicaciones y los apoyos pueden cambiar cualquier decisión.

## Arquitectura y pesos iniciales

1. Vector de los seis puntajes en [0,1]. No se normaliza respecto del aula ni se usa coseno como criterio de ayuda: [0.9,0.9] y [0.3,0.3] tienen coseno 1.
2. Grafo de estudiantes y parejas permitidas; las prohibiciones son restricciones duras.
3. Apoyo elegible: compañero >= 0.75 y ventaja >= 0.25. Por habilidad se calcula (1-score_receptor) × diferencia / K, siendo K las habilidades del foco. En tríos se toma el mejor compañero por habilidad, sin duplicar ayuda.
4. u_i suma los aportes; Q_G = suma(u_i) + tamaño(G) × mínimo(u_i). Pesos iniciales 1 y tamaño(G), con peso uniforme 1/K entre habilidades: hacen explícita una preferencia por apoyo repartido. Son hipótesis de diseño; ningún artículo valida estos coeficientes ni umbrales.
5. Se maximiza primero cuántos reciben apoyo detectable y luego Q total. Maximum Weight Matching/Blossom evita selección voraz. Con N impar se evalúa cada trío permitido y se optimizan las parejas restantes.
6. Se vuelve a calcular con nuevas entradas. No se presume progreso inexistente.

No se agregan lectura, convivencia, colaboración, IA o historial a la suma sin definir su medición. Sus pesos están inactivos, no se puntúan como cero.

0: sin grupos; 1: espera/apoyo individual; par: parejas; impar >=3: un trío y parejas. Si las restricciones impiden cubrir a todos, se devuelve infeasible. La política de un trío es operativa, no una superioridad educativa demostrada.

## Validación pendiente

- Diagnóstico: validez de contenido/constructo, fiabilidad, calidad de ítems, rúbricas y acuerdo entre evaluadores.
- Técnica: cobertura, unicidad, tamaños, restricciones, coherencia de puntajes y conteos, optimalidad frente a enumeración exhaustiva y reproducibilidad.
- Educativa: comparar aleatorio restringido, similitud y complementariedad con mismas tareas, tiempo y ayuda; medir aprendizaje individual, retención, participación y explicaciones de ambos. Considerar dependencia por grupo/aula.
- Pesos: hipótesis previas al piloto, sensibilidad, separación desarrollo/evaluación y prueba en otras aulas, con incertidumbre.
- Revisión docente: pertinencia de contenidos, prerrequisitos y convivencia.

No se presenta el plan como una validación ya realizada.

## Alcance de la búsqueda

Habilidad Search con Exa: cinco consultas por ángulos distintos y 25 resultados solicitados, con duplicados. Se revisaron resúmenes originales y secciones públicas de las seis fuentes principales; una recuperación del editor tuvo timeout y se contrastó por DOI. No fue revisión sistemática ni lectura íntegra de todos los artículos. Se separan pruebas matemáticas, resultados educativos e hipótesis de diseño.

Contrato y prueba: [README.md](README.md).

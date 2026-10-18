# Fundamentos para el emparejamiento pedagógico de KoEduko

Fecha de consulta: 17 de octubre de 2026.

## Conclusión

La literatura respalda la tutoría entre pares como una estrategia educativa prometedora y ofrece fundamentos para considerar los conocimientos previos, la tarea y la calidad de las interacciones al formar parejas. No demuestra que maximizar diferencias de notas, ni una fórmula particular de complementariedad, produzca siempre mejores aprendizajes.

Para KoEduko se propone investigar un emparejamiento por **complementariedad por habilidad y oportunidades de ayuda recíproca**, acompañado de actividades estructuradas y revisión docente. Es una hipótesis de diseño informada por evidencia, pendiente de evaluación en matemática de quinto de primaria.

## Fuentes seleccionadas y alcance

### 1. Evidencia de conjunto en matemática de primaria

Alegre, F., Moliner, L., Maroto, A., & Lorenzo-Valentin, G. (2019). *Peer tutoring in mathematics in primary education: A systematic review*. Educational Review, 71(6), 767–791. https://doi.org/10.1080/00131911.2018.1474176

- Revisa 50 estudios de primero a sexto de primaria; ofrece un panorama de resultados y formas de organizar la tutoría.
- Es pertinente para justificar estudiar tutoría entre pares en el nivel educativo de KoEduko.
- No valida una función de puntuación de parejas ni acredita que las fortalezas cruzadas sean siempre superiores a otras composiciones.
- Año del volumen: 2019; publicación anticipada en línea: 2018. [Registro bibliográfico ERIC](https://eric.ed.gov/?id=EJ1228533).

### 2. Síntesis cuantitativa y moderadores

Alegre-Ansuategui, F. J., Moliner, L., Lorenzo, G., & Maroto, A. (2018). *Peer tutoring and academic achievement in mathematics: A meta-analysis*. Eurasia Journal of Mathematics, Science and Technology Education, 14(1), 337–354. https://doi.org/10.12973/ejmste/79805

- Sintetiza 50 estudios independientes en varias etapas educativas; informa un efecto global Hedges g = 0,333.
- Permite fundamentar la estrategia general, sin trasladar ese tamaño de efecto al producto.
- El análisis distingue resultados según el modelo estadístico: los moderadores significativos bajo efectos fijos no lo fueron bajo el modelo mixto. No deben convertirse en reglas causales de emparejamiento.
- Un tamaño de efecto estandarizado no es un porcentaje de mejora. Tampoco se deben tratar esta revisión y la anterior como conjuntos necesariamente independientes.

### 3. Fundamento directo para conocimientos complementarios

Kneser, C., & Ploetzner, R. (2001). *Collaboration on the basis of complementary domain knowledge: Observed dialogue structures and their relation to learning success*. Learning and Instruction, 11(1), 53–83. https://doi.org/10.1016/S0959-4752(00)00015-3

- Examina colaboración entre estudiantes de décimo grado que recibieron instrucción en aspectos cualitativos o cuantitativos de mecánica clásica y después resolvieron problemas en parejas con conocimientos complementarios.
- Fundamenta estudiar diferencias de conocimiento específicas y tareas que requieran integrar los aportes de ambos.
- Es evidencia sobre secundaria y física, no una validación directa para quinto de primaria ni para los seis puntajes de KoEduko.
- Complementariedad significa disponer de conocimientos relevantes que puedan integrarse; una distancia numérica grande entre perfiles no basta para demostrarla.
- [Página editorial consultada](https://www.sciencedirect.com/science/article/abs/pii/S0959475200000153).

### 4. Evidencia que limita la regla «alto con bajo»

Fuchs, L. S., Fuchs, D., Hamlett, C. L., & Karns, K. (1998). *High-achieving students’ interactions and performance on complex mathematical tasks as a function of homogeneous and heterogeneous pairings*. American Educational Research Journal. https://doi.org/10.2307/1163424

- Observa a 10 estudiantes de alto rendimiento de tercero y cuarto de primaria trabajando con compañeros de alto y de bajo rendimiento, después de entrenamiento en interacciones de tutoría.
- En esas tareas matemáticas complejas, las parejas homogéneas presentaron mejor colaboración y calidad del trabajo.
- Cuestiona que la heterogeneidad sea una regla universal. Su muestra y contexto tampoco permiten concluir que las parejas homogéneas sean siempre mejores.
- Calidad del trabajo conjunto y aprendizaje individual posterior son resultados distintos.

### 5. Importancia de estructurar la interacción

Fantuzzo, J. W., King, J. A., & Heller, L. R. (1992). *Effects of reciprocal peer tutoring on mathematics and school adjustment: A component analysis*. Journal of Educational Psychology, 84(3), 331–339. https://doi.org/10.1037/0022-0663.84.3.331

- Estudia 64 estudiantes de cuarto y quinto de primaria en riesgo académico, asignados a cuatro condiciones que combinaban estructura de tutoría y recompensa grupal.
- La condición con ambos componentes obtuvo los mayores niveles de cálculo correcto.
- Respalda atender al diseño de la actividad además de la asignación de compañeros. No aísla la superioridad de una regla de emparejamiento ni demuestra que alternar roles por sí solo cause la mejora.

### 6. Relaciones sociales en una población cercana

Thurston, A., Roseth, C. J., Chiang, T.-H., Burns, V., & Topping, K. J. (2020). *The influence of social relationships on outcomes in mathematics when using peer tutoring in elementary school*. International Journal of Educational Research Open. https://doi.org/10.1016/j.ijedro.2020.100004

- Estudia tutoría recíproca en matemática con 487 estudiantes de 10 a 12 años de 20 escuelas.
- Encuentra relaciones entre percepciones del compañero y resultados académicos, además de cambios sociales después de la tutoría.
- Sugiere observar la relación y la interacción, no depender exclusivamente del diagnóstico académico.
- Las asociaciones no justifican clasificar o excluir estudiantes por popularidad. La revisión docente de dificultades de convivencia es una propuesta de implementación, no una regla causal derivada del estudio.

### 7. Marco general de aprendizaje entre pares

Topping, K. J. (2005). *Trends in peer learning*. Educational Psychology. https://doi.org/10.1080/01443410500345172

- Revisa formas de aprendizaje entre pares, sus mecanismos y problemas de implementación.
- Ayuda a fundamentar que deben considerarse los beneficios para quien ayuda y para quien recibe ayuda.
- Es un marco general; no proporciona umbrales numéricos de diferencia de dominio aplicables directamente a KoEduko.

## Traducción al módulo de KoEduko

Lo siguiente es una propuesta del proyecto, no un algoritmo validado por los artículos.

| Criterio de diseño | Aplicación propuesta | Límite |
| --- | --- | --- |
| Conocimiento por habilidad | Usar `KnowledgeProfile.skills`, no solo `totalScore` | Un puntaje de aciertos estima desempeño; no prueba capacidad para explicar |
| Aportes relevantes para ambos | Buscar fortalezas cruzadas relacionadas con la actividad | La reciprocidad es un objetivo del proyecto, no un requisito universal de toda tutoría eficaz |
| Composición según tarea | Distinguir práctica guiada de resolución de problemas complejos | Una pareja puede ser adecuada para una actividad y menos adecuada para otra |
| Interacción estructurada | Alternar explicación y resolución; pedir justificaciones y comprobaciones | El algoritmo no garantiza participación ni calidad de las explicaciones |
| Revisión docente | Mostrar razones por habilidad y permitir revisar propuestas | Las restricciones y los cambios deben ser explícitos |
| Calidad del diagnóstico | Tener varios ítems pertinentes por habilidad y reconocer datos insuficientes | No convertir una respuesta aislada en una etiqueta de dominio estable |

Ejemplo ilustrativo: Ana demuestra mayor desempeño en fracciones y Luis en división. Si la sesión incluye tareas que aprovechan ambas habilidades, puede haber oportunidades de explicación en las dos direcciones. Esto justifica proponer y observar la pareja; no demuestra por anticipado que aprenderá más.

El objetivo recíproco coincide con la restricción documentada en `docs/API_CONTRACTS.md`: evitar que una persona fuerte en todas las habilidades y otra débil en todas se conviertan automáticamente en la pareja preferida. Esa restricción es una decisión de alcance de KoEduko. No significa que la tutoría con roles fijos carezca de evidencia.

## Separar fundamento, puntuación y optimización

1. **Fundamento pedagógico:** por qué considerar conocimientos previos, oportunidades de explicación e interacción.
2. **Modelo de puntuación:** cómo el proyecto aproxima esas oportunidades mediante los datos disponibles. Pesos y umbrales deben declararse como decisiones iniciales y evaluarse; no atribuirlos a un paper que no los propone.
3. **Algoritmo combinatorio:** cómo elegir parejas sin duplicar estudiantes y optimizar el criterio definido. Encontrar el máximo matemático solo garantiza optimalidad respecto de ese criterio, no respecto del aprendizaje real.

En particular, `complementaryScore: 0.85` debe describirse como una puntuación del modelo. No significa «85 % de probabilidad de éxito» ni «85 % más aprendizaje».

## Cómo evaluar la hipótesis de emparejamiento

Para evaluar el aporte del matching, comparar la propuesta con otra regla —por ejemplo, emparejamiento aleatorio— manteniendo iguales las actividades, el tiempo, las instrucciones, el acceso al tutor y el acompañamiento docente. Si esas condiciones cambian, no se puede atribuir la diferencia al matching por sí solo.

Medir aprendizaje individual por habilidad antes y después con tareas equivalentes, registrar el nivel inicial y observar participación y explicaciones. Considerar que los estudiantes de una pareja comparten condiciones al analizar resultados. Un piloto pequeño sirve para detectar problemas y explorar señales; no basta para asegurar eficacia general.

## Texto sugerido para la sustentación

> KoEduko propone formar parejas a partir de perfiles de conocimiento por habilidad, buscando oportunidades de ayuda recíproca. La propuesta se informa en investigaciones sobre tutoría entre pares en matemática de primaria y colaboración con conocimientos complementarios. Dado que la evidencia muestra que la composición adecuada depende de la tarea y la interacción, las parejas propuestas requieren actividades estructuradas y revisión docente. La función de complementariedad es una hipótesis de diseño cuya efectividad deberá evaluarse; el prototipo no demuestra todavía mejoras en el aprendizaje.

## Alcance de esta búsqueda

Exploración con Exa: 26 resultados solicitados en cinco búsquedas, distribuidas entre criterios de composición, conocimientos complementarios y revisiones de tutoría. Se seleccionaron siete publicaciones. La comprobación utilizó resúmenes, metadatos y secciones públicas disponibles; no se realizó una revisión sistemática ni una evaluación completa del riesgo de sesgo de cada estudio. Algunos textos completos requieren acceso institucional. Los resultados solicitados incluyen duplicados y no equivalen a 26 artículos leídos íntegramente.

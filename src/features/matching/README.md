# Emparejamiento interno por contrato

Flujo: evaluación → paquete AssessmentResults 1.0 o KnowledgeProfile[] → createMatchingResult → grupos internos.

src/shared/constants/contracts.js define KnowledgeProfile, Pair y SKILL_IDS. No contiene resultados ni carga datos. La fuente del diagnóstico entrega los perfiles siguiendo esa estructura.

## Interfaz interna

### Paquete de resultados de evaluación 1.0

Se acepta directamente el formato proporcionado para evaluación:

    const result = createMatchingResult(assessmentResults)
    // assessmentResults = { schemaVersion, courseId, assessmentId, competencyId,
    //   generatedAt, status: 'finalized', students: [{ studentId, overallScore,
    //   maxScore, skills: [{ skillId, score, maxScore, mastery, evidenceCount }] }] }

El adaptador está en services/normalizeAssessmentResults.js, dentro de matching. No modifica contracts.js ni el examen.

| Campo | Tratamiento |
| --- | --- |
| mastery | Puntaje normalizado usado para agrupar; no se presenta como una probabilidad verificada de dominio |
| score / maxScore | Se validan rangos y se conservan para auditoría; no sustituyen silenciosamente a mastery |
| evidenceCount | Evidencia positiva para usar la habilidad; se conserva como evidencia, no se convierte en cantidad de aciertos, ítems o peso de confianza |
| overallScore / maxScore global | Metadatos de la nota global; no deciden la compatibilidad |
| generatedAt | Fecha declarada del diagnóstico, conservada; no se usa como medida de progreso |

Alias locales: adicion → addition, sustraccion → subtraction, fracciones → fraction. También se admiten los identificadores ingleses del contrato y los alias matemáticos declarados en el adaptador. Alias duplicados o desconocidos se rechazan.

Para el ejemplo recibido se utilizan addition, subtraction y fraction. Multiplicación, división y estimación quedan sin evaluar, nunca con puntajes cero inventados. La comparación usa únicamente habilidades con evidenceCount > 0 para **todos** los estudiantes; evidenceCoverage documenta habilidades no utilizadas y cobertura incompleta. Sin base común se devuelve insufficient_evidence y todos quedan sin asignar. Con cero estudiantes se devuelve empty y con uno waiting.

Si mastery difiere de score/maxScore, se conserva mastery y se devuelve una advertencia: el paquete no declara cómo se estimó. No se impone que esa estimación sea necesariamente la proporción de puntos.

Solo se acepta schemaVersion 1.0, status finalized y la competencia resuelve-problemas-cantidad. Los metadatos del paquete se conservan y una selección de evaluación incompatible se rechaza.

Ejemplo de conexión desde código:

    <MatchingPage assessmentResults={resultsFromAssessment} />

La prueba tests/fixtures/assessment-results-v1.json contiene exactamente el ejemplo recibido. El motor detecta apoyo de student-001 a student-002 en adición y de student-002 a student-001 en sustracción; la igualdad en fracciones no genera una brecha ficticia.

### Lista KnowledgeProfile existente

En services/matchingService.js:

    const result = createMatchingResult(knowledgeProfiles, {
      assessmentId: 'assessment-1',
      forbiddenPairs: [['student-a', 'student-b']]
    })

Cada perfil sigue el contrato existente:

    {
      studentId,
      assessmentId,
      skills: { addition, subtraction, multiplication, division, fraction, estimation },
      totalScore,
      computedAt
    }

En esta forma anterior los seis puntajes de skills son obligatorios, finitos y entre 0 y 1. En el paquete 1.0 se respeta el subconjunto efectivamente evaluado. totalScore y computedAt no son predictores de compatibilidad. displayName es opcional y solo se usa para presentar nombres.

No se mezclan evaluaciones. Si se indica assessmentId, todos los perfiles deben corresponder a esa evaluación. No se rellenan puntajes ausentes.

El resultado es un objeto JavaScript/JSON interno:

    {
      assessmentId,
      status,
      groups,
      pairs,
      unmatchedStudentIds,
      totalScore,
      algorithm,
      variablesUsed,
      source,
      validation
    }

groups incluye parejas y tríos con studentIds, members y razones. pairs conserva la estructura Pair del contrato y solo incluye grupos de dos. No se transforma un trío en una pareja ficticia ni se modifica el contrato compartido.

Resultados permite confirmar la propuesta con Crear salas para estos grupos. POST /api/group-sessions comprueba rol, dueño del curso/evaluación, cobertura exacta de asignados y evidencia actual en una transacción. Guarda la confirmación en matchingResults y crea documentos learningSessions compatibles con el módulo de sesión privada. Los tríos conservan sus tres studentIds y groupId, con pairId null; las parejas también tienen pairId. No se inventan enunciados ni respuestas esperadas.

## Hook y pantalla

useMatchingPreview(resultsOrProfiles, options) recibe los datos sin calcular grupos. Solo generate(), invocado al pulsar Agrupar, inicia el worker. Al cambiar el paquete, la lista o evaluación se cancela el cálculo anterior y se retira la propuesta visible: hace falta volver a pulsar Agrupar. La interfaz también puede recibir los perfiles anteriores desde código:

    <MatchingPage
      knowledgeProfiles={profilesFromAssessment}
      assessmentId="assessment-1"
    />

En /matching se muestra la cantidad real de estudiantes recibidos y sus habilidades desplegables. Agrupar está deshabilitado con cero o un estudiante y durante el cálculo. Tras pulsarlo aparecen la propuesta y los motivos desplegables de cada grupo.

/matching/results es una pantalla distinta: muestra el último agrupamiento generado, con resumen y filtros de parejas/tríos. No ejecuta el algoritmo. Sin una propuesta guardada, invita a volver a Estudiantes.

La propuesta aún no confirmada se conserva en sessionStorage de esta pestaña, separada por docente y versión del modelo. Las rutas filtran por curso y evaluación. Se valida al recuperarla sin recalcular. Si el almacenamiento falla, Ver resultados lleva la propuesta mediante el estado del router. La confirmación de salas sí se persiste en Firestore mediante la API; otra petición idéntica devuelve las mismas salas. Una distribución diferente para una evaluación ya confirmada se rechaza para no duplicar grupos.

No hay formulario para pegar JSON ni visor de JSON. Los datos estructurados siguen disponibles dentro del resultado del servicio/hook.

Sin props explícitas, /matching consulta loadBootstrap({ refresh: true }), la misma API de cursos y roster autorizados que Estudiantes. Permite seleccionar curso y una evaluación finalizada de resuelve-problemas-cantidad. Los nombres proceden del roster; los puntajes proceden únicamente del paquete de esa evaluación. Se muestran las cantidades de matriculados y evaluados por separado. Los matriculados sin resultados en la evaluación seleccionada no se agrupan ni reciben puntajes ficticios. No se mezclan perfiles históricos de knowledgeProfiles sin identificar la evaluación.

Las evaluaciones finalizadas se integran mediante el endpoint autenticado
`GET /api/assessments/matching-profile?courseId=...&assessmentId=...`. Desde
Resultados, el docente elige «Preparar perfiles para matching»; la pantalla
`/matching` obtiene el contrato v1.0 directamente del backend, lo valida con
este adaptador y muestra las habilidades con evidencia. No se descarga ni se
sube JSON manualmente. El perfil se deriva de las asignaciones actuales al
consultar el endpoint, de modo que una recalificación autorizada se refleja en
la siguiente carga sin mantener una copia desactualizada. La finalización solo
habilita los perfiles: no ejecuta el optimizador. El docente confirma el
agrupamiento mediante «Agrupar».

La ruta /matching sin parámetros también usa datos reales: muestra inicialmente el primer curso y exige elegir una evaluación compatible finalizada. No selecciona la primera evaluación automáticamente ni exige completar las otras pruebas del curso. Una URL que ya identifica curso y evaluación conserva esa selección explícita. Al cambiar curso se retira la selección de evaluación anterior. Actualizar datos recarga roster y resultados y obliga a pulsar Agrupar otra vez. Un error, curso vacío o diagnóstico pendiente nunca activa datos demo. La fuente compartida de simulación solo se pasa explícitamente en MatchingDemo; no hay fallback en el hook.

## Variables y fundamento

Se consumen las seis habilidades de SKILL_IDS. Se proponen oportunidades de apoyo por habilidad en un foco común y se usa Maximum Weight Matching/Blossom. Con cantidad impar se evalúan todos los tríos permitidos y se optimizan las parejas restantes.

Los umbrales y pesos siguen siendo hipótesis; la optimalidad es matemática respecto de la función definida. No se afirma validación educativa para KoEduko. Lectura, colaboración, convivencia y progreso no se inventan.

services/assessmentMatching.js produce el informe de auditoría detallado usado por el servicio. Ese informe explica variables, evidencia, estrategias, criterios y límites; no se expone como una tarea que deba completar el usuario.

Más información: [INVESTIGACION.md](INVESTIGACION.md).

## Prueba

- /matching o /matching/results: cuenta docente.
- /demo/matching#/matching: prueba aislada con la misma fuente demo, sin Firebase ni autenticación.

Como docente, abre /matching → selecciona curso y evaluación finalizada → revisa estudiantes → pulsa Agrupar → abre Ver resultados. Ver estudiantes del curso enlaza al roster real /students. Los filtros y motivos permiten revisar la propuesta sin recalcularla. La API requiere el despliegue Vercel o vercel dev; npm run dev por sí solo no ejecuta las funciones /api.

    npm test
    npm run lint
    npm run build

Las pruebas cubren el contrato KnowledgeProfile, compatibilidad de Pair, separación de evaluaciones, metadatos excluidos, cantidades 0/1/pares/impares/40, restricciones, coherencia de evidencia, cancelación y router real.

Para inspección de desarrollo, los informes JSON se pueden exportar sin mostrarlos en la aplicación:

    node src/features/matching/scripts/exportDemoResult.mjs 5

Escribe examples/matching-5.json. Las réplicas no constituyen una muestra independiente de alumnos ni validan eficacia educativa.

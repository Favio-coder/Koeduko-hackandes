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

La persistencia e integración del contrato Pair con sesiones siguen fuera de este módulo. Las sesiones que solo soporten parejas necesitarán un acuerdo de contrato para consumir tríos.

## Hook y pantalla

useMatchingPreview(resultsOrProfiles, options) recibe los datos sin calcular grupos. Solo generate(), invocado al pulsar Agrupar, inicia el worker. Al cambiar el paquete, la lista o evaluación se cancela el cálculo anterior y se retira la propuesta visible: hace falta volver a pulsar Agrupar. La interfaz también puede recibir los perfiles anteriores desde código:

    <MatchingPage
      knowledgeProfiles={profilesFromAssessment}
      assessmentId="assessment-1"
    />

En /matching se muestra la cantidad real de estudiantes recibidos y sus habilidades desplegables. Agrupar está deshabilitado con cero o un estudiante y durante el cálculo. Tras pulsarlo aparecen la propuesta y los motivos desplegables de cada grupo.

/matching/results es una pantalla distinta: muestra el último agrupamiento generado, con resumen y filtros de parejas/tríos. No ejecuta el algoritmo. Sin una propuesta guardada, invita a volver a Estudiantes.

El último resultado se conserva en sessionStorage de esta pestaña, separado por versión del modelo. Se valida al recuperarlo sin recalcular. Si el almacenamiento falla, Ver resultados lleva la propuesta mediante el estado del router y se avisa que no sobrevivirá a una recarga. No se escribe en Firestore ni se integran sesiones.

No hay formulario para pegar JSON ni visor de JSON. Los datos estructurados siguen disponibles dentro del resultado del servicio/hook.

Si no se pasa knowledgeProfiles, se usa únicamente la demo compartida de shared/lib/demoData.js. Una lista vacía o inválida recibida desde la evaluación jamás activa ese fallback.

Actualmente assessments aún no produce perfiles reales ni existe su servicio de resultados: la ruta por defecto recibe los cinco perfiles ficticios compartidos y espera el clic en Agrupar. La interfaz interna ya acepta los resultados cuando el productor los entregue. No se afirma una conexión a Firestore que todavía no existe.

## Variables y fundamento

Se consumen las seis habilidades de SKILL_IDS. Se proponen oportunidades de apoyo por habilidad en un foco común y se usa Maximum Weight Matching/Blossom. Con cantidad impar se evalúan todos los tríos permitidos y se optimizan las parejas restantes.

Los umbrales y pesos siguen siendo hipótesis; la optimalidad es matemática respecto de la función definida. No se afirma validación educativa para KoEduko. Lectura, colaboración, convivencia y progreso no se inventan.

services/assessmentMatching.js produce el informe de auditoría detallado usado por el servicio. Ese informe explica variables, evidencia, estrategias, criterios y límites; no se expone como una tarea que deba completar el usuario.

Más información: [INVESTIGACION.md](INVESTIGACION.md).

## Prueba

- /matching o /matching/results: cuenta docente.
- /demo/matching#/matching: prueba aislada con la misma fuente demo, sin Firebase ni autenticación.

Abre Estudiantes → revisa la cantidad → pulsa Agrupar → abre Ver resultados. Los filtros y motivos permiten revisar la propuesta sin recalcularla.

    npm test
    npm run lint
    npm run build

Las pruebas cubren el contrato KnowledgeProfile, compatibilidad de Pair, separación de evaluaciones, metadatos excluidos, cantidades 0/1/pares/impares/40, restricciones, coherencia de evidencia, cancelación y router real.

Para inspección de desarrollo, los informes JSON se pueden exportar sin mostrarlos en la aplicación:

    node src/features/matching/scripts/exportDemoResult.mjs 5

Escribe examples/matching-5.json. Las réplicas no constituyen una muestra independiente de alumnos ni validan eficacia educativa.

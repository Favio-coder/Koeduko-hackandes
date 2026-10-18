import { DIMENSION_IDS, DIMENSION_LABELS, MIN_HELPER_SCORE, MIN_SUPPORT_GAP } from './matchingConfig'

export const MATCHING_REFERENCES = [
  { id: 'edmonds1965', title: 'Maximum matching and a polyhedron with 0,1-vertices', url: 'https://doi.org/10.6028/jres.069b.013', supports: 'Optimización global de parejas con pesos.', limitation: 'No valida criterios educativos.' },
  { id: 'lechuga2022', title: 'Three Algorithms for Grouping Students', url: 'https://doi.org/10.1007/s40593-022-00309-y', supports: 'Perfiles por habilidad, preparación y agrupamientos según el objetivo.', limitation: 'Simula grupos con datos reales de álgebra; no prueba ganancias de aprendizaje por el algoritmo.' },
  { id: 'alegre2019', title: 'Peer tutoring in mathematics in primary education: a systematic review', url: 'https://doi.org/10.1080/00131911.2018.1474176', supports: 'Tutoría estructurada en matemática de primaria.', limitation: 'Los resultados de programas no validan los pesos ni las parejas concretas de KoEduko.' },
  { id: 'fuchs1998', title: 'High-Achieving Students’ Interactions and Performance on Complex Mathematical Tasks as a Function of Homogeneous and Heterogeneous Pairings', url: 'https://doi.org/10.3102/00028312035002227', supports: 'La conveniencia de una composición depende de la tarea y de los participantes.', limitation: 'Estudio pequeño con diez estudiantes de alto rendimiento en tercero/cuarto; no establece una regla universal.' },
  { id: 'wang2023', title: 'Student Performance, Peer Effects, and Friend Networks: Evidence from a Randomized Peer Intervention', url: 'https://doi.org/10.1257/pol.20200563', supports: 'En ese experimento, las parejas alto-bajo mejoraron matemática de estudiantes con menor rendimiento.', limitation: 'Parejas de pupitre en primaria de China; no valida una puntuación multicriterio de KoEduko.' },
  { id: 'fuchs2015', title: 'Is Word-Problem Solving a Form of Text Comprehension?', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4391820/', supports: 'Distinguir cálculo, comprensión del lenguaje y resolución de problemas.', limitation: 'Estudio predictivo en segundo grado; no demuestra causalidad ni una regla de emparejamiento.' },
]

export const VARIABLE_FEEDBACK = {
  used: DIMENSION_IDS.map((id) => ({
    id, label: DIMENSION_LABELS[id], domain: 'mathematics', scale: [0, 1],
    interpretation: 'Puntaje recibido por habilidad; no se interpreta como probabilidad de dominio.',
  })),
  missingFromCurrentDemo: {
    mathematics: ['problem_solving', 'mathematical_reasoning', 'word_problem_comprehension', 'item_level_errors', 'prerequisites', 'evidence_item_counts'],
    reading: ['literal_comprehension', 'inferential_comprehension', 'critical_comprehension_if_grade_appropriate', 'main_ideas', 'text_interpretation'],
    collaboration: ['explaining_ideas', 'listening_and_turn_taking', 'helping_and_receiving_help', 'participation', 'joint_solution_building'],
    interpersonal: ['collaboration_history', 'teacher_reported_conflicts_or_positive_relations', 'working_comfort', 'support_requirements'],
    progress: ['comparable_pre_post_scores', 'correct_activities', 'hint_types_and_counts', 'session_participation', 'previous_groups'],
  },
  excludedPredictors: ['displayName', 'studentId', 'grade', 'personality_inferred_from_scores', 'unobserved_social_traits'],
  recommendations: [
    'Conservar las habilidades por contenido. Los seis campos actuales son ejemplos amplios, no un diagnóstico validado.',
    'Medir resolución, comprensión del enunciado y justificación con ítems y rúbricas propios; no deducirlos de la nota de operaciones.',
    'Registrar aciertos, ítems evaluados, competencia y evaluación. Cero aciertos no equivale a falta de datos.',
    'Colaboración y convivencia requieren observaciones del docente; progreso requiere mediciones longitudinales comparables.',
    'No añadir pesos a lectura, colaboración, convivencia, IA o progreso mientras no haya datos e instrumentos apropiados.',
  ],
}

export const GROUPING_STRATEGIES = [
  { id: 'academic_complementarity', when: 'Fortalezas específicas diferentes y una competencia común a trabajar.', limitation: 'Ser diferentes no demuestra que puedan enseñar ni que cumplan prerrequisitos.', currentImplementation: 'Solo oportunidades de apoyo en las seis habilidades matemáticas.', references: ['lechuga2022'] },
  { id: 'peer_tutoring', when: 'Un integrante aporta evidencia de mayor desempeño en una habilidad pertinente.', limitation: 'Necesita interacción estructurada y preparación; la ventaja numérica no prueba capacidad de explicar.', currentImplementation: 'Identifica apoyos dirigidos y recíprocos; no ejecuta tutorías.', references: ['alegre2019', 'wang2023'] },
  { id: 'homogeneous', when: 'Preparación similar para una tarea común y diferenciación de contenidos.', limitation: 'La similitud global puede ocultar fortalezas distintas; no implica superioridad general.', currentImplementation: 'Alternativa documentada; no es el objetivo de optimización activo.', references: ['lechuga2022', 'fuchs1998'] },
  { id: 'shared_difficulties', when: 'Dificultad específica compartida con acompañamiento disponible.', limitation: 'Sin guía pueden reforzarse errores. La disponibilidad o eficacia de IA no está medida.', currentImplementation: 'Se avisa cuando no se detecta apoyo entre pares; no se presupone IA disponible.', references: ['lechuga2022'] },
  { id: 'deepening', when: 'Desempeño alto en el contenido y tarea de mayor demanda.', limitation: 'Dos puntajes altos no garantizan colaboración ni permiten inferir éxito.', currentImplementation: 'Detecta el criterio provisional de desempeño alto; no genera retos.', references: ['fuchs1998'] },
  { id: 'adaptive', when: 'Nuevas evaluaciones y evidencias comparables de progreso e interacción.', limitation: 'Requiere historial y criterio de actualización; cambiar de compañero por sí solo no demuestra mejora.', currentImplementation: 'Se recalcula con nuevas entradas; no hay seguimiento longitudinal ni reagrupamiento programado.', references: ['lechuga2022'] },
]

export const METHOD_SPECIFICATION = {
  representation: { type: 'normalized_skill_vector', order: DIMENSION_IDS, missingValues: 'rejected_not_imputed', cosineUsed: false, cosineLimitation: 'Compara direcciones: [0.9,0.9] y [0.3,0.3] tienen coseno 1 pese a sus distintos puntajes.' },
  graph: { nodes: 'students', edges: 'allowed_pairs', weights: 'opportunities_for_skill_specific_peer_support', forbiddenPairs: 'hard_constraints' },
  scoring: {
    helperMinimum: MIN_HELPER_SCORE, minimumGap: MIN_SUPPORT_GAP, thresholdsValidated: false,
    skillWeightWithinFocus: '1 / number_of_focus_skills',
    incomingSupport: 'u_i = sum_k max_eligible_j ((1 - score_i_k) * (score_j_k - score_i_k) / number_of_focus_skills)',
    groupUtility: 'Q_G = sum_i(u_i) + size(G) * min_i(u_i)',
    objective: ['maximize_students_with_detected_support', 'maximize_total_Q'],
    numericWeights: { supportSum: 1, minimumSupport: 'group_size' },
    weightStatus: 'design_hypothesis_not_fitted_or_educationally_validated',
    inactiveCriteria: ['reading', 'collaboration', 'interpersonal_compatibility', 'ai_support', 'progress_and_pair_history'],
    inactiveCriteriaPolicy: 'excluded_not_assigned_fictitious_scores_or_weights',
    benefitInterpretation: 'Oportunidad inferida de apoyo; no predicción ni medición de aprendizaje.',
  },
  optimization: { algorithm: 'maximum_weight_matching_blossom', even: 'exact_weighted_pair_matching', odd: 'enumerate_each_allowed_trio_and_solve_remaining_pairs', greedy: false, scope: 'Exacto para el objetivo entero definido, todas las parejas y como máximo un trío; no óptimo educativo demostrado.', references: ['edmonds1965', 'lechuga2022'] },
  dualSubjectPatterns: {
    mathematics: ['Alto-Alto', 'Alto-En desarrollo', 'En desarrollo-Alto', 'En desarrollo-En desarrollo'],
    reading: ['Alto-Alto', 'Alto-En desarrollo', 'En desarrollo-Alto', 'En desarrollo-En desarrollo'],
    possibleJointPatterns: 16,
    currentStatus: 'not_computable_reading_evidence_missing',
    rule: 'Niveles por competencia y tarea, con cortes validados del diagnóstico; no etiquetas permanentes. No se imputa lectura desde matemática.',
  },
}

/**
 * Contratos compartidos de KoEduko.
 * Estos archivos son la fuente de verdad para los tres modulos.
 * NO modificar sin coordinar con los demas desarrolladores.
 */

export const USER_ROLES = Object.freeze({
  TEACHER: 'teacher',
  STUDENT: 'student',
})

export const SESSION_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
})

export const ASSESSMENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
})

export const COMPETENCY_ID = Object.freeze({
  RESOLVE_QUANTITY_PROBLEMS: 'resuelve-problemas-cantidad',
})

/**
 * Habilidades matematicas evaluadas en la competencia inicial.
 * Los valores son mastery scores normalizados en [0, 1].
 */
export const MATH_SKILLS = Object.freeze([
  { id: 'addition', label: 'Adicion', description: 'Sumar cantidades y resolver problemas de adicion.' },
  { id: 'subtraction', label: 'Resta', description: 'Restar cantidades y resolver problemas de resta.' },
  { id: 'multiplication', label: 'Multiplicacion', description: 'Multiplicar cantidades para resolver problemas de cantidad.' },
  { id: 'division', label: 'Division', description: 'Repartir cantidades de forma igual para resolver problemas.' },
  { id: 'fraction', label: 'Fracciones', description: 'Interpretar y operar fracciones en problemas de cantidad.' },
  { id: 'estimation', label: 'Estimacion', description: 'Estimar resultados para seleccionar la operacion adecuada.' },
])

export const SKILL_IDS = Object.freeze(MATH_SKILLS.map((s) => s.id))

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {string} displayName
 * @property {'teacher'|'student'} role
 * @property {string} classroomId
 * @property {boolean} emailVerified
 * @property {import('firebase/firestore').Timestamp|null} createdAt
 */

/**
 * @typedef {Object} KnowledgeProfile
 * @property {string} studentId
 * @property {Record<string, number>} skills  mastery por skill en [0, 1]
 * @property {string} assessmentId
 * @property {number} totalScore 0..100
 * @property {import('firebase/firestore').Timestamp} computedAt
 */

/**
 * @typedef {Object} Pair
 * @property {string} id
 * @property {string} studentAId
 * @property {string} studentBId
 * @property {number} complementaryScore 0..1
 * @property {string} explanation
 */

/**
 * @typedef {Object} LearningSession
 * @property {string} id
 * @property {string} pairId
 * @property {string[]} studentIds UIDs de Firebase Auth de los estudiantes de la sesion (no ids de la coleccion `students`).
 * @property {string|null} meetingUrl
 * @property {'scheduled'|'live'|'completed'|'cancelled'} status
 * @property {import('firebase/firestore').Timestamp|null} scheduledAt
 */

/**
 * @typedef {Object} TutorInteraction
 * @property {string} id
 * @property {string} sessionId
 * @property {string} studentId
 * @property {'hint-1'|'hint-2'|'hint-3'|'clarification'} hintLevel
 * @property {string} prompt
 * @property {string} response
 * @property {import('firebase/firestore').Timestamp} createdAt
 */

export const FIRESTORE_COLLECTIONS = Object.freeze({
  USERS: 'users',
  CLASSROOMS: 'classrooms',
  STUDENTS: 'students',
  ASSESSMENTS: 'assessments',
  KNOWLEDGE_PROFILES: 'knowledgeProfiles',
  MATCHING_RESULTS: 'matchingResults',
  LEARNING_SESSIONS: 'learningSessions',
  TUTOR_INTERACTIONS: 'tutorInteractions',
})
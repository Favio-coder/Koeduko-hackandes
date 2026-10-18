import { MATH_SKILLS } from '@/shared/constants/contracts'

// Se consumen las variables compartidas actuales. No se redefinen ni se infieren otras.
export const MATCHING_DIMENSIONS = MATH_SKILLS.map((skill) => ({ ...skill, shortLabel: skill.label }))
export const DIMENSION_IDS = MATCHING_DIMENSIONS.map(({ id }) => id)
export const DIMENSION_LABELS = Object.fromEntries(MATCHING_DIMENSIONS.map(({ id, label }) => [id, label]))
export const MAX_DEMO_STUDENTS = 40
export const DEFAULT_SEED = 0
export const MODEL_VERSION = 'skill-scoped-peer-support-v2'
export const SCORE_SCALE = 1_000_000
export const MIN_HELPER_SCORE = 0.75
export const MIN_SUPPORT_GAP = 0.25

export const MATCHING_ACTIVITIES = Object.freeze([
  {
    id: 'additive-strategies',
    title: 'Resolver y comprobar problemas aditivos',
    skillIds: ['addition', 'subtraction', 'estimation'],
    instructions: 'Planteen un problema de suma o resta, comparen procedimientos y estimen el resultado antes de comprobarlo.',
  },
  {
    id: 'multiplicative-strategies',
    title: 'Explicar agrupaciones y repartos',
    skillIds: ['multiplication', 'division', 'estimation'],
    instructions: 'Resuelvan un problema de agrupación o reparto. Expliquen la relación entre multiplicar y dividir y comprueben la respuesta.',
  },
  {
    id: 'fraction-strategies',
    title: 'Representar fracciones y comprobar cantidades',
    skillIds: ['fraction', 'estimation'],
    instructions: 'Representen fracciones de una misma unidad, expliquen su valor y estimen si la respuesta de un problema tiene sentido.',
  },
  {
    id: 'challenge',
    title: 'Contrastar estrategias y crear un contraejemplo',
    skillIds: DIMENSION_IDS,
    advanced: true,
    instructions: 'Resuelvan un problema de dos formas y construyan un ejemplo que permita detectar una regla incorrecta sobre fracciones.',
  },
])

export function getLearningRoute(skills) {
  const weakest = MATCHING_DIMENSIONS.reduce((current, skill) => skills[skill.id] < skills[current.id] ? skill : current)
  return skills[weakest.id] >= MIN_HELPER_SCORE ? 'Profundización' : `Practicar ${weakest.label.toLowerCase()}`
}

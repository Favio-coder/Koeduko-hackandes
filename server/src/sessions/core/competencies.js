/**
 * Competencia y capacidades del Curriculo Nacional (primaria, Peru) que el reporte de cierre
 * documenta. Misma lista que src/shared/constants/contracts.js (el servidor es un proyecto aparte y
 * no puede importarla; un test verifica que no se desalineen).
 */

export const COMPETENCY = Object.freeze({ id: 'resuelve-problemas-cantidad', nombre: 'Resuelve problemas de cantidad' })

export const CAPABILITY_IDS = Object.freeze({
  TRADUCE: 'traduce',
  COMUNICA: 'comunica',
  ESTRATEGIAS: 'usa-estrategias',
  ARGUMENTA: 'argumenta',
})

/** En el orden del Curriculo Nacional. */
export const CAPABILITIES = Object.freeze([
  { id: CAPABILITY_IDS.TRADUCE, nombre: 'Traduce cantidades a expresiones numéricas' },
  { id: CAPABILITY_IDS.COMUNICA, nombre: 'Comunica su comprensión sobre los números y las operaciones' },
  { id: CAPABILITY_IDS.ESTRATEGIAS, nombre: 'Usa estrategias y procedimientos de estimación y cálculo' },
  { id: CAPABILITY_IDS.ARGUMENTA, nombre: 'Argumenta afirmaciones sobre las relaciones numéricas y las operaciones' },
])

/** Estados de una capacidad. NUNCA una nota (AD/A/B/C): la calificacion es del docente. */
export const EVIDENCE_STATE = Object.freeze({
  WITH: 'con evidencia',
  PARTIAL: 'evidencia parcial',
  NONE: 'sin evidencia suficiente',
})

export const FORMATIVE_NOTE = 'Evidencia formativa: la calificación la decide el docente.'

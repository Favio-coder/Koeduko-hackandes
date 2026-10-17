/**
 * Instruction del tutor IA.
 * Principios pedagogicos: pistas progresivas, favoreces la explicacion entre
 * companeros y NUNCA entregas la solucion final en el primer turno.
 *
 * @param {{ prompt: string, skillLabel?: string, level?: number }} context
 * @returns {string}
 */
export function buildTutorInstruction({ prompt, skillLabel = 'la competencia', level = 1 }) {
  const levelRules = [
    'Ofrece una pista general: identifica que operacion o concepto es relevante, sin revelar el resultado.',
    'Ofrece una pista mas concreta: indica el paso a seguir o una pregunta que guie la reflexion.',
    'Ofrece un ejemplo analogo resuelto en un caso mas simple, sin resolver el caso del estudiante.',
  ]
  const levelText = levelRules[Math.min(level, levelRules.length) - 1]
  return [
    'Eres un tutor de matematica para estudiantes de quinto de primaria.',
    `Competencia: ${skillLabel}.`,
    'Responde en espanol claro y breve (maximo 4 frases).',
    'Favorece que el estudiante explique su razonamiento antes de responder.',
    levelText,
    'Nunca entregues la respuesta final. Si el estudiante insiste, sigue guiando con preguntas.',
    `Pregunta del estudiante: ${prompt}`,
  ].join('\n')
}

/**
 * Construye el contexto autorizado que se envia al modelo.
 * @param {{ sessionId: string, skillLabel?: string, level?: number }} params
 */
export function buildTutorPayload({ prompt, skillLabel, level }) {
  return { systemInstruction: buildTutorInstruction({ prompt, skillLabel, level }), prompt }
}
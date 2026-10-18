export const statusLabels = { draft: 'Borrador', published: 'Publicada', closed: 'Cerrada', finalized: 'Finalizada' }
export const typeOptions = [
  { value: 'diagnostic', label: 'Diagnóstico' }, { value: 'exam', label: 'Examen' },
  { value: 'practice', label: 'Práctica' }, { value: 'homework', label: 'Tarea' },
]
export function localDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export function newAssessment(course) {
  return {
    title: '',
    description: '',
    courseId: course.id,
    areaId: course.areas?.[0]?.id || '',
    competencyId: course.competencyId,
    type: 'diagnostic',
    scale: 20,
    maxScore: 20,
    durationMinutes: 30,
    attemptLimit: 1,
    weightPercent: 0,
    academicWeightPercent: null,
    feedbackMode: 'after_close',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    studentIds: course.students.map(s => s.id),
    questions: [],
  }
}
export function newQuestion(skillId) {
  return { questionId: crypto.randomUUID(), prompt: '', type: 'multiple_choice', options: ['', '', '', ''], correctAnswer: 0, skillId, maxScore: 1, explanation: '' }
}

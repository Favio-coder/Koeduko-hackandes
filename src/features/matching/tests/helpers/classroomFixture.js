/** Contratos de API ficticios exclusivamente para pruebas de integración. */
export function classroomFixture(count = 2) {
  const students = Array.from({ length: count }, (_, index) => ({
    studentId: 'enrolled-' + (index + 1),
    overallScore: index % 2 ? 4 : 8, maxScore: 10,
    skills: [{ skillId: 'addition', score: index % 2 ? 4 : 8, maxScore: 10, mastery: index % 2 ? 0.4 : 0.8, evidenceCount: 2 }],
  }))
  const profile = {
    schemaVersion: '1.0', courseId: 'course-5a', assessmentId: 'assessment-final',
    competencyId: 'resuelve-problemas-cantidad', generatedAt: '2026-10-17T21:00:00.000Z',
    status: 'finalized', students,
  }
  const catalog = {
    courses: [{ id: profile.courseId, name: 'Matemática 5A', students: students.map(({ studentId }, index) => ({ id: studentId, name: ['Valeria', 'Mateo', 'Camila', 'Pedro', 'Elena'][index] || studentId })) }],
    assessments: [{ id: profile.assessmentId, courseId: profile.courseId, title: 'Diagnóstico final', competencyId: profile.competencyId, status: 'finalized' }],
  }
  return { profile, catalog }
}

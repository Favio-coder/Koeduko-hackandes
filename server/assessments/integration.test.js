import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createAssessmentService } from './service.js'

// Fail closed: these tests must NEVER reach a real Firebase project.
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Run via npm run test:assessments:integration')
const projectId = 'demo-koeduko-assessments'
const app = initializeApp({ projectId })
const db = getFirestore(app)
const execute = createAssessmentService(db)
let student1, student2, token
const teacher = 'teacher-1', courseId = 'course-1'
const definition = () => ({ title: 'Diagnóstico integración', courseId, competencyId: 'resuelve-problemas-cantidad', type: 'diagnostic', scale: 20, maxScore: 10, attemptLimit: 1, durationMinutes: 30, weightPercent: 0, feedbackMode: 'after_close', startsAt: new Date(Date.now() - 10000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), studentIds: [student1, student2], questions: [
  { questionId: 'q1', prompt: '2 + 3', type: 'multiple_choice', options: ['5', '6'], correctAnswer: 0, skillId: 'addition', maxScore: 5, explanation: 'Sumamos.' },
  { questionId: 'q2', prompt: '4 - 1 = 3', type: 'true_false', options: ['Verdadero', 'Falso'], correctAnswer: 0, skillId: 'subtraction', maxScore: 3, explanation: '' },
  { questionId: 'q3', prompt: '1/2 equivale a 2/4', type: 'true_false', options: ['Verdadero', 'Falso'], correctAnswer: 0, skillId: 'fraction', maxScore: 2, explanation: '' },
] })
const allCorrect = { q1: 0, q2: 0, q3: 0 }
async function signup() {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) })
  assert.equal(response.status, 200)
  return response.json()
}
before(async () => {
  const first = await signup(), second = await signup()
  student1 = first.localId; student2 = second.localId; token = first.idToken
  for (const uid of [student1, student2]) await db.doc(`users/${uid}`).set({ role: 'student', classroomId: courseId, displayName: uid })
  for (const uid of [teacher, 'teacher-other']) await db.doc(`users/${uid}`).set({ role: 'teacher', classroomId: null })
  await db.doc('users/outsider').set({ role: 'student', classroomId: courseId })
  await db.doc(`assessmentCourseAccess/${courseId}`).set({ name: 'Matemática 5A', teacherId: teacher, studentIds: [student1, student2] })
})
after(async () => { await db.terminate(); await deleteApp(app) })

test('creación, edición con revisión, publicación, permisos y asignación', async () => {
  const saved = await execute(teacher, 'save', { ...definition(), questions: [] })
  const detail = await execute(teacher, 'detail', { assessmentId: saved.id })
  assert.equal(detail.status, 'draft')
  await assert.rejects(execute(student1, 'detail', { assessmentId: saved.id }), { status: 403 })
  await assert.rejects(execute('teacher-other', 'save', definition()), { status: 403 })
  await assert.rejects(execute(student1, 'publish', definition()), { status: 403 })
  await assert.rejects(execute(teacher, 'publish', { ...detail, questions: [] }), { status: 400 })
  await execute(teacher, 'publish', { ...definition(), id: saved.id, revision: detail.revision })
  await assert.rejects(execute(teacher, 'save', { ...definition(), id: saved.id, revision: detail.revision }), { status: 409 })
  await assert.rejects(execute('outsider', 'start', { assessmentId: saved.id }), { status: 403 })
  await assert.rejects(execute('teacher-other', 'results', { assessmentId: saved.id }), { status: 403 })
  const studentView = await execute(student1, 'detail', { assessmentId: saved.id })
  assert.equal(studentView.studentIds, undefined)
  assert.equal(studentView.questions, undefined)
})

test('dos estudiantes, persistencia real, envíos concurrentes idempotentes y contrato oficial', async () => {
  const { id } = await execute(teacher, 'publish', definition())
  const start = await execute(student1, 'start', { assessmentId: id })
  assert.equal(start.assessment.questions[0].correctAnswer, undefined)
  assert.equal(start.assessment.questions[0].explanation, undefined)
  const repeatedStart = await execute(student1, 'start', { assessmentId: id })
  assert.equal(repeatedStart.attempt.id, start.attempt.id)
  const saved = await execute(student1, 'saveAnswers', { assessmentId: id, attemptId: start.attempt.id, revision: 0, answers: { q1: 0 } })
  assert.deepEqual(saved.feedback, [])
  await assert.rejects(execute(student1, 'submit', { assessmentId: id, attemptId: start.attempt.id, revision: 0, answers: allCorrect }), { status: 409 })
  await assert.rejects(execute(student1, 'submit', { assessmentId: id, attemptId: start.attempt.id, revision: 1, answers: { q1: 0 } }), { status: 400 })
  const submission = { assessmentId: id, attemptId: start.attempt.id, revision: 1, answers: allCorrect }
  const [first, duplicate] = await Promise.all([execute(student1, 'submit', submission), execute(student1, 'submit', submission)])
  assert.deepEqual(first, duplicate)
  assert.equal(first.scaledScore, 20)
  assert.equal(first.result.skills[0].mastery, 1)
  assert.equal(first.result.skills[0].evidenceCount, 1)
  assert.deepEqual(first.feedback, [])
  await assert.rejects(execute(student1, 'start', { assessmentId: id }), { status: 409 })
  await assert.rejects(execute(student2, 'submit', submission), { status: 404 })
  const partial = await execute(teacher, 'results', { assessmentId: id })
  assert.equal(partial.assignments.filter(r => !r.result).length, 1)
  await assert.rejects(execute(teacher, 'export', { assessmentId: id, courseId }), { status: 409 })
  const second = await execute(student2, 'start', { assessmentId: id })
  await execute(student2, 'submit', { assessmentId: id, attemptId: second.attempt.id, revision: 0, answers: { q1: 1, q2: 0, q3: 0 } })
  await execute(teacher, 'close', { assessmentId: id })
  const review = await execute(student1, 'review', { assessmentId: id })
  assert.equal(review.feedback.length, 3)
  await execute(teacher, 'finalize', { assessmentId: id })
  const contract = await execute(teacher, 'export', { assessmentId: id, courseId })
  assert.equal(contract.schemaVersion, '1.0')
  assert.deepEqual(contract.students.map(s => s.overallScore), [10, 5])
  for (const result of contract.students) {
    assert.equal(result.skills.reduce((n, s) => n + s.score, 0), result.overallScore)
    assert.equal(result.skills.reduce((n, s) => n + s.maxScore, 0), result.maxScore)
  }
  assert.deepEqual(await execute(teacher, 'export', { assessmentId: id, courseId }), contract)
  await assert.rejects(execute(student1, 'export', { assessmentId: id, courseId }), { status: 403 })
  await assert.rejects(execute(teacher, 'export', { assessmentId: id, courseId: 'other' }), { status: 403 })
  const stored = (await db.doc(`assessmentModules/${id}/assignments/${student1}/attempts/${start.attempt.id}`).get()).data()
  assert.equal(stored.status, 'graded')
  assert.deepEqual(stored.answers, allCorrect)
})

test('cierre con pendientes nunca finaliza y conserva respuestas sin fabricar notas', async () => {
  const { id } = await execute(teacher, 'publish', definition())
  const start = await execute(student1, 'start', { assessmentId: id })
  await execute(student1, 'saveAnswers', { assessmentId: id, attemptId: start.attempt.id, revision: 0, answers: { q1: 0 } })
  await execute(teacher, 'close', { assessmentId: id })
  await assert.rejects(execute(teacher, 'finalize', { assessmentId: id }), { status: 409 })
  await assert.rejects(execute(student1, 'submit', { assessmentId: id, attemptId: start.attempt.id, revision: 1, answers: allCorrect }), { status: 409 })
  const stored = (await db.doc(`assessmentModules/${id}/assignments/${student1}/attempts/${start.attempt.id}`).get()).data()
  assert.deepEqual(stored.answers, { q1: 0 })
  assert.equal(stored.status, 'cancelled')
})

test('retroalimentación inmediata bloquea respuestas y solo existe en práctica', async () => {
  const { id } = await execute(teacher, 'publish', { ...definition(), type: 'practice', feedbackMode: 'immediate' })
  const start = await execute(student1, 'start', { assessmentId: id })
  const response = await execute(student1, 'saveAnswers', { assessmentId: id, attemptId: start.attempt.id, revision: 0, answers: { q1: 1 } })
  assert.equal(response.feedback[0].correctAnswer, 0)
  await assert.rejects(execute(student1, 'saveAnswers', { assessmentId: id, attemptId: start.attempt.id, revision: 1, answers: { q1: 0 } }), { status: 409 })
  const resumed = await execute(student1, 'start', { assessmentId: id })
  assert.equal(resumed.feedback.length, 1)
})

test('fechas, duración e intentos adicionales se validan en servidor', async () => {
  const { id } = await execute(teacher, 'publish', { ...definition(), startsAt: new Date(Date.now() + 60000).toISOString() })
  await assert.rejects(execute(student1, 'start', { assessmentId: id }), { status: 409 })
  const current = await execute(teacher, 'publish', definition())
  const start = await execute(student1, 'start', { assessmentId: current.id })
  await db.doc(`assessmentModules/${current.id}/assignments/${student1}/attempts/${start.attempt.id}`).update({ expiresAt: new Date(Date.now() - 1000).toISOString() })
  await assert.rejects(execute(student1, 'submit', { assessmentId: current.id, attemptId: start.attempt.id, revision: 0, answers: allCorrect }), { status: 409 })
  await assert.rejects(execute(student1, 'start', { assessmentId: current.id }), { status: 409 })
})

test('reglas Firestore niegan lectura de claves, escritura de notas y cambios de ACL desde cliente', async () => {
  const { id } = await execute(teacher, 'publish', definition())
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  for (const path of [`assessmentModules/${id}`, `assessmentModules/${id}/private/definition`, `assessmentCourseAccess/${courseId}`]) {
    const response = await fetch(`${base}/${path}`, { headers })
    assert.equal(response.status, 403, path)
  }
  for (const path of [`assessmentModules/${id}/assignments/${student1}`, `assessmentCourseAccess/${courseId}`]) {
    const response = await fetch(`${base}/${path}`, { method: 'PATCH', headers, body: JSON.stringify({ fields: { overallScore: { integerValue: '100' } } }) })
    assert.equal(response.status, 403, path)
  }
})

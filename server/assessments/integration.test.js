import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import assessmentsHandler from '../../api/assessments.js'
import matchingProfileHandler from '../../api/assessments/matching-profile.js'
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

test('el endpoint HTTP verifica ID tokens, rol docente y JSON de entrada', async () => {
  const makeResponse = () => ({
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  })
  const invoke = async ({ method = 'POST', authorization, body }) => {
    const response = makeResponse()
    await assessmentsHandler({ method, headers: { authorization }, body }, response)
    return response
  }

  const bootstrap = await invoke({
    authorization: `Bearer ${token}`,
    body: { action: 'bootstrap' },
  })
  assert.equal(bootstrap.statusCode, 200)
  assert.equal(bootstrap.body.courses[0].competencies[0].id, 'resuelve-problemas-cantidad')

  const teacherAuth = await signup()
  const endpointCourseId = 'endpoint-course'
  await db.doc(`users/${teacherAuth.localId}`).set({
    role: 'teacher',
    classroomId: null,
    displayName: 'Docente API',
  })
  await db.doc(`assessmentCourseAccess/${endpointCourseId}`).set({
    name: 'Curso endpoint',
    teacherId: teacherAuth.localId,
    studentIds: [student1, student2],
  })
  const apiPayload = { ...definition(), courseId: endpointCourseId }
  const draft = await invoke({
    authorization: `Bearer ${teacherAuth.idToken}`,
    body: { action: 'save', payload: apiPayload },
  })
  assert.equal(draft.statusCode, 200)
  const draftDetail = await invoke({
    authorization: `Bearer ${teacherAuth.idToken}`,
    body: { action: 'detail', payload: { assessmentId: draft.body.id } },
  })
  assert.equal(draftDetail.statusCode, 200)
  assert.equal(draftDetail.body.status, 'draft')
  const published = await invoke({
    authorization: `Bearer ${teacherAuth.idToken}`,
    body: {
      action: 'publish',
      payload: {
        ...apiPayload,
        id: draft.body.id,
        revision: draftDetail.body.revision,
      },
    },
  })
  assert.equal(published.statusCode, 200)
  const storedAssessment = await db
    .doc(`assessmentModules/${draft.body.id}`)
    .get()
  assert.equal(storedAssessment.data().status, 'published')
  assert.equal(
    (await db
      .doc(`assessmentModules/${draft.body.id}/assignments/${student1}`)
      .get()).exists,
    true,
  )

  const firstStart = await invoke({
    authorization: `Bearer ${token}`,
    body: {
      action: 'start',
      payload: { assessmentId: draft.body.id },
    },
  })
  assert.equal(firstStart.statusCode, 200)
  assert.equal(
    firstStart.body.assessment.questions.some(
      (question) => 'correctAnswer' in question || 'explanation' in question,
    ),
    false,
  )
  const answerSave = await invoke({
    authorization: `Bearer ${token}`,
    body: {
      action: 'saveAnswers',
      payload: {
        assessmentId: draft.body.id,
        attemptId: firstStart.body.attempt.id,
        revision: 0,
        answers: { q1: 1 },
      },
    },
  })
  assert.equal(answerSave.statusCode, 200)
  const resumed = await invoke({
    authorization: `Bearer ${token}`,
    body: {
      action: 'start',
      payload: { assessmentId: draft.body.id },
    },
  })
  assert.equal(resumed.body.attempt.id, firstStart.body.attempt.id)
  assert.deepEqual(resumed.body.attempt.answers, { q1: 1 })
  const finalSubmission = await invoke({
    authorization: `Bearer ${token}`,
    body: {
      action: 'submit',
      payload: {
        assessmentId: draft.body.id,
        attemptId: firstStart.body.attempt.id,
        revision: answerSave.body.revision,
        answers: allCorrect,
      },
    },
  })
  assert.equal(finalSubmission.statusCode, 200)
  const repeatedSubmission = await invoke({
    authorization: `Bearer ${token}`,
    body: {
      action: 'submit',
      payload: {
        assessmentId: draft.body.id,
        attemptId: firstStart.body.attempt.id,
        revision: answerSave.body.revision,
        answers: { q1: 1, q2: 1, q3: 1 },
      },
    },
  })
  assert.deepEqual(repeatedSubmission.body, finalSubmission.body)
  const noMoreAttempts = await invoke({
    authorization: `Bearer ${token}`,
    body: {
      action: 'start',
      payload: { assessmentId: draft.body.id },
    },
  })
  assert.equal(noMoreAttempts.statusCode, 409)
  const unassignedAuth = await signup()
  await db.doc(`users/${unassignedAuth.localId}`).set({
    role: 'student',
    classroomId: 'other-course',
    displayName: 'Estudiante sin asignación',
  })
  const unassignedStart = await invoke({
    authorization: `Bearer ${unassignedAuth.idToken}`,
    body: {
      action: 'start',
      payload: { assessmentId: draft.body.id },
    },
  })
  assert.equal(unassignedStart.statusCode, 403)
  const storedAttempt = await db
    .doc(
      `assessmentModules/${draft.body.id}/assignments/${student1}/attempts/${firstStart.body.attempt.id}`,
    )
    .get()
  assert.equal(storedAttempt.data().status, 'graded')
  assert.deepEqual(storedAttempt.data().answers, allCorrect)

  const forbidden = await invoke({
    authorization: `Bearer ${token}`,
    body: { action: 'save', payload: { courseId } },
  })
  assert.equal(forbidden.statusCode, 403)

  const invalidToken = await invoke({
    authorization: 'Bearer invalid-token',
    body: { action: 'bootstrap' },
  })
  assert.equal(invalidToken.statusCode, 401)

  const malformedJson = await invoke({
    authorization: `Bearer ${token}`,
    body: '{"action":',
  })
  assert.equal(malformedJson.statusCode, 400)

  const wrongMethod = await invoke({
    method: 'GET',
    authorization: `Bearer ${token}`,
    body: {},
  })
  assert.equal(wrongMethod.statusCode, 405)
  assert.equal(wrongMethod.headers.Allow, 'POST')
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

test('endpoint matching-profile autoriza, rechaza incompletos y devuelve StudentKnowledgeProfile v1.0 exacto', async () => {
  const teacherAuth = await signup()
  const matchingCourseId = 'matching-profile-course'
  const teacherDb = db.doc(`users/${teacherAuth.localId}`)
  await teacherDb.set({ role: 'teacher', classroomId: null, displayName: 'Docente' })
  await db.doc(`assessmentCourseAccess/${matchingCourseId}`).set({
    name: 'Curso de matching',
    teacherId: teacherAuth.localId,
    studentIds: [student1, student2],
  })
  const teacherExecute = createAssessmentService(db)
  const payload = {
    ...definition(),
    courseId: matchingCourseId,
    scale: 100,
  }
  const { id } = await teacherExecute(teacherAuth.localId, 'publish', payload)
  const firstStart = await execute(student1, 'start', { assessmentId: id })
  const firstResult = await execute(student1, 'submit', {
    assessmentId: id,
    attemptId: firstStart.attempt.id,
    revision: 0,
    answers: { q1: 1, q2: 0, q3: 0 },
  })
  assert.equal(firstResult.result.overallScore, 5)
  assert.equal(firstResult.result.maxScore, 10)
  assert.equal(firstResult.scaledScore, 50)
  const assignment = (
    await db.doc(`assessmentModules/${id}/assignments/${student1}`).get()
  ).data()
  assert.equal(assignment.scaledScore, 50)
  assert.deepEqual(assignment.result.skills, [
    { skillId: 'addition', score: 0, maxScore: 5, evidenceCount: 1, mastery: 0 },
    { skillId: 'subtraction', score: 3, maxScore: 3, evidenceCount: 1, mastery: 1 },
    { skillId: 'fraction', score: 2, maxScore: 2, evidenceCount: 1, mastery: 1 },
  ])

  const responseFor = () => ({
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  })
  const invoke = async ({ authorization, query = {}, method = 'GET' }) => {
    const response = responseFor()
    await matchingProfileHandler(
      { method, headers: { authorization }, query },
      response,
    )
    return response
  }
  const incomplete = await invoke({
    authorization: `Bearer ${teacherAuth.idToken}`,
    query: { courseId: matchingCourseId, assessmentId: id },
  })
  assert.equal(incomplete.statusCode, 409)

  const secondStart = await execute(student2, 'start', { assessmentId: id })
  await execute(student2, 'submit', {
    assessmentId: id,
    attemptId: secondStart.attempt.id,
    revision: 0,
    answers: allCorrect,
  })
  await teacherExecute(teacherAuth.localId, 'close', { assessmentId: id })
  await teacherExecute(teacherAuth.localId, 'finalize', { assessmentId: id })

  const contractResponse = await invoke({
    authorization: `Bearer ${teacherAuth.idToken}`,
    query: { courseId: matchingCourseId, assessmentId: id },
  })
  assert.equal(contractResponse.statusCode, 200)
  const contract = JSON.parse(JSON.stringify(contractResponse.body))
  assert.deepEqual(Object.keys(contract), [
    'schemaVersion',
    'courseId',
    'assessmentId',
    'competencyId',
    'generatedAt',
    'status',
    'students',
  ])
  assert.equal(contract.schemaVersion, '1.0')
  assert.equal(contract.status, 'finalized')
  assert.equal(contract.courseId, matchingCourseId)
  assert.equal(contract.assessmentId, id)
  assert.equal(Number.isNaN(Date.parse(contract.generatedAt)), false)
  assert.deepEqual(Object.keys(contract.students[0]), [
    'studentId',
    'overallScore',
    'maxScore',
    'skills',
  ])
  assert.deepEqual(Object.keys(contract.students[0].skills[0]), [
    'skillId',
    'score',
    'maxScore',
    'mastery',
    'evidenceCount',
  ])
  assert.equal(contract.students[0].overallScore, 5)
  assert.equal(contract.students[0].maxScore, 10)

  const unauthorized = await invoke({
    authorization: `Bearer ${token}`,
    query: { courseId: matchingCourseId, assessmentId: id },
  })
  assert.equal(unauthorized.statusCode, 403)
  const invalidToken = await invoke({
    authorization: 'Bearer invalid',
    query: { courseId: matchingCourseId, assessmentId: id },
  })
  assert.equal(invalidToken.statusCode, 401)
  const missingParameters = await invoke({
    authorization: `Bearer ${teacherAuth.idToken}`,
    query: { courseId: matchingCourseId },
  })
  assert.equal(missingParameters.statusCode, 400)
  const wrongMethod = await invoke({
    method: 'POST',
    authorization: `Bearer ${teacherAuth.idToken}`,
    query: { courseId: matchingCourseId, assessmentId: id },
  })
  assert.equal(wrongMethod.statusCode, 405)
  assert.equal(wrongMethod.headers.Allow, 'GET')
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

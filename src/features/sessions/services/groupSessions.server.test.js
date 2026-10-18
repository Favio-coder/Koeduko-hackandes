import { describe, expect, it } from 'vitest'
import { publishGroupSessions, registerMeeting } from '../../../../server/assessments/groupSessions'

function fixture(count = 2) {
  const ids = Array.from({ length: count }, (_, i) => 'student-' + (i + 1))
  const evidence = ids.map((studentId, i) => ({
    studentId, overallScore: i % 2 ? 4 : 8, maxScore: 10,
    skills: [{ skillId: 'addition', score: i % 2 ? 4 : 8, maxScore: 10, mastery: i % 2 ? 0.4 : 0.8, evidenceCount: 2 }],
  }))
  const rows = new Map([
    ['users/teacher', { role: 'teacher' }],
    ['users/other-teacher', { role: 'teacher' }],
    ['assessmentCourseAccess/course', { teacherId: 'teacher', studentIds: [...ids, 'not-assessed'], name: 'Matemática' }],
    ['assessmentModules/exam', { ownerId: 'teacher', courseId: 'course', studentIds: ids, status: 'finalized', maxScore: 10, title: 'Diagnóstico' }],
    ...ids.map((id) => ['users/' + id, { role: 'student', displayName: 'Nombre ' + id }]),
    ...evidence.map((result) => ['assessmentModules/exam/assignments/' + result.studentId, { studentId: result.studentId, resultStatus: 'graded', result, activeAttemptId: null }]),
  ])
  const ref = (path) => ({ path, collection: (name) => ({ doc: (id) => ref(path + '/' + name + '/' + id) }) })
  let pending = Promise.resolve()
  const db = {
    doc: ref,
    runTransaction: (work) => {
      const run = pending.then(async () => {
        const writes = []
        const result = await work({
          get: async (reference) => ({ exists: rows.has(reference.path), data: () => structuredClone(rows.get(reference.path)) }),
          set: (reference, data) => writes.push([reference.path, data]),
          update: (reference, data) => writes.push([reference.path, { ...rows.get(reference.path), ...data }]),
        })
        for (const [path, data] of writes) rows.set(path, data)
        return result
      })
      pending = run.catch(() => {})
      return run
    },
  }
  const groups = count % 2 ? [{ studentIds: ids.slice(0, 3), focusSkillIds: ['addition'] }] : []
  for (let i = count % 2 ? 3 : 0; i < count; i += 2) groups.push({ studentIds: ids.slice(i, i + 2), focusSkillIds: ['addition'] })
  return { rows, db, input: { courseId: 'course', assessmentId: 'exam', groups, assessmentEvidence: evidence } }
}

describe('confirmar agrupamiento y persistir salas privadas', () => {
  it('solo crea una sala con los dos evaluados, aunque haya más matriculados', async () => {
    const { db, rows, input } = fixture()
    const result = await publishGroupSessions(db, 'teacher', input)
    expect(result.sessionIds).toHaveLength(1)
    const session = rows.get('learningSessions/' + result.sessionIds[0])
    expect(session).toMatchObject({ createdBy: 'teacher', studentIds: ['student-1', 'student-2'], assessmentId: 'exam', courseId: 'course', status: 'scheduled', meetingUrl: null })
    expect(session.members[0].displayName).toBe('Nombre student-1')
    expect(session).not.toHaveProperty('expectedAnswer')
  })
  it('dos peticiones concurrentes reutilizan las mismas salas sin duplicar', async () => {
    const { db, rows, input } = fixture(6)
    const [first, second] = await Promise.all([publishGroupSessions(db, 'teacher', input), publishGroupSessions(db, 'teacher', input)])
    expect(second.sessionIds).toEqual(first.sessionIds)
    expect(second.alreadyCreated).toBe(true)
    expect([...rows.keys()].filter((path) => path.startsWith('learningSessions/'))).toHaveLength(3)
  })
  it('guarda un trío íntegro sin convertirlo en una pareja ficticia', async () => {
    const { db, rows, input } = fixture(5)
    const result = await publishGroupSessions(db, 'teacher', input)
    expect(result.sessionIds).toHaveLength(2)
    const sessions = result.sessionIds.map((id) => rows.get('learningSessions/' + id))
    expect(sessions.map((session) => session.studentIds.length).sort()).toEqual([2, 3])
    expect(sessions.find((session) => session.studentIds.length === 3).pairId).toBeNull()
  })
  it.each(['student-1', 'other-teacher'])('rechaza a un usuario sin autoridad sobre el curso: %s', async (uid) => {
    const { db, rows, input } = fixture()
    await expect(publishGroupSessions(db, uid, input)).rejects.toMatchObject({ status: 403 })
    expect([...rows.keys()].some((path) => path.startsWith('learningSessions/'))).toBe(false)
  })
  it.each(['outsider', 'duplicate', 'missing', 'stale', 'unfinalized', 'ungraded', 'invented-focus'])('no publica resultados inválidos: %s', async (kind) => {
    const { db, rows, input } = fixture(4)
    if (kind === 'outsider') input.groups[0].studentIds[0] = 'not-assessed'
    if (kind === 'duplicate') input.groups[0].studentIds[0] = input.groups[0].studentIds[1]
    if (kind === 'missing') input.groups.pop()
    if (kind === 'stale') input.assessmentEvidence[0].skills[0].mastery = 0.1
    if (kind === 'unfinalized') rows.get('assessmentModules/exam').status = 'published'
    if (kind === 'ungraded') rows.get('assessmentModules/exam/assignments/student-1').resultStatus = 'pending'
    if (kind === 'invented-focus') input.groups[0].focusSkillIds = ['fraction']
    await expect(publishGroupSessions(db, 'teacher', input)).rejects.toBeInstanceOf(Error)
    expect([...rows.keys()].some((path) => path.startsWith('learningSessions/'))).toBe(false)
  })
  it('impide reemplazar grupos confirmados por otra distribución', async () => {
    const { db, input } = fixture(4)
    await publishGroupSessions(db, 'teacher', input)
    input.groups = [{ studentIds: ['student-1', 'student-3'], focusSkillIds: ['addition'] }, { studentIds: ['student-2', 'student-4'], focusSkillIds: ['addition'] }]
    await expect(publishGroupSessions(db, 'teacher', input)).rejects.toMatchObject({ status: 409 })
  })
  it('solo el docente dueño registra un enlace válido antes de iniciar', async () => {
    const { db, rows, input } = fixture()
    const { sessionIds: [sessionId] } = await publishGroupSessions(db, 'teacher', input)
    const request = { sessionId, meetingUrl: 'https://meet.google.com/abc-defg-hij' }
    await expect(registerMeeting(db, 'student-1', request)).rejects.toMatchObject({ status: 403 })
    await expect(registerMeeting(db, 'other-teacher', request)).rejects.toMatchObject({ status: 403 })
    await expect(registerMeeting(db, 'teacher', { ...request, meetingUrl: 'javascript:alert(1)' })).rejects.toMatchObject({ status: 400 })
    await registerMeeting(db, 'teacher', request)
    expect(rows.get('learningSessions/' + sessionId).meetingUrl).toBe(request.meetingUrl)
    rows.get('learningSessions/' + sessionId).status = 'live'
    await expect(registerMeeting(db, 'teacher', request)).rejects.toMatchObject({ status: 409 })
  })
})

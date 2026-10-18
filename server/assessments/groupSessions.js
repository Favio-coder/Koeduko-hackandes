import { createHash } from 'node:crypto'
import { buildMatchingContract, requireThat, validId } from './domain.js'
import { SKILL_IDS } from '../../src/shared/constants/contracts.js'

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const evidence = (students) => students.map((student) => ({
  studentId: student.studentId, overallScore: student.overallScore, maxScore: student.maxScore,
  skills: student.skills.map(({ skillId, score, maxScore, mastery, evidenceCount }) =>
    ({ skillId, score, maxScore, mastery, evidenceCount })).sort((a, b) => a.skillId.localeCompare(b.skillId)),
})).sort((a, b) => a.studentId.localeCompare(b.studentId))

/** Confirma una propuesta del docente, sin aceptar matrícula, nombres ni notas inventadas. */
export async function publishGroupSessions(db, uid, input, now = () => new Date().toISOString()) {
  const { courseId, assessmentId, groups, assessmentEvidence } = input ?? {}
  requireThat(validId(courseId) && validId(assessmentId), 'Curso y evaluación inválidos.')
  requireThat(Array.isArray(groups) && groups.length > 0 && groups.length <= 20, 'Se requieren grupos de estudiantes.')
  requireThat(Array.isArray(assessmentEvidence) && assessmentEvidence.length <= 40 && assessmentEvidence.every((s) => s && validId(s.studentId) && Array.isArray(s.skills) && s.skills.every((skill) => skill && validId(skill.skillId))), 'Falta la evidencia de la evaluación.')
  const members = groups.map((group) => {
    requireThat(group && Array.isArray(group.studentIds) && [2, 3].includes(group.studentIds.length) && group.studentIds.every(validId), 'Los grupos deben tener dos o tres integrantes válidos.')
    requireThat(Array.isArray(group.focusSkillIds) && group.focusSkillIds.every((id) => SKILL_IDS.includes(id)), 'Habilidades del grupo inválidas.')
    return [...group.studentIds].sort()
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const flat = members.flat()
  requireThat(flat.length <= 40 && new Set(flat).size === flat.length && members.filter((g) => g.length === 3).length === flat.length % 2, 'Hay integrantes repetidos o una distribución inválida.')
  const resultId = 'confirmed-' + digest([uid, courseId, assessmentId]).slice(0, 40)
  const resultRef = db.doc('matchingResults/' + resultId)

  return db.runTransaction(async (tx) => {
    const [actorSnap, courseSnap, assessmentSnap, previous] = await Promise.all([
      tx.get(db.doc('users/' + uid)), tx.get(db.doc('assessmentCourseAccess/' + courseId)),
      tx.get(db.doc('assessmentModules/' + assessmentId)), tx.get(resultRef),
    ])
    requireThat(actorSnap.data()?.role === 'teacher', 'Se requiere una cuenta docente.', 403)
    const course = courseSnap.data()
    const assessment = assessmentSnap.data()
    requireThat(course?.teacherId === uid && assessment?.ownerId === uid && assessment?.courseId === courseId, 'No tienes acceso a este curso o evaluación.', 403)
    requireThat(Array.isArray(assessment.studentIds) && assessment.studentIds.length === flat.length &&
      assessment.studentIds.every((id) => flat.includes(id) && course.studentIds?.includes(id)), 'Los grupos deben cubrir exactamente los alumnos asignados a esta evaluación.', 409)
    const assignments = await Promise.all(assessment.studentIds.map((id) => tx.get(db.doc('assessmentModules/' + assessmentId + '/assignments/' + id))))
    const contract = buildMatchingContract({ ...assessment, id: assessmentId }, assignments.map((snap) => snap.data()))
    requireThat(groups.every((group) => group.focusSkillIds.every((id) => contract.students.every((student) => student.skills.some((skill) => skill.skillId === id && skill.evidenceCount > 0)))), 'El foco del grupo debe proceder de las habilidades evaluadas.', 409)
    const evidenceHash = digest(evidence(contract.students))
    requireThat(evidenceHash === digest(evidence(assessmentEvidence)), 'Los resultados de evaluación cambiaron. Actualiza los perfiles y vuelve a agrupar.', 409)
    const groupingHash = digest(members)
    if (previous.exists) {
      const saved = previous.data()
      requireThat(saved.groupingHash === groupingHash && saved.evidenceHash === evidenceHash, 'Esta evaluación ya tiene salas confirmadas. Revisa las salas existentes.', 409)
      return { resultId, sessionIds: saved.sessionIds, alreadyCreated: true }
    }
    const userSnaps = await Promise.all(flat.map((id) => tx.get(db.doc('users/' + id))))
    const names = new Map(userSnaps.map((snap, i) => {
      requireThat(snap.data()?.role === 'student', 'Hay estudiantes que ya no están disponibles.', 409)
      return [flat[i], snap.data().displayName || flat[i]]
    }))
    const createdAt = now()
    const sessionIds = members.map((_, index) => resultId + '-g' + (index + 1))
    members.forEach((studentIds, index) => {
      const source = groups.find((g) => g.studentIds.every((id) => studentIds.includes(id)))
      const groupId = resultId + '-g' + (index + 1)
      const group = {
        id: groupId, studentIds, size: studentIds.length, focusSkillIds: source.focusSkillIds,
        members: studentIds.map((studentId) => ({ studentId, displayName: names.get(studentId) })),
      }
      tx.set(resultRef.collection('groups').doc(groupId), group)
      if (studentIds.length === 2) tx.set(resultRef.collection('pairs').doc(groupId), { id: groupId, studentAId: studentIds[0], studentBId: studentIds[1] })
      tx.set(db.doc('learningSessions/' + sessionIds[index]), {
        title: (studentIds.length === 3 ? 'Trío: ' : 'Pareja: ') + studentIds.map((id) => names.get(id)).join(' · '),
        matchingResultId: resultId, groupId, pairId: studentIds.length === 2 ? groupId : null,
        courseId, courseName: course.name || courseId, assessmentId, assessmentTitle: assessment.title || assessmentId,
        studentIds, members: group.members, createdBy: uid, createdAt,
        status: 'scheduled', scheduledAt: null, meetingUrl: null, currentProblem: null,
      })
    })
    tx.set(resultRef, { id: resultId, createdBy: uid, courseId, assessmentId, groupingHash, evidenceHash, sessionIds, createdAt, status: 'confirmed' })
    return { resultId, sessionIds, alreadyCreated: false }
  })
}

export async function registerMeeting(db, uid, input) {
  requireThat(validId(input?.sessionId) && typeof input.meetingUrl === 'string' && /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(input.meetingUrl), 'Usa un enlace válido de Google Meet.')
  return db.runTransaction(async (tx) => {
    const ref = db.doc('learningSessions/' + input.sessionId)
    const [actor, snap] = await Promise.all([tx.get(db.doc('users/' + uid)), tx.get(ref)])
    const session = snap.data()
    requireThat(actor.data()?.role === 'teacher' && session?.createdBy === uid, 'Solo el docente de esta sala puede registrar el enlace.', 403)
    requireThat(session.status === 'scheduled' && !session.bot?.id && !['requested', 'joining', 'in_call'].includes(session.bot?.status), 'El enlace solo se modifica antes de iniciar la sesión.', 409)
    tx.update(ref, { meetingUrl: input.meetingUrl, meetingProvider: 'google-meet' })
    return { sessionId: input.sessionId, meetingUrl: input.meetingUrl }
  })
}

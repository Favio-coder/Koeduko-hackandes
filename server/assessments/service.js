import { randomUUID } from "node:crypto";
import {
  assertAvailable,
  buildMatchingContract,
  courseAreas,
  courseCompetencies,
  courseSkills,
  feedbackFor,
  grade,
  publicAssessment,
  requireThat,
  validId,
  validateAnswers,
  validateAssessment,
} from "./domain.js";
import { calculateAreaAverage, normalizeGrade20 } from "./gradebook.js";

const ROOT = "assessmentModules";
const rows = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));

export function createAssessmentService(db) {
  const root = (id) => db.collection(ROOT).doc(id);
  async function courseAccess(uid, courseId, teacher = false) {
    requireThat(validId(courseId), "Curso inválido.");
    const course = (
      await db.collection("assessmentCourseAccess").doc(courseId).get()
    ).data();
    requireThat(
      course &&
        typeof course.teacherId === "string" &&
        course.teacherId.length > 0 &&
        Array.isArray(course.studentIds) &&
        (teacher ? course.teacherId === uid : course.studentIds.includes(uid)),
      "No tienes acceso a este curso.",
      403,
    );
    const competencies = courseCompetencies(course);
    return {
      ...course,
      id: courseId,
      competencyId: course.competencyId || competencies[0].id,
      competencies,
      areas: courseAreas(course),
      skills: courseSkills(course),
    };
  }
  async function actor(uid) {
    const data = (await db.collection("users").doc(uid).get()).data();
    requireThat(
      data && ["teacher", "student"].includes(data.role),
      "Perfil no autorizado.",
      403,
    );
    return data;
  }
  async function getAssessment(uid, id, teacher) {
    requireThat(validId(id), "Evaluación inválida.");
    const snap = await root(id).get();
    requireThat(snap.exists, "Evaluación no encontrada.", 404);
    const a = { ...snap.data(), id };
    await courseAccess(uid, a.courseId, teacher);
    requireThat(
      teacher
        ? a.ownerId === uid
        : a.studentIds.includes(uid) && a.status !== "draft",
      "Evaluación no asignada.",
      403,
    );
    return a;
  }
  async function privateAssessment(id) {
    return (
      await root(id).collection("private").doc("definition").get()
    ).data();
  }
  async function assignmentRows(id) {
    return rows(await root(id).collection("assignments").get());
  }
  async function gradeHistory(uid, teacher, courseId) {
    let courses;
    if (courseId) {
      courses = [await courseAccess(uid, courseId, teacher)];
    } else {
      requireThat(!teacher, "Selecciona un curso autorizado.", 400);
      courses = rows(
        await db
          .collection("assessmentCourseAccess")
          .where("studentIds", "array-contains", uid)
          .get(),
      ).map((course) => ({
        ...course,
        areas: courseAreas(course),
      }));
    }

    const records = [];
    for (const course of courses) {
      const participants = teacher
        ? course.studentIds
        : [uid];
      const courseGrades = await db.runTransaction(async (tx) => {
        const assessmentSnapshot = await tx.get(
          db.collection(ROOT).where("courseId", "==", course.id),
        );
        const assessments = rows(assessmentSnapshot).filter(
          (assessment) =>
            assessment.status !== "draft" &&
            (teacher
              ? assessment.ownerId === uid
              : assessment.studentIds?.includes(uid)),
        );
        const refs = assessments.flatMap((assessment) =>
          participants
            .filter((studentId) => assessment.studentIds?.includes(studentId))
            .map((studentId) => ({
              assessment,
              studentId,
              ref: root(assessment.id)
                .collection("assignments")
                .doc(studentId),
            })),
        );
        const snapshots = await Promise.all(
          refs.map(({ ref }) => tx.get(ref)),
        );
        return { refs, snapshots };
      });
      const { refs, snapshots } = courseGrades;
      const roster = teacher && participants.length
        ? await db.getAll(
            ...participants.map((studentId) =>
              db.collection("users").doc(studentId),
            ),
          )
        : [];
      const names = new Map(
        roster.map((snapshot) => [
          snapshot.id,
          snapshot.data()?.displayName || snapshot.id,
        ]),
      );

      refs.forEach(({ assessment, studentId }, index) => {
        const assignment = snapshots[index].data() || {
          studentId,
          count: 0,
          resultStatus: "pending",
          result: null,
        };
        const graded =
          assignment.resultStatus === "graded" && assignment.result;
        const status = graded
          ? "graded"
          : assignment.activeAttemptId
            ? "in_progress"
            : assignment.count > 0
              ? "incomplete"
              : "pending";
        const score20 = graded ? normalizeGrade20(assignment.result) : null;
        records.push({
          studentId,
          studentName: names.get(studentId) || studentId,
          courseId: course.id,
          courseName: course.name || course.id,
          areaId: assessment.areaId,
          areaName:
            course.areas?.find((area) => area.id === assessment.areaId)
              ?.label || assessment.areaId,
          assessmentId: assessment.id,
          assessmentTitle: assessment.title,
          assessmentType: assessment.type,
          assessmentStatus: assessment.status,
          attemptCount: assignment.count || 0,
          attemptId: assignment.lastAttemptId || null,
          gradeStatus: status,
          resultStatus: assignment.resultStatus || "pending",
          rawScore: graded ? assignment.result.overallScore : null,
          maxScore: graded ? assignment.result.maxScore : assessment.maxScore,
          score20,
          academicWeightPercent:
            assessment.academicWeightPercent ?? null,
          gradedAt: graded
            ? assignment.academicGrade?.gradedAt || assignment.gradedAt
            : null,
          result: graded ? assignment.result : null,
        });
      });
    }

    const groups = new Map();
    for (const record of records) {
      const key = `${record.studentId}:${record.courseId}:${record.areaId}`;
      const group = groups.get(key) || {
        studentId: record.studentId,
        studentName: record.studentName,
        courseId: record.courseId,
        courseName: record.courseName,
        areaId: record.areaId,
        areaName: record.areaName,
        records: [],
      };
      group.records.push(record);
      groups.set(key, group);
    }
    const averages = [...groups.values()].map((group) => ({
      studentId: group.studentId,
      studentName: group.studentName,
      courseId: group.courseId,
      courseName: group.courseName,
      areaId: group.areaId,
      areaName: group.areaName,
      ...calculateAreaAverage(group.records),
    }));
    records.sort((first, second) =>
      (second.gradedAt || "").localeCompare(first.gradedAt || ""),
    );
    return {
      records: records.map((record) => {
        const sanitized = { ...record };
        delete sanitized.result;
        return sanitized;
      }),
      averages,
    };
  }
  const studentMetadata = (a) => {
    const copy = { ...a };
    delete copy.studentIds;
    return copy;
  };

  /**
   * Alta automática del estudiante en el curso de destino (matemática) para que
   * una cuenta recién creada vea evaluaciones desde el primer ingreso.
   *
   * Qué cursos son de registro abierto, en orden de preferencia:
   *   1. los marcados con `selfEnrollment: true` en `assessmentCourseAccess`
   *      (la vía explícita: el docente decide a qué curso se puede entrar solo);
   *   2. y, si no hay ninguno marcado, el único curso del catálogo: en una
   *     /demo de un solo curso es exactamente el que se quiere.
   *
   * La matrícula es idempotente (no duplica al repetir la llamada) y no otorga
   * rol: sigue siendo una decisión del servidor sobre un curso que el propio
   * docente habilitó.
   */
  async function selfEnroll(uid) {
    const catalog = rows(await db.collection("assessmentCourseAccess").get());
    const open = catalog.filter(
      (course) =>
        course.selfEnrollment === true &&
        typeof course.teacherId === "string" &&
        course.teacherId.length > 0 &&
        Array.isArray(course.studentIds),
    );
    const targets = open.length ? open : catalog.length === 1 ? catalog : [];
    requireThat(
      targets.length > 0,
      "No hay cursos con registro abierto.",
      409,
    );
    const joined = [];
    for (const course of targets) {
      const ref = db.collection("assessmentCourseAccess").doc(course.id);
      const alreadyIn = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const studentIds = Array.isArray(snap.data()?.studentIds)
          ? snap.data().studentIds
          : [];
        if (studentIds.includes(uid)) return true;
        tx.update(ref, {
          studentIds: [...studentIds, uid],
          enrolledAt: new Date().toISOString(),
        });
        return false;
      });
      joined.push({ id: course.id, name: course.name, alreadyIn });
    }
    return { courses: joined, joined: joined.filter((c) => !c.alreadyIn) };
  }

  return async function execute(uid, action, payload = {}) {
    const profile = await actor(uid);
    const teacher = profile.role === "teacher";
    if (action === "selfEnroll") {
      requireThat(!teacher, "Solo estudiantes.", 403);
      return selfEnroll(uid);
    }
    if (action === "bootstrap") {
      /* Las dos consultas son independientes: en paralelo el tiempo total es el
         de la más lenta en lugar de la suma. */
      const [courseRows, assessmentRows] = await Promise.all([
        db
          .collection("assessmentCourseAccess")
          .where(
            teacher ? "teacherId" : "studentIds",
            teacher ? "==" : "array-contains",
            uid,
          )
          .get(),
        db
          .collection(ROOT)
          .where(
            teacher ? "ownerId" : "studentIds",
            teacher ? "==" : "array-contains",
            uid,
          )
          .get(),
      ]);
      const courses = rows(courseRows);
      const assessments = rows(assessmentRows).filter(
        (a) =>
          courses.some((c) => c.id === a.courseId) &&
          (teacher || a.status !== "draft"),
      );
      const enriched = await Promise.all(
        courses.map(async (c) => {
          const competencies = courseCompetencies(c);
          const roster =
            teacher && c.studentIds.length
              ? await db.getAll(
                  ...c.studentIds.map((id) => db.collection("users").doc(id)),
                )
              : [];
          return {
            id: c.id,
            name: c.name,
            competencyId: c.competencyId || competencies[0].id,
            competencies,
            areas: courseAreas(c),
            skills: courseSkills(c),
            students: roster
              .filter((s) => s.exists && s.data().role === "student")
              .map((s) => ({ id: s.id, name: s.data().displayName || s.id })),
          };
        }),
      );
      return {
        courses: enriched,
        assessments: assessments.map((a) => (teacher ? a : studentMetadata(a))),
      };
    }
    if (action === "grades") {
      return gradeHistory(uid, teacher, payload.courseId);
    }
    if (action === "save" || action === "publish") {
      requireThat(teacher, "Solo docentes.", 403);
      const course = await courseAccess(uid, payload.courseId, true);
      const data = validateAssessment(payload, course, action === "publish");
      if (action === "publish") {
        const roster = await db.getAll(
          ...data.studentIds.map((id) => db.collection("users").doc(id)),
        );
        requireThat(
          roster.every((s) => s.exists && s.data().role === "student"),
          "Todos los asignados deben tener una cuenta estudiantil.",
        );
      }
      const id = payload.id || randomUUID();
      requireThat(validId(id), "Identificador inválido.");
      const ref = root(id);
      let revision = 0;
      let updatedAt;
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists)
          requireThat(
            existing.data().ownerId === uid &&
              existing.data().status === "draft" &&
              existing.data().courseId === data.courseId &&
              existing.data().revision === payload.revision,
            "El borrador cambió o ya está publicado. Recarga antes de editar.",
            409,
          );
        else requireThat(!payload.id, "Borrador no encontrado.", 404);
        const now = new Date().toISOString();
        revision = (existing.data()?.revision || 0) + 1;
        updatedAt = now;
        const { questions, ...metadata } = data;
        tx.set(ref, {
          ...metadata,
          id,
          ownerId: uid,
          status: action === "publish" ? "published" : "draft",
          revision,
          createdAt: existing.data()?.createdAt || now,
          updatedAt: now,
        });
        tx.set(ref.collection("private").doc("definition"), { ...data, id });
        tx.set(ref.collection("public").doc("questions"), {
          questions: publicAssessment({ questions }).questions,
        });
        if (action === "publish")
          for (const studentId of data.studentIds)
            tx.set(ref.collection("assignments").doc(studentId), {
              studentId,
              count: 0,
              activeAttemptId: null,
              resultStatus: "pending",
              result: null,
            });
      });
      /* La revisión viaja en la respuesta: el cliente actualiza su copia sin
         pedir `detail` y se ahorra una ida y vuelta completa. */
      return { id, revision, updatedAt };
    }
    if (action === "detail" && teacher) {
      /* Autorización y definición privada son lecturas independientes. */
      const [assessment, privateDefinition] = await Promise.all([
        getAssessment(uid, payload.assessmentId, true),
        privateAssessment(payload.assessmentId),
      ]);
      return { ...assessment, ...privateDefinition };
    }
    const a = await getAssessment(uid, payload.assessmentId, teacher);
    const ref = root(a.id);
    if (action === "detail") {
      const assignment = (
        await ref.collection("assignments").doc(uid).get()
      ).data();
      return { ...studentMetadata(a), assignment };
    }
    if (["results", "close", "finalize", "export"].includes(action)) {
      requireThat(teacher, "Solo el docente responsable.", 403);
      if (action === "results")
        return { assessment: a, assignments: await assignmentRows(a.id) };
      if (action === "export") {
        requireThat(
          payload.courseId === a.courseId,
          "El curso no coincide.",
          403,
        );
        return buildMatchingContract(
          a,
          await assignmentRows(a.id),
          a.finalizedAt,
        );
      }
      await db.runTransaction(async (tx) => {
        const current = (await tx.get(ref)).data();
        requireThat(
          ["published", "closed"].includes(current.status),
          "Transición de estado inválida.",
          409,
        );
        const assignments = rows(await tx.get(ref.collection("assignments")));
        if (action === "finalize") {
          requireThat(
            current.status === "closed",
            "Cierra la evaluación primero.",
            409,
          );
          buildMatchingContract(
            { ...current, id: a.id, status: "finalized" },
            assignments,
          );
        }
        // Closing cancels unfinished attempts, without manufacturing a grade.
        if (action === "close")
          for (const record of assignments)
            if (record.activeAttemptId) {
              const ar = ref.collection("assignments").doc(record.studentId);
              tx.update(ar.collection("attempts").doc(record.activeAttemptId), {
                status: "cancelled",
              });
              tx.update(ar, { activeAttemptId: null });
            }
        tx.update(ref, {
          status: action === "close" ? "closed" : "finalized",
          ...(action === "finalize"
            ? { finalizedAt: new Date().toISOString() }
            : {}),
        });
      });
      return { ok: true };
    }
    const definition = await privateAssessment(a.id);
    const assignmentRef = ref.collection("assignments").doc(uid);
    if (action === "regrade") {
      requireThat(teacher, "Solo el docente responsable.", 403);
      requireThat(
        validId(payload.studentId) && a.studentIds.includes(payload.studentId),
        "Estudiante no asignado a esta evaluación.",
        403,
      );
      const targetRef = ref.collection("assignments").doc(payload.studentId);
      return db.runTransaction(async (tx) => {
        const assignment = (await tx.get(targetRef)).data();
        requireThat(
          assignment?.resultStatus === "graded" &&
            assignment.lastAttemptId,
          "No hay una calificación final para recalificar.",
          409,
        );
        const attemptRef = targetRef
          .collection("attempts")
          .doc(assignment.lastAttemptId);
        const attempt = (await tx.get(attemptRef)).data();
        requireThat(
          attempt?.status === "graded",
          "No se encontró el último intento corregido.",
          409,
        );
        const result = grade(definition, payload.studentId, attempt.answers);
        const scaledScore =
          Math.round(
            (result.overallScore / result.maxScore) * definition.scale * 100,
          ) / 100;
        const changed =
          JSON.stringify(result) !== JSON.stringify(attempt.result);
        if (!changed) {
          return {
            changed: false,
            result: attempt.result,
            scaledScore: attempt.scaledScore,
          };
        }
        const changedAt = new Date().toISOString();
        const academicGrade = {
          score20: normalizeGrade20(result),
          rawScore: result.overallScore,
          maxScore: result.maxScore,
          status: "graded",
          gradedAt: changedAt,
          attemptId: assignment.lastAttemptId,
        };
        const changeRef = targetRef.collection("gradeChanges").doc(randomUUID());
        tx.update(attemptRef, {
          result,
          scaledScore,
          academicGrade,
          gradedAt: changedAt,
        });
        tx.update(targetRef, {
          result,
          scaledScore,
          academicGrade,
          gradedAt: changedAt,
        });
        tx.create(changeRef, {
          assessmentId: a.id,
          studentId: payload.studentId,
          changedBy: uid,
          changedAt,
          previous: {
            result: attempt.result,
            scaledScore: attempt.scaledScore,
          },
          next: { result, scaledScore },
        });
        return { changed: true, result, scaledScore, gradedAt: changedAt };
      });
    }
    requireThat(!teacher, "Esta acción requiere una cuenta estudiantil.", 403);
    if (action === "start") {
      return db.runTransaction(async (tx) => {
        const current = (await tx.get(ref)).data();
        const assignment = (await tx.get(assignmentRef)).data();
        assertAvailable(current);
        requireThat(assignment, "No estás asignado.", 403);
        let oldAttempt;
        if (assignment.activeAttemptId) {
          oldAttempt = (
            await tx.get(
              assignmentRef
                .collection("attempts")
                .doc(assignment.activeAttemptId),
            )
          ).data();
          if (Date.now() < Date.parse(oldAttempt.expiresAt))
            return {
              attempt: oldAttempt,
              assessment: publicAssessment(definition),
              serverNow: new Date().toISOString(),
              feedback:
                current.feedbackMode === "immediate"
                  ? feedbackFor(definition, oldAttempt.answers)
                  : [],
            };
        }
        requireThat(
          assignment.count < current.attemptLimit,
          "No quedan intentos disponibles.",
          409,
        );
        const id = randomUUID(),
          now = Date.now();
        const expires = Math.min(
          Date.parse(current.endsAt),
          current.durationMinutes
            ? now + current.durationMinutes * 60000
            : Infinity,
        );
        const attempt = {
          id,
          status: "in_progress",
          startedAt: new Date(now).toISOString(),
          expiresAt: new Date(expires).toISOString(),
          answers: {},
          revision: 0,
        };
        if (oldAttempt)
          tx.update(assignmentRef.collection("attempts").doc(oldAttempt.id), {
            status: "expired",
          });
        tx.create(assignmentRef.collection("attempts").doc(id), attempt);
        tx.update(assignmentRef, {
          count: assignment.count + 1,
          activeAttemptId: id,
        });
        return {
          attempt,
          assessment: publicAssessment(definition),
          serverNow: new Date(now).toISOString(),
        };
      });
    }
    if (action === "saveAnswers" || action === "submit") {
      requireThat(validId(payload.attemptId), "Intento inválido.");
      const attemptRef = assignmentRef
        .collection("attempts")
        .doc(payload.attemptId);
      return db.runTransaction(async (tx) => {
        const current = (await tx.get(ref)).data();
        const assignment = (await tx.get(assignmentRef)).data();
        const attempt = (await tx.get(attemptRef)).data();
        requireThat(attempt && assignment, "Intento no encontrado.", 404);
        const reveal =
          current.feedbackMode === "after_submit" ||
          current.feedbackMode === "immediate" ||
          (current.feedbackMode === "after_close" &&
            ["closed", "finalized"].includes(current.status));
        if (action === "submit" && attempt.status === "graded")
          return {
            result: attempt.result,
            scaledScore: attempt.scaledScore,
            feedback: reveal ? feedbackFor(definition, attempt.answers) : [],
          };
        assertAvailable(current);
        requireThat(
          assignment.activeAttemptId === payload.attemptId &&
            attempt.status === "in_progress" &&
            Date.now() < Date.parse(attempt.expiresAt),
          "Intento vencido o inactivo.",
          409,
        );
        requireThat(
          payload.revision === attempt.revision,
          "Las respuestas cambiaron en otra pestaña. Reabre el intento.",
          409,
        );
        const answers = validateAnswers(
          definition.questions,
          payload.answers,
          action === "submit",
        );
        if (current.feedbackMode === "immediate")
          for (const [id, value] of Object.entries(attempt.answers))
            requireThat(
              answers[id] === value,
              "Una respuesta con retroalimentación ya está bloqueada.",
              409,
            );
        const revision = attempt.revision + 1;
        if (action === "saveAnswers") {
          tx.update(attemptRef, {
            answers,
            revision,
            savedAt: new Date().toISOString(),
          });
          return {
            revision,
            feedback:
              current.feedbackMode === "immediate"
                ? feedbackFor(definition, answers)
                : [],
          };
        }
        const result = grade(definition, uid, answers);
        const scaledScore =
          Math.round(
            (result.overallScore / result.maxScore) * definition.scale * 100,
          ) / 100;
        const gradedAt = new Date().toISOString();
        const academicGrade = {
          score20: normalizeGrade20(result),
          rawScore: result.overallScore,
          maxScore: result.maxScore,
          status: "graded",
          gradedAt,
          attemptId: payload.attemptId,
        };
        tx.update(attemptRef, {
          answers,
          revision,
          status: "graded",
          result,
          scaledScore,
          academicGrade,
          gradedAt,
        });
        // Explicit policy: latest submitted attempt, never an arbitrary weighted mixture.
        tx.update(assignmentRef, {
          activeAttemptId: null,
          resultStatus: "graded",
          result,
          scaledScore,
          academicGrade,
          gradedAt,
          lastAttemptId: payload.attemptId,
        });
        return {
          result,
          scaledScore,
          feedback: reveal ? feedbackFor(definition, answers) : [],
        };
      });
    }
    if (action === "review") {
      const assignment = (await assignmentRef.get()).data();
      requireThat(
        assignment?.lastAttemptId,
        "Todavía no hay un resultado.",
        409,
      );
      const attempt = (
        await assignmentRef
          .collection("attempts")
          .doc(assignment.lastAttemptId)
          .get()
      ).data();
      const reveal =
        a.feedbackMode === "after_submit" ||
        a.feedbackMode === "immediate" ||
        (a.feedbackMode === "after_close" &&
          ["closed", "finalized"].includes(a.status));
      return {
        result: attempt.result,
        scaledScore: attempt.scaledScore,
        feedback: reveal ? feedbackFor(definition, attempt.answers) : [],
        questions: reveal ? publicAssessment(definition).questions : [],
      };
    }
    requireThat(false, "Acción desconocida.");
  };
}

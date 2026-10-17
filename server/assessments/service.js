import { randomUUID } from "node:crypto";
import {
  assertAvailable,
  buildMatchingContract,
  defaultSkills,
  feedbackFor,
  grade,
  publicAssessment,
  requireThat,
  validId,
  validateAnswers,
  validateAssessment,
} from "./domain.js";

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
        (teacher ? course.teacherId === uid : course.studentIds.includes(uid)),
      "No tienes acceso a este curso.",
      403,
    );
    return { ...course, id: courseId, skills: course.skills || defaultSkills };
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
  const studentMetadata = (a) => {
    const copy = { ...a };
    delete copy.studentIds;
    return copy;
  };

  return async function execute(uid, action, payload = {}) {
    const profile = await actor(uid);
    const teacher = profile.role === "teacher";
    if (action === "bootstrap") {
      const courses = rows(
        await db
          .collection("assessmentCourseAccess")
          .where(
            teacher ? "teacherId" : "studentIds",
            teacher ? "==" : "array-contains",
            uid,
          )
          .get(),
      );
      const assessments = rows(
        await db
          .collection(ROOT)
          .where(
            teacher ? "ownerId" : "studentIds",
            teacher ? "==" : "array-contains",
            uid,
          )
          .get(),
      ).filter(
        (a) =>
          courses.some((c) => c.id === a.courseId) &&
          (teacher || a.status !== "draft"),
      );
      const enriched = await Promise.all(
        courses.map(async (c) => {
          const roster =
            teacher && c.studentIds.length
              ? await db.getAll(
                  ...c.studentIds.map((id) => db.collection("users").doc(id)),
                )
              : [];
          return {
            id: c.id,
            name: c.name,
            competencyId: c.competencyId || "resuelve-problemas-cantidad",
            skills: c.skills || defaultSkills,
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
        const revision = (existing.data()?.revision || 0) + 1;
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
      return { id };
    }
    const a = await getAssessment(uid, payload.assessmentId, teacher);
    const ref = root(a.id);
    if (action === "detail") {
      if (teacher) return { ...a, ...(await privateAssessment(a.id)) };
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
    requireThat(!teacher, "Esta acción requiere una cuenta estudiantil.", 403);
    const definition = await privateAssessment(a.id);
    const assignmentRef = ref.collection("assignments").doc(uid);
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
        return { attempt, assessment: publicAssessment(definition) };
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
        tx.update(attemptRef, {
          answers,
          revision,
          status: "graded",
          result,
          scaledScore,
          gradedAt,
        });
        // Explicit policy: latest submitted attempt, never an arbitrary weighted mixture.
        tx.update(assignmentRef, {
          activeAttemptId: null,
          resultStatus: "graded",
          result,
          scaledScore,
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

import { describe, expect, it } from "vitest";
import { createAssessmentService } from "./service.js";

/**
 * `selfEnroll` con una base de datos falsa: no necesita emulador y deja fijadas
 * las reglas que importan (a quién se matricula, idempotencia y quién puede
 * pedirlo).
 */
function fakeDb({ profile, courses }) {
  const docs = new Map(Object.entries(courses).map(([id, data]) => [id, { ...data }]));
  const updates = [];
  return {
    updates,
    collection(name) {
      if (name === "users")
        return { doc: () => ({ get: async () => ({ data: () => profile }) }) };
      if (name === "assessmentCourseAccess")
        return {
          get: async () => ({
            docs: [...docs].map(([id, data]) => ({ id, data: () => data })),
          }),
          doc: (id) => ({ id }),
        };
      throw new Error(`colección no esperada: ${name}`);
    },
    async runTransaction(fn) {
      return fn({
        async get(docRef) {
          return { data: () => docs.get(docRef.id) ?? null };
        },
        update(docRef, values) {
          updates.push({ id: docRef.id, ...values });
          docs.set(docRef.id, { ...docs.get(docRef.id), ...values });
        },
      });
    },
  };
}

const mathCourse = {
  name: "Matemática 5A",
  teacherId: "teacher-1",
  studentIds: [],
  selfEnrollment: true,
};

const selfEnrollFor = (db, uid = "nuevo") => createAssessmentService(db)(uid, "selfEnroll");

describe("selfEnroll", () => {
  it("matricula al estudiante nuevo en los cursos con registro abierto", async () => {
    const db = fakeDb({
      profile: { role: "student" },
      courses: { "matematica-5a": mathCourse },
    });

    const result = await selfEnrollFor(db);

    expect(result.joined).toEqual([
      { id: "matematica-5a", name: "Matemática 5A", alreadyIn: false },
    ]);
    expect(db.updates.at(-1).studentIds).toEqual(["nuevo"]);
  });

  it("no duplica al repetirse la llamada", async () => {
    const db = fakeDb({
      profile: { role: "student" },
      courses: { "matematica-5a": { ...mathCourse, studentIds: ["nuevo"] } },
    });

    const result = await selfEnrollFor(db);

    expect(result.joined).toEqual([]);
    expect(db.updates).toEqual([]);
  });

  it("si nadie habilitó el registro abierto, entra solo cuando hay un único curso", async () => {
    const sinBandera = (course) => ({ ...course, selfEnrollment: undefined });

    const unico = fakeDb({
      profile: { role: "student" },
      courses: { "matematica-5a": sinBandera(mathCourse) },
    });
    await expect(selfEnrollFor(unico)).resolves.toMatchObject({
      joined: [{ id: "matematica-5a" }],
    });

    const varios = fakeDb({
      profile: { role: "student" },
      courses: {
        "matematica-5a": sinBandera(mathCourse),
        "lengua-5a": sinBandera({ name: "Lengua 5A", teacherId: "teacher-1", studentIds: [] }),
      },
    });
    await expect(selfEnrollFor(varios)).rejects.toMatchObject({ status: 409 });
  });

  it("es una acción de estudiante: un docente no se matricula solo", async () => {
    const db = fakeDb({
      profile: { role: "teacher" },
      courses: { "matematica-5a": mathCourse },
    });

    await expect(selfEnrollFor(db, "doc")).rejects.toMatchObject({ status: 403 });
  });
});

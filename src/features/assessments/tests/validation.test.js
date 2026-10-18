import { describe, expect, it } from "vitest";
import {
  findSimilarQuestions,
  normalizeAnswerText,
  validateAssessmentForm,
} from "../utils/validation";

const courses = [
  {
    id: "course-1",
    areas: [{ id: "area-1", label: "Matemática" }],
    competencies: [{ id: "competency-1", label: "Cantidad" }],
    skills: [{ id: "addition", label: "Adición" }],
    students: [{ id: "student-1", name: "Ana" }],
  },
];

const question = (overrides = {}) => ({
  questionId: "question-1",
  prompt: "Resuelve la suma de 2 más 3.",
  type: "multiple_choice",
  options: ["5", "6"],
  correctAnswer: 0,
  skillId: "addition",
  maxScore: 1,
  explanation: "",
  ...overrides,
});

const form = (overrides = {}) => ({
  title: "Evaluación de unidad",
  description: "",
  courseId: "course-1",
  areaId: "area-1",
  competencyId: "competency-1",
  type: "exam",
  scale: 20,
  maxScore: 1,
  durationMinutes: 30,
  attemptLimit: 1,
  startsAt: new Date(Date.now() + 60_000).toISOString(),
  endsAt: new Date(Date.now() + 3_600_000).toISOString(),
  feedbackMode: "after_close",
  studentIds: ["student-1"],
  questions: [question()],
  ...overrides,
});

describe("assessment form validation", () => {
  it("accepts an authorized, complete form", () => {
    expect(validateAssessmentForm(form(), courses, { publishing: true })).toEqual({});
  });

  it("requires an authorized course before validating its area and competency", () => {
    const unauthorizedCourse = validateAssessmentForm(
      form({ courseId: "other-course" }),
      courses,
      { publishing: true },
    );
    expect(unauthorizedCourse.courseId).toBeTruthy();
    expect(unauthorizedCourse.areaId).toBeUndefined();
    expect(unauthorizedCourse.competencyId).toBeUndefined();

    const unauthorizedCurriculum = validateAssessmentForm(
      form({ areaId: "other-area", competencyId: "other-competency" }),
      courses,
      { publishing: true },
    );
    expect(unauthorizedCurriculum.areaId).toBeTruthy();
    expect(unauthorizedCurriculum.competencyId).toBeTruthy();
  });

  it("allows incomplete question content in a draft but blocks publication", () => {
    const incomplete = form({
      questions: [question({ prompt: "", options: ["", "  "], correctAnswer: null })],
    });
    expect(validateAssessmentForm(incomplete, courses)).toEqual({});
    const errors = validateAssessmentForm(incomplete, courses, {
      publishing: true,
    });
    expect(errors.questionFields["question-1"].prompt).toBeTruthy();
    expect(errors.questionFields["question-1"].options).toBeTruthy();
    expect(errors.questionFields["question-1"].correctAnswer).toBeTruthy();
  });

  it("requires at least one question and consistent total points to publish", () => {
    expect(
      validateAssessmentForm(form({ questions: [] }), courses, {
        publishing: true,
      }).questions,
    ).toMatch(/al menos una pregunta/);
    expect(
      validateAssessmentForm(form({ maxScore: 2 }), courses, {
        publishing: true,
      }).maxScore,
    ).toMatch(/debe coincidir/);
  });

  it("rejects answer alternatives duplicated after whitespace/case normalization", () => {
    const errors = validateAssessmentForm(
      form({
        questions: [
          question({ options: ["  Respuesta  ", "respuesta"] }),
        ],
      }),
      courses,
      { publishing: true },
    );
    expect(errors.questionFields["question-1"].options).toMatch(/duplicadas/);
  });

  it("blocks exact duplicate prompts but only warns on similar prompts", () => {
    const duplicateQuestions = [
      question(),
      question({
        questionId: "question-2",
        prompt: " RESUELVE   LA SUMA DE 2 MÁS 3. ",
      }),
    ];
    const duplicateErrors = validateAssessmentForm(
      form({ maxScore: 2, questions: duplicateQuestions }),
      courses,
      { publishing: true },
    );
    expect(
      duplicateErrors.questionFields["question-2"].prompt,
    ).toMatch(/duplica/);

    const similarQuestions = [
      question({ prompt: "Calcula la suma de 2 y 3 en el cuaderno." }),
      question({
        questionId: "question-2",
        prompt: "Calcula la suma de 2 y 4 en el cuaderno.",
      }),
    ];
    expect(
      validateAssessmentForm(
        form({ maxScore: 2, questions: similarQuestions }),
        courses,
        { publishing: true },
      ).questionFields,
    ).toBeUndefined();
    expect(findSimilarQuestions(similarQuestions)).toEqual([[1, 2]]);
  });

  it("does not infer mathematical equivalence from prompt text", () => {
    expect(
      findSimilarQuestions([
        question({ prompt: "2 + 2 = ?" }),
        question({ questionId: "question-2", prompt: "4" }),
      ]),
    ).toEqual([]);
  });

  it("rejects invalid lengths, dates, positive durations, attempts, and numeric points", () => {
    const invalid = form({
      title: " ",
      description: "x".repeat(3001),
      startsAt: "bad-date",
      endsAt: new Date(Date.now() - 60_000).toISOString(),
      durationMinutes: "",
      attemptLimit: "muchos",
      maxScore: -1,
      questions: [question({ maxScore: 0 })],
    });
    const errors = validateAssessmentForm(invalid, courses, {
      publishing: true,
    });
    expect(errors.title).toBeTruthy();
    expect(errors.description).toBeTruthy();
    expect(errors.startsAt).toBeTruthy();
    expect(errors.endsAt).toBeTruthy();
    expect(errors.endsAt).toMatch(/futuro/);
    expect(errors.durationMinutes).toBeTruthy();
    expect(errors.attemptLimit).toBeTruthy();
    expect(errors.maxScore).toBeTruthy();
    expect(errors.questionFields["question-1"].maxScore).toBeTruthy();
  });

  it("rejects unsupported question skills and out-of-course students", () => {
    const errors = validateAssessmentForm(
      form({
        studentIds: ["outsider"],
        questions: [question({ skillId: "unknown" })],
      }),
      courses,
      { publishing: true },
    );
    expect(errors.studentIds).toBeTruthy();
    expect(errors.questionFields["question-1"].skillId).toBeTruthy();
  });

  it("normalizes answer text consistently", () => {
    expect(normalizeAnswerText("  ÁRBOL \n  ROJO ")).toBe("árbol rojo");
  });
});

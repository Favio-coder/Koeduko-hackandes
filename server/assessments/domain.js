import { MATH_SKILLS } from "../../src/shared/constants/contracts.js";

export class AssessmentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireThat(condition, message, status = 400) {
  if (!condition) throw new AssessmentError(status, message);
}
export const validId = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
const text = (value, max = 200) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
export const defaultSkills = MATH_SKILLS.map(({ id, label }) => ({
  id,
  label,
}));
const DEFAULT_COMPETENCY_ID = "resuelve-problemas-cantidad";
const DEFAULT_COMPETENCY_LABEL = "Resuelve problemas de cantidad";

export function courseCompetencies(course) {
  const source =
    Array.isArray(course.competencies) && course.competencies.length
      ? course.competencies
      : [
          {
            id: course.competencyId || DEFAULT_COMPETENCY_ID,
            label: course.competencyLabel || DEFAULT_COMPETENCY_LABEL,
          },
        ];
  requireThat(
    source.length <= 20 &&
      source.every(
        (competency) =>
          competency &&
          validId(competency.id) &&
          text(competency.label, 200),
      ),
    "Catálogo de competencias del curso inválido.",
  );
  const competencies = source.map(({ id, label }) => ({
    id,
    label: label.trim(),
  }));
  requireThat(
    new Set(competencies.map(({ id }) => id)).size === competencies.length,
    "El curso contiene competencias duplicadas.",
  );
  const primaryId = course.competencyId || competencies[0].id;
  requireThat(
    competencies.some(({ id }) => id === primaryId),
    "La competencia principal debe pertenecer al catálogo del curso.",
  );
  return competencies;
}

export function courseAreas(course) {
  const source = course.areas || [];
  requireThat(
    Array.isArray(source) &&
      source.length <= 30 &&
      source.every(
        (area) => area && validId(area.id) && text(area.label, 200),
      ),
    "Catálogo de áreas del curso inválido.",
  );
  const areas = source.map(({ id, label }) => ({ id, label: label.trim() }));
  requireThat(
    new Set(areas.map(({ id }) => id)).size === areas.length,
    "El curso contiene áreas duplicadas.",
  );
  return areas;
}

export function courseSkills(course) {
  const source = course.skills?.length ? course.skills : defaultSkills;
  requireThat(
    Array.isArray(source) &&
      source.length <= 100 &&
      source.every(
        (skill) => skill && validId(skill.id) && text(skill.label, 200),
      ),
    "Catálogo de habilidades del curso inválido.",
  );
  const skills = source.map(({ id, label }) => ({ id, label: label.trim() }));
  requireThat(
    new Set(skills.map(({ id }) => id)).size === skills.length,
    "El curso contiene habilidades duplicadas.",
  );
  return skills;
}

const normalizedText = (value) =>
  value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();

// Integer points avoid floating-point drift in contract invariants.
export function validateAssessment(input, course, publish = false) {
  requireThat(
    input && text(input.title) && validId(input.courseId),
    "Nombre y curso obligatorios.",
  );
  requireThat(
    ["diagnostic", "exam", "practice", "homework"].includes(input.type),
    "Tipo inválido.",
  );
  requireThat(validId(input.competencyId), "Competencia obligatoria.");
  requireThat(
    courseCompetencies(course).some(
      (competency) => competency.id === input.competencyId,
    ),
    "Selecciona una competencia autorizada para este curso.",
    403,
  );
  requireThat(
    validId(input.areaId) &&
      courseAreas(course).some((area) => area.id === input.areaId),
    "Selecciona un área autorizada para este curso.",
    403,
  );
  requireThat(
    input.description === undefined ||
      (typeof input.description === "string" &&
        input.description.length <= 3000),
    "La descripción admite hasta 3000 caracteres.",
  );
  requireThat([20, 100].includes(input.scale), "Escala inválida.");
  requireThat(
    Number.isInteger(input.maxScore) &&
      input.maxScore > 0 &&
      input.maxScore <= 60000,
    "Puntaje máximo inválido.",
  );
  requireThat(
    Number.isInteger(input.attemptLimit) &&
      input.attemptLimit >= 1 &&
      input.attemptLimit <= 10,
    "Se permiten entre 1 y 10 intentos.",
  );
  requireThat(
    Number.isInteger(input.durationMinutes) &&
      (input.durationMinutes >= 1 || (input.id && input.durationMinutes === 0)) &&
      input.durationMinutes <= 1440,
    "La duración debe ser positiva y no superar 1440 minutos.",
  );
  requireThat(
    typeof input.startsAt === "string" && typeof input.endsAt === "string",
    "Las fechas de disponibilidad deben ser textos de fecha válidos.",
  );
  const weightPercent = input.weightPercent ?? 0;
  requireThat(
    Number.isFinite(weightPercent) &&
      weightPercent >= 0 &&
      weightPercent <= 100,
    "Ponderación entre 0 y 100%.",
  );
  const academicWeightPercent =
    input.academicWeightPercent == null || input.academicWeightPercent === ""
      ? null
      : input.academicWeightPercent;
  requireThat(
    academicWeightPercent === null ||
      (Number.isFinite(academicWeightPercent) &&
        academicWeightPercent > 0 &&
        academicWeightPercent <= 100),
    "El peso académico debe ser un porcentaje mayor que 0 y hasta 100.",
  );
  requireThat(
    ["none", "after_submit", "after_close", "immediate"].includes(
      input.feedbackMode,
    ),
    "Retroalimentación inválida.",
  );
  requireThat(
    input.feedbackMode !== "immediate" || input.type === "practice",
    "Solo las prácticas admiten retroalimentación inmediata.",
  );
  const starts = Date.parse(input.startsAt),
    ends = Date.parse(input.endsAt);
  requireThat(
    Number.isFinite(starts) && Number.isFinite(ends) && starts < ends,
    "Fechas de disponibilidad inválidas.",
  );
  requireThat(Array.isArray(input.studentIds), "Selecciona estudiantes.");
  const studentIds = [...new Set(input.studentIds)];
  requireThat(
    studentIds.length <= 200 &&
      studentIds.every((id) => validId(id) && course.studentIds.includes(id)),
    "Asignación fuera del curso o superior a 200 estudiantes.",
  );
  const catalog = courseSkills(course);
  requireThat(
    Array.isArray(input.questions) && input.questions.length <= 60,
    "Máximo 60 preguntas.",
  );
  const ids = new Set();
  const prompts = new Set();
  const questions = input.questions.map((q, order) => {
    requireThat(
      q && validId(q.questionId) && !ids.has(q.questionId),
      "Identificador de pregunta inválido o duplicado.",
    );
    ids.add(q.questionId);
    requireThat(
      typeof q.prompt === "string" &&
        q.prompt.length <= 2000 &&
        (!publish || q.prompt.trim().length > 0),
      publish
        ? "Todas las preguntas necesitan un enunciado de hasta 2000 caracteres."
        : "El enunciado admite hasta 2000 caracteres.",
    );
    const promptKey = normalizedText(q.prompt);
    if (promptKey) {
      requireThat(!prompts.has(promptKey), "Hay preguntas duplicadas.");
      prompts.add(promptKey);
    }
    requireThat(
      ["multiple_choice", "true_false"].includes(q.type),
      "Las preguntas abiertas requieren revisión docente y aún no están habilitadas.",
    );
    requireThat(
      catalog.some((s) => s.id === q.skillId),
      "Conocimiento fuera del catálogo autorizado.",
    );
    requireThat(
      Number.isInteger(q.maxScore) && q.maxScore > 0 && q.maxScore <= 1000,
      "Cada pregunta necesita puntos enteros positivos (máximo 1000).",
    );
    requireThat(
      Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.length <= 6 &&
        q.options.every(
          (o) =>
            typeof o === "string" &&
            o.length <= 500 &&
            (!publish || o.trim().length > 0),
        ),
      "Alternativas inválidas o duplicadas.",
    );
    const normalizedOptions = q.options
      .map(normalizedText)
      .filter(Boolean);
    requireThat(
      new Set(normalizedOptions).size === normalizedOptions.length,
      "Las alternativas no pueden estar vacías o duplicadas.",
    );
    requireThat(
      q.type !== "true_false" ||
        (q.options.length === 2 &&
          q.options[0] === "Verdadero" &&
          q.options[1] === "Falso"),
      "Verdadero/falso requiere sus dos opciones estándar.",
    );
    requireThat(
      (publish || q.correctAnswer === null || q.correctAnswer === -1) ||
        (Number.isInteger(q.correctAnswer) &&
          q.correctAnswer >= 0 &&
          q.correctAnswer < q.options.length),
      "Respuesta correcta inválida.",
    );
    requireThat(
      !publish ||
        (Number.isInteger(q.correctAnswer) &&
          q.correctAnswer >= 0 &&
          q.correctAnswer < q.options.length),
      "Selecciona una respuesta correcta.",
    );
    requireThat(
      typeof q.explanation === "string" && q.explanation.length <= 2000,
      "Explicación inválida.",
    );
    return {
      questionId: q.questionId,
      prompt: q.prompt.trim(),
      type: q.type,
      options: q.options.map((o) => o.trim()),
      correctAnswer: q.correctAnswer,
      skillId: q.skillId,
      maxScore: q.maxScore,
      order,
      explanation: q.explanation,
    };
  });
  if (publish) {
    requireThat(
      questions.length > 0 && studentIds.length > 0,
      "Agrega preguntas y estudiantes antes de publicar.",
    );
    requireThat(
      ends > Date.now(),
      "La fecha de cierre debe estar en el futuro.",
    );
    requireThat(
      questions.reduce((sum, q) => sum + q.maxScore, 0) === input.maxScore,
      "La suma de puntos de preguntas debe coincidir con el puntaje máximo.",
    );
  }
  return {
    title: input.title.trim(),
    courseId: input.courseId,
    competencyId: input.competencyId,
    areaId: input.areaId,
    description: input.description?.trim() || "",
    type: input.type,
    scale: input.scale,
    maxScore: input.maxScore,
    durationMinutes: input.durationMinutes,
    attemptLimit: input.attemptLimit,
    weightPercent,
    academicWeightPercent,
    feedbackMode: input.feedbackMode,
    startsAt: new Date(starts).toISOString(),
    endsAt: new Date(ends).toISOString(),
    studentIds,
    questions,
  };
}

export function publicAssessment(assessment) {
  const result = {
    ...assessment,
    questions: assessment.questions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      skillId: q.skillId,
      maxScore: q.maxScore,
      order: q.order,
    })),
  };
  delete result.studentIds;
  return result;
}

export function validateAnswers(questions, answers, complete = false) {
  requireThat(
    answers && typeof answers === "object" && !Array.isArray(answers),
    "Respuestas inválidas.",
  );
  for (const [id, value] of Object.entries(answers)) {
    const q = questions.find((q) => q.questionId === id);
    requireThat(
      q && Number.isInteger(value) && value >= 0 && value < q.options.length,
      "Respuesta desconocida o fuera de rango.",
    );
  }
  if (complete)
    requireThat(
      questions.every((q) => Object.hasOwn(answers, q.questionId)),
      "Responde todas las preguntas antes de enviar.",
    );
  return answers;
}

export function grade(assessment, studentId, answers) {
  validateAnswers(assessment.questions, answers, true);
  const skills = new Map();
  for (const q of assessment.questions) {
    const skill = skills.get(q.skillId) || {
      skillId: q.skillId,
      score: 0,
      maxScore: 0,
      evidenceCount: 0,
    };
    skill.score += answers[q.questionId] === q.correctAnswer ? q.maxScore : 0;
    skill.maxScore += q.maxScore;
    skill.evidenceCount += 1;
    skills.set(q.skillId, skill);
  }
  const result = {
    studentId,
    overallScore: [...skills.values()].reduce((sum, s) => sum + s.score, 0),
    maxScore: assessment.maxScore,
    skills: [...skills.values()].map((s) => ({
      ...s,
      mastery: s.score / s.maxScore,
    })),
  };
  validateResult(result);
  return result;
}

export function validateResult(result) {
  requireThat(
    result &&
      validId(result.studentId) &&
      Number.isInteger(result.overallScore) &&
      Number.isInteger(result.maxScore) &&
      result.maxScore > 0 &&
      result.overallScore >= 0 &&
      result.overallScore <= result.maxScore,
    "Resultado inválido.",
    409,
  );
  requireThat(
    Array.isArray(result.skills) &&
      result.skills.length > 0 &&
      new Set(result.skills.map((s) => s.skillId)).size ===
        result.skills.length,
    "Evidencia inválida.",
    409,
  );
  for (const s of result.skills)
    requireThat(
      validId(s.skillId) &&
        Number.isInteger(s.score) &&
        Number.isInteger(s.maxScore) &&
        Number.isInteger(s.evidenceCount) &&
        s.maxScore > 0 &&
        s.score >= 0 &&
        s.score <= s.maxScore &&
        s.mastery >= 0 &&
        s.mastery <= 1 &&
        s.mastery === s.score / s.maxScore &&
        s.evidenceCount > 0,
      "Integridad de conocimiento inválida.",
      409,
    );
  requireThat(
    result.skills.reduce((n, s) => n + s.score, 0) === result.overallScore &&
      result.skills.reduce((n, s) => n + s.maxScore, 0) === result.maxScore,
    "Los puntajes no coinciden.",
    409,
  );
}

export function buildMatchingContract(
  assessment,
  assignments,
  generatedAt = new Date().toISOString(),
) {
  requireThat(
    assessment.status === "finalized",
    "Finaliza la evaluación antes de exportar. Hay estudiantes pendientes o intentos abiertos.",
    409,
  );
  requireThat(
    assignments.length === assessment.studentIds.length &&
      assignments.length > 0,
    "Asignaciones incompletas.",
    409,
  );
  const students = assessment.studentIds.map((id) => {
    const record = assignments.find((a) => a.studentId === id);
    requireThat(
      record?.result &&
        !record.activeAttemptId &&
        record.resultStatus === "graded",
      "Hay correcciones pendientes.",
      409,
    );
    validateResult(record.result);
    requireThat(
      record.result.studentId === id &&
        record.result.maxScore === assessment.maxScore,
      "Resultado ajeno a la evaluación.",
      409,
    );
    return {
      studentId: id,
      overallScore: record.result.overallScore,
      maxScore: record.result.maxScore,
      skills: record.result.skills.map(
        ({ skillId, score, maxScore, mastery, evidenceCount }) => ({
          skillId,
          score,
          maxScore,
          mastery,
          evidenceCount,
        }),
      ),
    };
  });
  return {
    schemaVersion: "1.0",
    courseId: assessment.courseId,
    assessmentId: assessment.id,
    competencyId: assessment.competencyId,
    generatedAt,
    status: "finalized",
    students,
  };
}

export function assertAvailable(assessment, now = Date.now()) {
  requireThat(
    assessment.status === "published" &&
      now >= Date.parse(assessment.startsAt) &&
      now < Date.parse(assessment.endsAt),
    "La evaluación no está disponible.",
    409,
  );
}

export function feedbackFor(assessment, answers) {
  return assessment.questions
    .filter((q) => Object.hasOwn(answers, q.questionId))
    .map((q) => ({
      questionId: q.questionId,
      correct: answers[q.questionId] === q.correctAnswer,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }));
}

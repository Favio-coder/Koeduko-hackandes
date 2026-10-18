const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 3000;
const MAX_PROMPT_LENGTH = 2000;
const MAX_OPTION_LENGTH = 500;
const MAX_EXPLANATION_LENGTH = 2000;

export function normalizeAnswerText(value) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function findSimilarQuestions(questions) {
  const pairs = [];
  for (let first = 0; first < questions.length; first += 1) {
    if (typeof questions[first].prompt !== "string") continue;
    const firstTokens = new Set(
      normalizeAnswerText(questions[first].prompt).match(/[\p{L}\p{N}]+/gu) ||
        [],
    );
    if (firstTokens.size < 3) continue;
    for (let second = first + 1; second < questions.length; second += 1) {
      if (typeof questions[second].prompt !== "string") continue;
      const secondTokens = new Set(
        normalizeAnswerText(questions[second].prompt).match(
          /[\p{L}\p{N}]+/gu,
        ) || [],
      );
      if (secondTokens.size < 3) continue;
      const intersection = [...firstTokens].filter((token) =>
        secondTokens.has(token),
      ).length;
      const similarity =
        intersection / new Set([...firstTokens, ...secondTokens]).size;
      if (similarity >= 0.8) pairs.push([first + 1, second + 1]);
    }
  }
  return pairs;
}

export function validateAssessmentForm(form, courses, { publishing = false } = {}) {
  const errors = { questionFields: {} };
  const course = courses.find((item) => item.id === form.courseId);
  const setError = (field, message) => {
    if (!errors[field]) errors[field] = message;
  };

  if (
    typeof form.title !== "string" ||
    !form.title.trim() ||
    form.title.length > MAX_TITLE_LENGTH
  ) {
    setError("title", "Escribe un nombre de hasta 200 caracteres.");
  }
  if (!course) {
    setError("courseId", "Selecciona un curso autorizado.");
  } else {
    if (!course.areas?.some((area) => area.id === form.areaId)) {
      setError("areaId", "Selecciona un área habilitada para este curso.");
    }
    if (
      !course.competencies?.some(
        (competency) => competency.id === form.competencyId,
      )
    ) {
      setError(
        "competencyId",
        "Selecciona una competencia habilitada para este curso.",
      );
    }
    if (
      !Array.isArray(form.studentIds) ||
      form.studentIds.some((id) => !course.students.some((s) => s.id === id)) ||
      (publishing && !form.studentIds.length)
    ) {
      setError(
        "studentIds",
        publishing
          ? "Asigna al menos un estudiante del curso."
          : "La asignación contiene estudiantes ajenos al curso.",
      );
    }
  }

  if (
    typeof form.description !== "string" ||
    form.description.length > MAX_DESCRIPTION_LENGTH
  ) {
    setError("description", "La descripción admite hasta 3000 caracteres.");
  }
  if (!["diagnostic", "exam", "practice", "homework"].includes(form.type)) {
    setError("type", "Selecciona un tipo de evaluación válido.");
  }
  if (![20, 100].includes(form.scale)) {
    setError("scale", "Selecciona una escala válida.");
  }
  if (
    form.academicWeightPercent !== null &&
    form.academicWeightPercent !== undefined &&
    form.academicWeightPercent !== "" &&
    (!Number.isFinite(form.academicWeightPercent) ||
      form.academicWeightPercent <= 0 ||
      form.academicWeightPercent > 100)
  ) {
    setError(
      "academicWeightPercent",
      "El peso debe ser mayor que 0 y hasta 100%.",
    );
  }

  const startsAt = Date.parse(form.startsAt);
  const endsAt = Date.parse(form.endsAt);
  if (!Number.isFinite(startsAt)) {
    setError("startsAt", "Indica una fecha de inicio válida.");
  }
  if (!Number.isFinite(endsAt)) {
    setError("endsAt", "Indica una fecha de cierre válida.");
  } else if (Number.isFinite(startsAt) && startsAt >= endsAt) {
    setError("endsAt", "El cierre debe ser posterior al inicio.");
  } else if (publishing && endsAt <= Date.now()) {
    setError("endsAt", "La fecha de cierre debe estar en el futuro.");
  }

  const duration = Number(form.durationMinutes);
  if (
    !Number.isInteger(duration) ||
    form.durationMinutes === "" ||
    duration < (form.id && duration === 0 ? 0 : 1) ||
    duration > 1440
  ) {
    setError(
      "durationMinutes",
      form.id
        ? "La duración debe ser positiva (máximo 1440 minutos)."
        : "La duración debe ser de 1 a 1440 minutos.",
    );
  }
  const attempts = Number(form.attemptLimit);
  if (
    form.attemptLimit === "" ||
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > 10
  ) {
    setError("attemptLimit", "Indica entre 1 y 10 intentos.");
  }
  const maxScore = Number(form.maxScore);
  if (
    form.maxScore === "" ||
    !Number.isInteger(maxScore) ||
    maxScore < 1 ||
    maxScore > 60000
  ) {
    setError("maxScore", "El puntaje máximo debe ser un entero entre 1 y 60000.");
  }
  if (
    !["none", "after_submit", "after_close", "immediate"].includes(
      form.feedbackMode,
    ) ||
    (form.feedbackMode === "immediate" && form.type !== "practice")
  ) {
    setError("feedbackMode", "La política no es válida para este tipo.");
  }

  if (!Array.isArray(form.questions) || form.questions.length > 60) {
    setError("questions", "Agrega hasta 60 preguntas.");
  } else {
    if (publishing && !form.questions.length) {
      setError("questions", "Agrega al menos una pregunta para publicar.");
    }
    const ids = new Set();
    const prompts = new Map();
    let total = 0;
    form.questions.forEach((question, index) => {
      const fields = {};
      errors.questionFields[question.questionId || index] = fields;
      const questionError = (field, message) => {
        fields[field] = message;
      };
      if (
        typeof question.questionId !== "string" ||
        !question.questionId ||
        ids.has(question.questionId)
      ) {
        questionError("prompt", "La pregunta tiene un identificador duplicado.");
      }
      ids.add(question.questionId);

      const prompt =
        typeof question.prompt === "string" ? question.prompt.trim() : "";
      if (publishing && (!prompt || prompt.length > MAX_PROMPT_LENGTH)) {
        questionError("prompt", "Escribe un enunciado de hasta 2000 caracteres.");
      } else if (question.prompt?.length > MAX_PROMPT_LENGTH) {
        questionError("prompt", "El enunciado admite hasta 2000 caracteres.");
      }
      if (prompt) {
        const normalizedPrompt = normalizeAnswerText(prompt);
        if (prompts.has(normalizedPrompt)) {
          questionError(
            "prompt",
            `El enunciado duplica la pregunta ${prompts.get(normalizedPrompt)}.`,
          );
        } else {
          prompts.set(normalizedPrompt, index + 1);
        }
      }

      if (!course?.skills?.some((skill) => skill.id === question.skillId)) {
        questionError("skillId", "Selecciona una habilidad autorizada.");
      }
      if (!["multiple_choice", "true_false"].includes(question.type)) {
        questionError("type", "Selecciona un tipo de pregunta válido.");
      }
      const questionScore = Number(question.maxScore);
      if (
        !Number.isInteger(questionScore) ||
        questionScore < 1 ||
        questionScore > 1000
      ) {
        questionError("maxScore", "El puntaje debe ser un entero entre 1 y 1000.");
      } else {
        total += questionScore;
      }
      if (
        typeof question.explanation !== "string" ||
        question.explanation.length > MAX_EXPLANATION_LENGTH
      ) {
        questionError("explanation", "La explicación admite hasta 2000 caracteres.");
      }

      if (!Array.isArray(question.options)) {
        questionError("options", "Agrega de 2 a 6 alternativas.");
      } else {
        if (question.options.length < 2 || question.options.length > 6) {
          questionError("options", "Agrega de 2 a 6 alternativas.");
        }
        const answers = new Map();
        question.options.forEach((option, optionIndex) => {
          if (typeof option !== "string") {
            questionError(
              "options",
              `La alternativa ${optionIndex + 1} no es válida.`,
            );
            return;
          }
          if (option.length > MAX_OPTION_LENGTH) {
            questionError("options", "Cada alternativa admite hasta 500 caracteres.");
          }
          if (publishing && !option.trim()) {
            questionError("options", `Completa la alternativa ${optionIndex + 1}.`);
          }
          const normalized = normalizeAnswerText(option);
          if (normalized && answers.has(normalized)) {
            questionError(
              "options",
              `Las alternativas ${answers.get(normalized)} y ${optionIndex + 1} son duplicadas.`,
            );
          } else if (normalized) {
            answers.set(normalized, optionIndex + 1);
          }
        });
        if (
          question.type === "true_false" &&
          (question.options.length !== 2 ||
            question.options[0] !== "Verdadero" ||
            question.options[1] !== "Falso")
        ) {
          questionError("options", "Verdadero/Falso usa las opciones estándar.");
        }
        if (
          publishing &&
          (!Number.isInteger(question.correctAnswer) ||
            question.correctAnswer < 0 ||
            question.correctAnswer >= question.options.length)
        ) {
          questionError("correctAnswer", "Marca una respuesta correcta.");
        } else if (
          !publishing &&
          question.correctAnswer !== null &&
          question.correctAnswer !== -1 &&
          (!Number.isInteger(question.correctAnswer) ||
            question.correctAnswer < 0 ||
            question.correctAnswer >= question.options.length)
        ) {
          questionError("correctAnswer", "Selecciona una alternativa válida.");
        }
      }
    });

    if (
      publishing &&
      Number.isInteger(maxScore) &&
      total !== maxScore
    ) {
      setError(
        "maxScore",
        `El puntaje máximo (${maxScore}) debe coincidir con la suma de preguntas (${total}).`,
      );
    }
  }

  Object.keys(errors.questionFields).forEach((id) => {
    if (!Object.keys(errors.questionFields[id]).length) {
      delete errors.questionFields[id];
    }
  });
  if (!Object.keys(errors.questionFields).length) delete errors.questionFields;
  return errors;
}

import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, LoadingState } from "@/components/ui";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import {
  confirmDestructive,
  showConfirmation,
  showError,
  showSuccess,
  showWarning,
} from "@/shared/lib/alerts";
import { assessmentRequest } from "../services/assessmentService";
import { useOperation } from "../hooks/useOperation";
import {
  findSimilarQuestions,
  validateAssessmentForm,
} from "../utils/validation";
import { localDate, newQuestion, typeOptions } from "../utils/forms";
import QuestionEditor from "./QuestionEditor";
import QuestionCard from "./QuestionCard";
import IntegerInput from "./IntegerInput";

const sections = [
  ["general", "Información general"],
  ["settings", "Configuración"],
  ["questions", "Preguntas"],
  ["review", "Revisión y publicación"],
];

function serverErrorField(message) {
  if (/nombre/i.test(message)) return "title";
  if (/área/i.test(message)) return "areaId";
  if (/curso/i.test(message)) return "courseId";
  if (/competencia/i.test(message)) return "competencyId";
  if (/descripción/i.test(message)) return "description";
  if (/fecha/i.test(message)) return "endsAt";
  if (/duración/i.test(message)) return "durationMinutes";
  if (/intentos/i.test(message)) return "attemptLimit";
  if (/puntaje máximo|suma de puntos/i.test(message)) return "maxScore";
  if (/pregunta|alternativa|respuesta correcta|habilidad/i.test(message)) {
    return "questions";
  }
  return null;
}

function toIsoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export default function AssessmentEditor({ initial, courses, onDone, exitRef }) {
  const [form, setForm] = useState(() => {
    const course = courses.find((item) => item.id === initial.courseId);
    return {
      ...initial,
      academicWeightPercent: null,
      description: initial.description || "",
      areaId: initial.areaId || course?.areas?.[0]?.id || "",
      durationMinutes: initial.durationMinutes ?? 30,
      questions: initial.questions || [],
      studentIds: initial.studentIds || [],
    };
  });
  const [baseline, setBaseline] = useState(() => JSON.stringify(form));
  const [fieldErrors, setFieldErrors] = useState({});
  const [preview, setPreview] = useState(false);
  const [step, setStep] = useState(0);
  const [savedAt, setSavedAt] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const { busy, error, run } = useOperation();
  const course = courses.find((item) => item.id === form.courseId);
  const questions = form.questions;
  const dirty = JSON.stringify(form) !== baseline;
  const points = questions.reduce(
    (sum, question) => sum + (Number(question.maxScore) || 0),
    0,
  );
  const similarQuestions = useMemo(
    () => findSimilarQuestions(questions),
    [questions],
  );
  const questionErrors = fieldErrors.questionFields || {};
  const formErrors = Object.fromEntries(
    Object.entries(fieldErrors).filter(([key]) => key !== "questionFields"),
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  const set = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    setFieldErrors((old) => {
      const next = { ...old };
      delete next[key];
      return next;
    });
  };

  const focusFirstError = (errors) => {
    const firstField = Object.keys(errors).find((key) => key !== "questionFields");
    const general = ["title", "courseId", "areaId", "competencyId", "description", "type"];
    setStep(firstField === "questions" || !firstField ? 2 : general.includes(firstField) ? 0 : 1);
    requestAnimationFrame(() => {
    if (firstField) {
      document.getElementById(`assessment-${firstField}`)?.focus();
      if (firstField === "questions") {
        document.getElementById("questions")?.scrollIntoView({ block: "start" });
      }
      return;
    }
    const firstQuestion = Object.keys(errors.questionFields || {})[0];
    if (firstQuestion) {
      const index = questions.findIndex(
        (question) => question.questionId === firstQuestion,
      );
      document
          .querySelector(`#question-${index + 1} textarea`)
          ?.focus();
    }
    });
  };

  const validate = async (publishing) => {
    const errors = validateAssessmentForm(form, courses, { publishing });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      const messages = Object.entries(errors).flatMap(([key, value]) =>
        key === "questionFields"
          ? Object.entries(value).flatMap(([id, fields]) => Object.values(fields).map(message =>
            `Pregunta ${questions.findIndex(q => q.questionId === id) + 1}: ${message}`))
          : [value]);
      await showWarning(messages.map(message => `• ${message}`).join("\n"), "Revisa antes de continuar");
      focusFirstError(errors);
      return false;
    }
    return true;
  };

  const save = async (publishing) => {
    if (!(await validate(publishing))) {
      return;
    }
    run(async () => {
      try {
        if (publishing && similarQuestions.length) {
          const pairs = similarQuestions
            .map(([first, second]) => `Preguntas ${first} y ${second}`)
            .join("; ");
          const continueWithSimilar = await showConfirmation({
            title: "Revisa posibles preguntas similares",
            text: `${pairs}. No se bloquearán automáticamente; confirma si deseas continuar.`,
            icon: "warning",
            confirmButtonText: "Continuar con la revisión",
            cancelButtonText: "Volver a editar",
          });
          if (!continueWithSimilar) {
            setPendingAction(null);
            return;
          }
        }
        if (publishing) {
          const confirmed = await showConfirmation({
            title: "Publicar evaluación",
            text: `Se asignará a ${form.studentIds.length} estudiantes. Después de publicar, no podrás editar la evaluación.`,
            icon: "warning",
            confirmButtonText: "Publicar evaluación",
            cancelButtonText: "Seguir editando",
          });
          if (!confirmed) {
            setPendingAction(null);
            return;
          }
        }

        setPendingAction(publishing ? "publish" : "save");
        const result = await assessmentRequest(
          publishing ? "publish" : "save",
          { ...form, academicWeightPercent: null },
        );
        setPendingAction(null);
        if (publishing) {
          await showSuccess("La evaluación se publicó correctamente.");
          onDone();
          return;
        }

        /* El servidor devuelve la revisión: no hace falta volver a pedir
           `detail` y el borrador se refresca en un solo viaje. */
        const nextForm = {
          ...form,
          id: result.id,
          revision: result.revision,
          updatedAt: result.updatedAt,
          status: "draft",
          description: form.description || "",
          questions: form.questions || [],
          studentIds: form.studentIds || [],
        };
        setForm(nextForm);
        setBaseline(JSON.stringify(nextForm));
        setSavedAt(new Date().toLocaleTimeString());
        setFieldErrors({});
        await showSuccess("El borrador se guardó correctamente.");
      } catch (saveError) {
        setPendingAction(null);
        const field = serverErrorField(saveError.message);
        if (field) {
          setFieldErrors((old) => ({ ...old, [field]: saveError.message }));
        }
        await showError(saveError.message, "No se pudo guardar la evaluación");
        throw saveError;
      }
    });
  };

  const nextStep = async () => {
    const errors = validateAssessmentForm(form, courses);
    const fields = step === 0
      ? ["title", "courseId", "areaId", "competencyId", "description", "type"]
      : step === 1
        ? ["scale", "maxScore", "durationMinutes", "attemptLimit", "startsAt", "endsAt", "feedbackMode", "studentIds"]
        : [];
    const currentErrors = Object.fromEntries(Object.entries(errors).filter(([key]) => fields.includes(key)));
    if (Object.keys(currentErrors).length) {
      setFieldErrors(currentErrors);
      await showWarning(Object.values(currentErrors).map(message => `• ${message}`).join("\n"), "Completa este paso");
      focusFirstError(currentErrors);
      return;
    }
    setStep(step + 1);
  };

  const leaveEditor = async () => {
    if (
      dirty &&
      !(await confirmDestructive({
        title: "Hay cambios sin guardar",
        text: "Si sales ahora, perderás los cambios realizados desde el último guardado.",
        confirmButtonText: "Salir sin guardar",
      }))
    ) {
      return;
    }
    onDone();
  };

  /* El menú lateral puede pedir la salida (por ejemplo al volver a pulsar
     «Curso»): se registra aquí la misma ruta que usa el botón «Volver». */
  useEffect(() => {
    if (!exitRef) return undefined;
    exitRef.current = () => leaveEditor();
    return () => {
      exitRef.current = null;
    };
  });

  const changeCourse = async (courseId) => {
    const nextCourse = courses.find((item) => item.id === courseId);
    if (!nextCourse) return;
    if (
      questions.length &&
      !(await confirmDestructive({
        title: "Cambiar de curso",
        text: "Las preguntas y estudiantes seleccionados se reiniciarán para usar el catálogo del nuevo curso.",
        confirmButtonText: "Cambiar curso",
      }))
    ) {
      return;
    }
    setForm((old) => ({
      ...old,
      courseId,
      areaId: nextCourse.areas?.[0]?.id || "",
      competencyId: nextCourse.competencyId,
      studentIds: nextCourse.students.map((student) => student.id),
      questions: [],
    }));
    setFieldErrors({});
  };

  const removeQuestion = async (questionId) => {
    if (
      await confirmDestructive({
        title: "Eliminar pregunta",
        text: "La pregunta se quitará del borrador. Guarda para conservar el cambio.",
        confirmButtonText: "Eliminar pregunta",
      })
    ) {
      set(
        "questions",
        questions.filter((question) => question.questionId !== questionId),
      );
    }
  };

  const setNumber = (key, value) =>
    set(key, value === "" ? "" : Number(value));

  if (!course) {
    return (
      <Alert tone="danger" title="Curso no disponible">
        Este borrador no pertenece a un curso autorizado. Vuelve al listado y
        solicita revisar el acceso del curso.
      </Alert>
    );
  }

  const incompleteQuestions = questions.filter((question) => {
    const options = Array.isArray(question.options) ? question.options : [];
    return (
      typeof question.prompt !== "string" ||
      !question.prompt.trim() ||
      options.length < 2 ||
      options.some((option) => typeof option !== "string" || !option.trim()) ||
      !Number.isInteger(question.correctAnswer) ||
      question.correctAnswer < 0 ||
      question.correctAnswer >= options.length
    );
  }).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12 text-[#304744]">
      <header className="flex flex-col gap-4 rounded-2xl border border-[#E6EAE3] bg-[#F8FAF6] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#2A7A35]">
            {form.id ? "Borrador de evaluación" : "Nueva evaluación"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#304744]">
            {form.title || "Configurar evaluación"}
          </h1>
          <p className="mt-1 text-sm text-[#5A6B6A]">
            Organiza los datos, prepara preguntas y revisa antes de publicar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <Badge tone="warning">Cambios sin guardar</Badge>
          ) : savedAt ? (
            <Badge tone="success">Guardado · {savedAt}</Badge>
          ) : (
            <Badge tone="neutral">Borrador nuevo</Badge>
          )}
          <Button variant="ghost" onClick={leaveEditor}>
            Volver
          </Button>
        </div>
      </header>

      {error && (
        <Alert tone="danger" title="No se pudo completar la operación">
          {error}
        </Alert>
      )}
      {Object.keys(formErrors).length > 0 && (
        <Alert tone="danger" title="Revisa los campos marcados">
          Corrige los errores indicados antes de continuar.
        </Alert>
      )}

      <nav
        aria-label="Secciones del constructor"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-[#E6EAE3] bg-white p-2 sm:grid-cols-4"
      >
        {sections.map(([id, label], index) => (
          <button
            type="button"
            key={id}
            disabled={busy}
            aria-current={step === index ? "step" : undefined}
            onClick={() => setStep(index)}
            className={`rounded-xl px-3 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CDB59] ${step === index ? "bg-[#304744] text-white shadow-sm" : "text-[#304744] hover:bg-[#E9F8EA]"}`}
          >
            <span className="mr-1 text-[#2A7A35]">{index + 1}.</span>
            {label}
          </button>
        ))}
      </nav>

      <fieldset disabled={busy} className="min-w-0 space-y-6">
        <div hidden={step !== 0}>
        <Card
          id="general"
          title="A. Información general"
          description="Identifica la evaluación y el contexto curricular autorizado para el curso."
          className="scroll-mt-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="assessment-title"
              label="Nombre de la evaluación"
              placeholder="Ej. Matemática · Operaciones básicas"
              maxLength={200}
              value={form.title}
              error={formErrors.title}
              onChange={(event) => set("title", event.target.value)}
              required
            />
            <Select
              id="assessment-courseId"
              label="Curso"
              value={form.courseId}
              error={formErrors.courseId}
              disabled={Boolean(form.id)}
              onChange={(event) => changeCourse(event.target.value)}
              options={courses.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              hint="Solo aparecen cursos autorizados para tu cuenta."
              required
            />
            <Select
              id="assessment-areaId"
              label="Área"
              value={form.areaId}
              error={formErrors.areaId}
              onChange={(event) => set("areaId", event.target.value)}
              options={[
                { value: "", label: "Selecciona un área", disabled: true },
                ...(course.areas || []).map((area) => ({
                  value: area.id,
                  label: area.label,
                })),
              ]}
              hint={
                course.areas?.length
                  ? "Catálogo configurado para este curso."
                  : "Este curso aún no tiene áreas configuradas en su ACL."
              }
              required
            />
            <Select
              id="assessment-competencyId"
              label="Competencia"
              value={form.competencyId}
              error={formErrors.competencyId}
              onChange={(event) => set("competencyId", event.target.value)}
              options={course.competencies.map((competency) => ({
                value: competency.id,
                label: competency.label,
              }))}
              hint="Área y competencia son catálogos distintos."
              required
            />
            <Select
              id="assessment-type"
              label="Tipo de evaluación"
              value={form.type}
              error={formErrors.type}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  type: event.target.value,
                  feedbackMode:
                    event.target.value === "practice" ||
                    old.feedbackMode !== "immediate"
                      ? old.feedbackMode
                      : "after_close",
                }))
              }
              options={typeOptions}
              required
            />
            <Textarea
              id="assessment-description"
              label="Descripción (opcional)"
              rows={2}
              maxLength={3000}
              value={form.description}
              error={formErrors.description}
              onChange={(event) => set("description", event.target.value)}
              containerClassName="sm:col-span-2"
            />
          </div>
        </Card>
        </div>

        <div hidden={step !== 1}>
        <Card
          id="settings"
          title="B. Configuración"
          description="Define puntaje, disponibilidad, intentos y quiénes podrán resolverla."
          className="scroll-mt-6"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              id="assessment-scale"
              label="Escala de presentación"
              value={form.scale}
              error={formErrors.scale}
              onChange={(event) => {
                setNumber("scale", event.target.value);
                if (Number(form.maxScore) > Number(event.target.value)) {
                  setFieldErrors(old => ({ ...old, maxScore: "El puntaje supera la nueva escala. Ajusta el total y los puntos de las preguntas." }));
                }
              }}
              options={[
                { value: 20, label: "0–20" },
                { value: 100, label: "0–100" },
              ]}
            />
            <IntegerInput
              id="assessment-maxScore"
              label="Puntaje máximo total"
              max={form.scale}
              value={form.maxScore}
              error={formErrors.maxScore}
              onValueChange={(value) => set("maxScore", value)}
              hint={`De 1 a ${form.scale} puntos. Las preguntas suman ${points}.`}
              required
            />
            <div>
            <IntegerInput
              id="assessment-durationMinutes"
              label="Duración (minutos)"
              max={1440}
              value={form.durationMinutes}
              error={formErrors.durationMinutes}
              onValueChange={(value) => set("durationMinutes", value)}
              hint={
                form.id && form.durationMinutes === 0
                  ? "Evaluación heredada sin límite; indica una duración positiva para cambiarla."
                  : "Entre 1 y 1440 minutos."
              }
              required
            />
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Duraciones sugeridas">
              {[15, 30, 45, 60, 90].map(minutes => <button key={minutes} type="button"
                aria-pressed={form.durationMinutes === minutes}
                className={`min-h-10 rounded-lg border px-3 text-sm ${form.durationMinutes === minutes ? "border-[#2A7A35] bg-[#E9F8EA]" : "border-[#E6EAE3] bg-white"}`}
                onClick={() => set("durationMinutes", minutes)}>{minutes} min</button>)}
            </div>
            </div>
            <Input
              id="assessment-startsAt"
              label="Fecha y hora de inicio"
              type="datetime-local"
              value={localDate(form.startsAt)}
              error={formErrors.startsAt}
              onChange={(event) =>
                set("startsAt", toIsoDate(event.target.value))
              }
              required
            />
            <Input
              id="assessment-endsAt"
              label="Fecha y hora de cierre"
              type="datetime-local"
              value={localDate(form.endsAt)}
              error={formErrors.endsAt}
              onChange={(event) =>
                set("endsAt", toIsoDate(event.target.value))
              }
              required
            />
            <IntegerInput
              id="assessment-attemptLimit"
              label="Intentos permitidos"
              max={10}
              value={form.attemptLimit}
              error={formErrors.attemptLimit}
              onValueChange={(value) => set("attemptLimit", value)}
              hint="Se utiliza el último intento enviado."
              required
            />
            <Select
              id="assessment-feedbackMode"
              label="Política de retroalimentación"
              value={form.feedbackMode}
              error={formErrors.feedbackMode}
              onChange={(event) => set("feedbackMode", event.target.value)}
              options={[
                { value: "none", label: "No mostrar respuestas correctas" },
                { value: "after_submit", label: "Después de enviar" },
                {
                  value: "after_close",
                  label: "Cuando el docente cierre la evaluación",
                },
                ...(form.type === "practice"
                  ? [
                      {
                        value: "immediate",
                        label: "Inmediata al guardar (bloquea la respuesta)",
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          <div className="mt-6 border-t border-[#E6EAE3] pt-5">
            <div className="mb-4">
              <h3 className="font-semibold text-[#304744]">
                Estudiantes asignados
              </h3>
              <p className="mt-1 text-sm text-[#5A6B6A]">
                {form.studentIds.length} seleccionados · solo estudiantes
                matriculados en este curso.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                set(
                  "studentIds",
                  form.studentIds.length === course.students.length
                    ? []
                    : course.students.map((student) => student.id),
                )
              }
            >
              {form.studentIds.length === course.students.length
                ? "Desmarcar todos"
                : "Seleccionar todos"}
            </Button>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {course.students.map((student) => (
                <Checkbox
                  key={student.id}
                  label={student.name}
                  checked={form.studentIds.includes(student.id)}
                  onChange={(event) =>
                    set(
                      "studentIds",
                      event.target.checked
                        ? [...form.studentIds, student.id]
                        : form.studentIds.filter((id) => id !== student.id),
                    )
                  }
                />
              ))}
            </div>
            {!course.students.length && (
              <p className="mt-3 text-sm text-[#5A6B6A]">
                No hay cuentas estudiantiles autorizadas para este curso.
              </p>
            )}
            {formErrors.studentIds && (
              <p role="alert" className="mt-2 text-sm text-[#9B2C2C]">
                {formErrors.studentIds}
              </p>
            )}
          </div>
        </Card>
        </div>

        <section hidden={step !== 2} id="questions" className="scroll-mt-6 space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-[#E6EAE3] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#304744]">
                C. Preguntas
              </h2>
              <p className="mt-1 text-sm text-[#5A6B6A]">
                {questions.length} preguntas · {points} de {form.maxScore}{" "}
                puntos configurados
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={questions.length >= 60}
              onClick={() =>
                set(
                  "questions",
                  [...questions, newQuestion(course.skills[0]?.id || "")],
                )
              }
            >
              Agregar pregunta
            </Button>
          </div>

          {formErrors.questions && (
            <Alert tone="danger" title="Revisa las preguntas">
              {formErrors.questions}
            </Alert>
          )}
          {questions.map((question, index) => (
            <QuestionEditor
              key={question.questionId}
              question={question}
              index={index}
              count={questions.length}
              skills={course.skills}
              maxPoints={Number(form.maxScore) || form.scale}
              errors={questionErrors[question.questionId]}
              onChange={(updated) =>
                set(
                  "questions",
                  questions.map((item, current) =>
                    current === index ? updated : item,
                  ),
                )
              }
              onRemove={() => removeQuestion(question.questionId)}
              onMove={(direction) => {
                const reordered = [...questions];
                [reordered[index], reordered[index + direction]] = [
                  reordered[index + direction],
                  reordered[index],
                ];
                set("questions", reordered);
              }}
            />
          ))}

          {!questions.length && (
            <div className="rounded-2xl border border-dashed border-[#ABB1AB] bg-[#F8FAF6] px-5 py-10 text-center">
              <h3 className="font-semibold text-[#304744]">
                Aún no hay preguntas
              </h3>
              <p className="mt-1 text-sm text-[#5A6B6A]">
                Puedes guardar el borrador y agregar preguntas después.
              </p>
            </div>
          )}
        </section>

        <div hidden={step !== 3}>
        <Card
          id="review"
          title="D. Revisión y publicación"
          description="Comprueba que el contenido y la puntuación sean consistentes antes de asignar la evaluación."
          className="scroll-mt-6"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#F8FAF6] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6B6A]">
                Curso y área
              </p>
              <p className="mt-1 font-semibold">
                {course.name} ·{" "}
                {course.areas?.find((area) => area.id === form.areaId)?.label ||
                  "Área sin seleccionar"}
              </p>
            </div>
            <div className="rounded-xl bg-[#F8FAF6] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6B6A]">
                Puntaje total
              </p>
              <p className="mt-1 font-semibold">
                {points} / {form.maxScore} puntos
              </p>
              {points !== Number(form.maxScore) && (
                <p className="mt-1 text-sm text-[#9B2C2C]">
                  Ajusta el puntaje máximo o los puntos de las preguntas.
                </p>
              )}
            </div>
            <div className="rounded-xl bg-[#F8FAF6] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6B6A]">
                Preguntas y estudiantes
              </p>
              <p className="mt-1 font-semibold">
                {questions.length} preguntas · {form.studentIds.length}{" "}
                estudiantes
              </p>
            </div>
            <div className="rounded-xl bg-[#F8FAF6] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6B6A]">
                Escala y tipo
              </p>
              <p className="mt-1 font-semibold">
                {form.scale === 20 ? "0–20" : "0–100"} ·{" "}
                {typeOptions.find((item) => item.value === form.type)?.label}
              </p>
            </div>
          </div>

          {incompleteQuestions > 0 && (
            <Alert
              tone="warning"
              title={`${incompleteQuestions} pregunta${incompleteQuestions === 1 ? "" : "s"} incompleta${incompleteQuestions === 1 ? "" : "s"}`}
              className="mt-4"
            >
              Completa enunciados, alternativas y respuesta correcta antes de
              publicar. Los borradores pueden guardarse mientras trabajas.
            </Alert>
          )}
          {similarQuestions.length > 0 && (
            <Alert
              tone="warning"
              title="Hay preguntas que podrían ser similares"
              className="mt-4"
            >
              {similarQuestions
                .map(([first, second]) => `${first} y ${second}`)
                .join("; ")}
              . Revísalas; no se modificará su contenido.
            </Alert>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#E6EAE3] pt-5 sm:flex-row sm:justify-between">
            <Button variant="blueSoft" icon="clipboard" onClick={() => setPreview(true)}>
              Vista previa de preguntas
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="blue"
                loading={busy}
                onClick={() => save(false)}
              >
                Guardar borrador
              </Button>
              <Button
                disabled={busy}
                onClick={() => save(true)}
              >
                Publicar evaluación
              </Button>
            </div>
          </div>
          {savedAt && (
            <p role="status" className="mt-3 text-right text-xs text-[#2A7A35]">
              Borrador guardado a las {savedAt}.
            </p>
          )}
        </Card>
        </div>
      </fieldset>

      <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6EAE3] bg-white p-3 shadow-lg sm:p-4">
        <Button variant="secondary" disabled={busy || step === 0} onClick={() => setStep(step - 1)}>Anterior</Button>
        <p role="status" className="text-sm text-[#5A6B6A]">Paso {step + 1} de 4</p>
        {step < 3 && <Button variant="blue" disabled={busy} onClick={nextStep}>Siguiente</Button>}
        {step < 3 && <Button variant="blueSoft" loading={busy} onClick={() => save(false)}>Guardar borrador</Button>}
      </div>

      {/* Koala de marca mientras el servidor guarda o publica. */}
      {pendingAction && (
        <LoadingState
          label={pendingAction === "publish" ? "Publicando evaluación…" : "Guardando borrador…"}
        />
      )}

      <details className="rounded-xl border border-[#E6EAE3] bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-[#304744]">
          Generación de preguntas con IA · próxima fase
        </summary>
        <p className="mt-2 text-[#5A6B6A]">
          Por ahora, crea las preguntas manualmente. Esta fase no conecta
          proveedores de generación.
        </p>
      </details>

      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title="Vista previa docente"
        description={`${form.title || "Sin título"} · ${points} puntos`}
        size="lg"
      >
        <div className="space-y-4">
          {questions.map((question) => (
            <QuestionCard
              key={question.questionId}
              question={question}
              disabled
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}

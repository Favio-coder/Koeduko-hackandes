import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { assessmentRequest } from "../services/assessmentService";
import { useOperation } from "../hooks/useOperation";
import { localDate, newQuestion, typeOptions } from "../utils/forms";
import QuestionEditor from "./QuestionEditor";
import QuestionCard from "./QuestionCard";

export default function AssessmentEditor({ initial, courses, onDone }) {
  const [form, setForm] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { busy, error, run } = useOperation();
  const course = courses.find((c) => c.id === form.courseId);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const points = form.questions.reduce((sum, q) => sum + q.maxScore, 0);
  const save = (publish) =>
    run(async () => {
      const result = await assessmentRequest(
        publish ? "publish" : "save",
        form,
      );
      if (publish) onDone();
      else {
        setForm(await assessmentRequest("detail", { assessmentId: result.id }));
        setConfirm(false);
      }
    });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Configurar evaluación</h2>
        <Button variant="ghost" onClick={onDone}>
          Volver al listado
        </Button>
      </div>
      {error && (
        <Alert tone="danger" title="Revisa la evaluación">
          {error}
        </Alert>
      )}
      {form.id && (
        <p role="status" className="text-sm text-green-800">
          Borrador guardado · versión {form.revision}
        </p>
      )}
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <Card title="1. Configuración">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre de la evaluación"
              maxLength={200}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
            />
            <Select
              label="Curso"
              value={form.courseId}
              disabled={Boolean(form.id)}
              onChange={(e) => {
                const c = courses.find((c) => c.id === e.target.value);
                setForm({
                  ...form,
                  courseId: c.id,
                  competencyId: c.competencyId,
                  studentIds: c.students.map((s) => s.id),
                  questions: [],
                });
              }}
              options={courses.map((c) => ({ value: c.id, label: c.name }))}
              hint="Cambiar el curso de un borrador nuevo reinicia las preguntas y la asignación."
            />
            <Select
              label="Tipo"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value,
                  feedbackMode: "after_close",
                })
              }
              options={typeOptions}
            />
            <Select
              label="Competencia"
              value={form.competencyId}
              onChange={(e) => set("competencyId", e.target.value)}
              options={course.competencies.map((competency) => ({
                value: competency.id,
                label: competency.label,
              }))}
              hint="Solo puedes evaluar competencias habilitadas para el curso."
            />
            <Select
              label="Escala de la nota"
              value={form.scale}
              onChange={(e) => set("scale", Number(e.target.value))}
              options={[
                { value: 20, label: "0–20" },
                { value: 100, label: "0–100" },
              ]}
            />
            <Input
              label="Puntaje máximo (puntos brutos)"
              type="number"
              min={1}
              step={1}
              value={form.maxScore}
              onChange={(e) => set("maxScore", Number(e.target.value))}
              hint={`Suma actual de preguntas: ${points}`}
            />
            <Input
              label="Inicio"
              type="datetime-local"
              value={localDate(form.startsAt)}
              onChange={(e) =>
                set(
                  "startsAt",
                  e.target.value ? new Date(e.target.value).toISOString() : "",
                )
              }
            />
            <Input
              label="Cierre"
              type="datetime-local"
              value={localDate(form.endsAt)}
              onChange={(e) =>
                set(
                  "endsAt",
                  e.target.value ? new Date(e.target.value).toISOString() : "",
                )
              }
            />
            <Input
              label="Duración en minutos (0 = sin límite)"
              type="number"
              min={0}
              max={1440}
              value={form.durationMinutes}
              onChange={(e) => set("durationMinutes", Number(e.target.value))}
            />
            <Input
              label="Intentos permitidos"
              type="number"
              min={1}
              max={10}
              value={form.attemptLimit}
              onChange={(e) => set("attemptLimit", Number(e.target.value))}
              hint="Se utiliza el último intento enviado. Los intentos vencidos también cuentan."
            />
            <Select
              label="Mostrar corrección"
              value={form.feedbackMode}
              onChange={(e) => set("feedbackMode", e.target.value)}
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
                        label: "Inmediata al guardar (bloquea respuesta)",
                      },
                    ]
                  : []),
              ]}
            />
            <Input
              label="Ponderación prevista (%)"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.weightPercent}
              onChange={(e) => set("weightPercent", Number(e.target.value))}
              hint="Metadato docente para una futura nota de curso. No modifica puntos ni mastery; 0 = diagnóstico sin peso."
            />
          </div>
        </Card>
        <Card title={`2. Estudiantes asignados (${form.studentIds.length})`}>
          <Button
            variant="secondary"
            onClick={() =>
              set(
                "studentIds",
                form.studentIds.length === course.students.length
                  ? []
                  : course.students.map((s) => s.id),
              )
            }
          >
            Seleccionar / desmarcar todo
          </Button>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {course.students.map((s) => (
              <Checkbox
                key={s.id}
                label={s.name}
                checked={form.studentIds.includes(s.id)}
                onChange={(e) =>
                  set(
                    "studentIds",
                    e.target.checked
                      ? [...form.studentIds, s.id]
                      : form.studentIds.filter((id) => id !== s.id),
                  )
                }
              />
            ))}
          </div>
          {!course.students.length && (
            <p>No hay cuentas estudiantiles autorizadas para este curso.</p>
          )}
        </Card>
        <h3 className="text-lg font-bold">3. Preguntas · {points} puntos</h3>
        {form.questions.map((q, i) => (
          <QuestionEditor
            key={q.questionId}
            question={q}
            index={i}
            count={form.questions.length}
            skills={course.skills}
            onChange={(value) =>
              set(
                "questions",
                form.questions.map((item, index) =>
                  index === i ? value : item,
                ),
              )
            }
            onRemove={() =>
              set(
                "questions",
                form.questions.filter((_, index) => index !== i),
              )
            }
            onMove={(direction) => {
              const list = [...form.questions];
              [list[i], list[i + direction]] = [list[i + direction], list[i]];
              set("questions", list);
            }}
          />
        ))}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={form.questions.length >= 60}
            onClick={() =>
              set("questions", [
                ...form.questions,
                newQuestion(course.skills[0].id),
              ])
            }
          >
            Agregar pregunta
          </Button>
          <Button
            variant="ghost"
            disabled={!form.questions.length}
            onClick={() => setPreview(true)}
          >
            Vista previa
          </Button>
        </div>
        <details className="rounded-xl border border-gray-200 p-4 text-sm">
          <summary className="cursor-pointer font-semibold">
            Generación de preguntas con IA · próxima fase
          </summary>
          <p className="mt-2">
            La interfaz de generación se conectará a un proveedor seguro con
            revisión docente. Por ahora, crea las preguntas manualmente.
          </p>
          <Input
            label="Prompt para futura generación"
            disabled
            placeholder="Describe conocimientos, nivel y cantidad de preguntas"
          />
        </details>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => save(false)}
          >
            Guardar borrador
          </Button>
          <Button disabled={busy} onClick={() => setConfirm(true)}>
            Publicar evaluación
          </Button>
        </div>
      </fieldset>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Publicar evaluación"
        dismissible={!busy}
        footer={
          <Button loading={busy} onClick={() => save(true)}>
            Confirmar publicación
          </Button>
        }
      >
        <p>
          Se asignará a {form.studentIds.length} estudiantes. Las preguntas y la
          configuración quedarán bloqueadas. Revisa disponibilidad, puntajes y
          respuestas correctas.
        </p>
        {error && <p role="alert">{error}</p>}
      </Modal>
      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title="Vista previa docente"
        size="lg"
      >
        <div className="space-y-8">
          {form.questions.map((q) => (
            <QuestionCard key={q.questionId} question={q} disabled />
          ))}
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, Button, Card } from "@/components/ui";
import { Select } from "@/components/ui/Field";
import { assessmentRequest } from "../services/assessmentService";
import { useOperation } from "../hooks/useOperation";
import { newAssessment, statusLabels } from "../utils/forms";
import AssessmentEditor from "../components/AssessmentEditor";
import StudentAttempt from "../components/StudentAttempt";
import ResultsPanel from "../components/ResultsPanel";
import AssessmentCompleted from "../components/AssessmentCompleted";
import GradeHistoryPanel from "../components/GradeHistoryPanel";

export default function AssessmentsPage() {
  const { isTeacher, user } = useAuth();
  const [data, setData] = useState(null);
  const [view, setView] = useState(null);
  const [filter, setFilter] = useState("");
  const [now, setNow] = useState(0);
  const { busy, error, run } = useOperation();
  useEffect(() => {
    run(async () => setData(await assessmentRequest("bootstrap")));
  }, [run]);
  useEffect(() => {
    if (view?.kind !== "detail") return undefined;
    const refreshTime = () => setNow(Date.now());
    refreshTime();
    const timer = setInterval(refreshTime, 30_000);
    return () => clearInterval(timer);
  }, [view?.kind]);
  const back = () => {
    setView(null);
    run(async () => setData(await assessmentRequest("bootstrap")));
  };
  const open = (a) =>
    run(async () => {
      if (isTeacher) {
        const value = await assessmentRequest(
          a.status === "draft" ? "detail" : "results",
          { assessmentId: a.id },
        );
        setView({
          kind: a.status === "draft" ? "edit" : "results",
          value,
          courseId: a.courseId,
        });
      } else {
        const value = await assessmentRequest("detail", { assessmentId: a.id });
        setView({
          kind:
            value.assignment?.resultStatus === "graded"
              ? "completed"
              : "detail",
          value,
          courseId: a.courseId,
        });
      }
    });
  const start = (a) =>
    run(async () =>
      setView({
        kind: "attempt",
        courseId: a.courseId,
        value: await assessmentRequest("start", { assessmentId: a.id }),
      }),
    );
  const course = data?.courses.find((c) => c.id === view?.courseId);
  const detail = view?.kind === "detail" ? view.value : null;
  const activeAttempt = Boolean(detail?.assignment.activeAttemptId);
  const assessmentAvailable =
    detail?.status === "published" &&
    now >= Date.parse(detail.startsAt) &&
    now < Date.parse(detail.endsAt);
  const attemptsRemain =
    detail && detail.assignment.count < detail.attemptLimit;
  const canStartAssessment =
    assessmentAvailable && (activeAttempt || attemptsRemain);
  const availabilityMessage = activeAttempt
    ? "Tienes un intento en curso. Puedes retomarlo."
    : detail && !assessmentAvailable
      ? now < Date.parse(detail.startsAt)
        ? "Esta evaluación aún no está disponible."
        : "El plazo para resolver esta evaluación terminó."
      : detail && !attemptsRemain
        ? "Ya utilizaste todos los intentos permitidos."
        : "";
  if (view?.kind === "edit")
    return (
      <AssessmentEditor
        initial={view.value}
        courses={data.courses}
        onDone={back}
      />
    );
  if (view?.kind === "attempt")
    return (
      <StudentAttempt
        initial={view.value}
        studentId={user.uid}
        courseName={course?.name}
        onDone={back}
      />
    );
  if (view?.kind === "completed")
    return (
      <AssessmentCompleted
        title={view.value.title}
        courseName={course?.name}
        onDone={back}
      />
    );
  if (view?.kind === "results")
    return <ResultsPanel initial={view.value} course={course} onDone={back} />;
  if (view?.kind === "grades")
    return (
      <GradeHistoryPanel
        initial={view.value}
        onDone={() => setView(null)}
      />
    );
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-green-800">
          Aprender y compartir
        </p>
        <h1 className="text-3xl font-bold text-[#304744]">Evaluaciones</h1>
        <p className="mt-2 text-sm text-[#5A6B6A]">
          {isTeacher
            ? "Diseña evaluaciones y descubre la evidencia de aprendizaje de tu curso."
            : "Cada respuesta nos ayuda a conocer cómo aprendes. ¡Vamos paso a paso!"}
        </p>
      </header>
      {error && (
        <Alert tone="danger" title="No pudimos completar la solicitud">
          {error}
          <div className="mt-3">
            <Button variant="secondary" onClick={back}>
              Reintentar carga
            </Button>
          </div>
        </Alert>
      )}
      {busy && <p role="status">Cargando…</p>}
      {!data && !busy && !error && (
        <p role="status">Preparando evaluaciones…</p>
      )}
      {view?.kind === "detail" ? (
        <Card title={view.value.title}>
          <div className="space-y-4">
            <p>
              {course?.name} · {statusLabels[view.value.status]}
            </p>
            <p>
              Disponible: {new Date(view.value.startsAt).toLocaleString()} –{" "}
              {new Date(view.value.endsAt).toLocaleString()}
            </p>
            <p>
              Intentos iniciados: {view.value.assignment.count} /{" "}
              {view.value.attemptLimit}. Duración:{" "}
              {view.value.durationMinutes || "Hasta el cierre"}
              {view.value.durationMinutes ? " minutos" : ""}.
            </p>
            <p>Se utiliza el último intento enviado.</p>
            {availabilityMessage && (
              <Alert
                tone={canStartAssessment ? "info" : "warning"}
                title={canStartAssessment ? "Puedes continuar" : "No disponible"}
              >
                {availabilityMessage}
              </Alert>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy || !canStartAssessment}
                onClick={() => start(view.value)}
              >
                {activeAttempt ? "Retomar intento" : "Iniciar evaluación"}
              </Button>
              {view.value.assignment.result && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () =>
                      setView({
                        ...view,
                        kind: "review",
                        value: {
                          ...view.value,
                          review: await assessmentRequest("review", {
                            assessmentId: view.value.id,
                          }),
                        },
                      }),
                    )
                  }
                >
                  Ver mi resultado
                </Button>
              )}
              <Button variant="ghost" onClick={back}>
                Volver
              </Button>
            </div>
          </div>
        </Card>
      ) : view?.kind === "review" ? (
        <Card title={`Mi resultado · ${view.value.title}`}>
          <div className="space-y-4">
            <p className="text-2xl font-bold">
              {view.value.review.scaledScore} / {view.value.scale}
            </p>
            <p>
              {view.value.review.result.overallScore} /{" "}
              {view.value.review.result.maxScore} puntos
            </p>
            {view.value.review.feedback.map((f) => {
              const q = view.value.review.questions.find(
                (q) => q.questionId === f.questionId,
              );
              return (
                <Alert
                  key={f.questionId}
                  tone={f.correct ? "success" : "info"}
                  title={q.prompt}
                >
                  {f.correct ? "Correcta." : "Para repasar."} Respuesta:{" "}
                  {q.options[f.correctAnswer]}. {f.explanation}
                </Alert>
              );
            })}
            {!view.value.review.feedback.length && (
              <p>
                La corrección detallada no está disponible según la
                configuración docente.
              </p>
            )}
            <Button onClick={back}>Volver</Button>
          </div>
        </Card>
      ) : (
        data && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <Select
                  label="Filtrar por evaluación"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  options={[
                    { value: "", label: "Todas las evaluaciones" },
                    ...data.assessments.map((a) => ({
                      value: a.id,
                      label: a.title,
                    })),
                  ]}
                />
              </div>
              {isTeacher && (
                <Button
                  disabled={!data.courses.length || busy}
                  onClick={() =>
                    setView({
                      kind: "edit",
                      value: newAssessment(data.courses[0]),
                    })
                  }
                >
                  Crear evaluación
                </Button>
              )}
              {!isTeacher && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () =>
                      setView({
                        kind: "grades",
                        value: await assessmentRequest("grades"),
                      }),
                    )
                  }
                >
                  Mis calificaciones
                </Button>
              )}
              <Button variant="secondary" disabled={busy} onClick={back}>
                Actualizar
              </Button>
            </div>
            {!data.courses.length && (
              <Alert tone="info" title="Sin cursos autorizados">
                Un administrador debe habilitar tu curso y su matrícula en el
                módulo de evaluaciones.
              </Alert>
            )}
            {!data.assessments.length && (
              <Card title="Aún no hay evaluaciones">
                <p>
                  {isTeacher
                    ? "Crea tu primera evaluación con preguntas y estudiantes reales."
                    : "Aquí aparecerán las evaluaciones que tu docente te asigne."}
                </p>
              </Card>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {data.assessments
                .filter((a) => !filter || a.id === filter)
                .map((a) => (
                  <Card key={a.id} title={a.title}>
                    <div className="space-y-3">
                      <p className="text-sm">
                        {data.courses.find((c) => c.id === a.courseId)?.name} ·{" "}
                        {statusLabels[a.status]}
                      </p>
                      <p className="text-sm">
                        Cierre: {new Date(a.endsAt).toLocaleString()}
                      </p>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => open(a)}
                      >
                        {isTeacher
                          ? a.status === "draft"
                            ? "Editar borrador"
                            : "Ver resultados"
                          : "Abrir evaluación"}
                      </Button>
                    </div>
                  </Card>
                ))}
            </div>
          </>
        )
      )}
    </div>
  );
}

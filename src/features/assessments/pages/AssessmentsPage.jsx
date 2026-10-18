import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, Button, Card, LoadingState } from "@/components/ui";
import { loadBootstrap } from "../services/assessmentService";
import { assessmentRequest } from "../services/assessmentService";
import { useOperation } from "../hooks/useOperation";
import { newAssessment, statusLabels } from "../utils/forms";
import AssessmentEditor from "../components/AssessmentEditor";
import StudentAttempt from "../components/StudentAttempt";
import ResultsPanel from "../components/ResultsPanel";
import AssessmentCompleted from "../components/AssessmentCompleted";
import GradeHistoryPanel from "../components/GradeHistoryPanel";
import TeacherCourseOverview, { TeacherCourseHeader } from "../components/TeacherCourseOverview";

import StudentCourseOverview, { StudentCourseHeader } from "../components/StudentCourseOverview";

export default function AssessmentsPage() {
  const { isTeacher, user } = useAuth();
  const location = useLocation();
  const exitRef = useRef(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState(null);
  const [filter, setFilter] = useState("");
  const [now, setNow] = useState(0);
  const { busy, error, run } = useOperation();
  const refresh = useCallback(
    (options) => run(async () => setData(await loadBootstrap(options))),
    [run],
  );
  const back = useCallback(() => {
    setView(null);
    refresh();
  }, [refresh]);
  useEffect(() => {
    run(async () => setData(await loadBootstrap()));
  }, [run]);
  useEffect(() => {
    if (view?.kind !== "detail") return undefined;
    const refreshTime = () => setNow(Date.now());
    refreshTime();
    const timer = setInterval(refreshTime, 30_000);
    return () => clearInterval(timer);
  }, [view?.kind]);
  /* Volver a pulsar «Curso» en el menú devuelve al listado del módulo, incluso
     desde el editor: se respeta la confirmación de cambios sin guardar.
     Solo debe reaccionar a una navegación real. Si se escuchara cualquier cambio
     de `view`, abrir el editor o los resultados se cerraría al instante. */
  const handledNav = useRef(null);
  useEffect(() => {
    if (handledNav.current === location) return;
    handledNav.current = location;
    if (location.state?.koedukoNav !== "/assessments" || !view) return;
    if (view.kind === "edit" && exitRef.current) {
      exitRef.current();
      return;
    }
    back();
  }, [location, view, back]);
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
        exitRef={exitRef}
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
      {isTeacher ? <TeacherCourseHeader /> : <StudentCourseHeader />}
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
      {busy && !view && <LoadingState label="Cargando evaluaciones…" />}
      {!data && !busy && !error && <LoadingState label="Preparando evaluaciones…" />}
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
        data && (isTeacher ? (
          <TeacherCourseOverview
            data={data}
            filter={filter}
            onFilterChange={(event) => setFilter(event.target.value)}
            busy={busy}
            onCreate={() => setView({ kind: "edit", value: newAssessment(data.courses[0]) })}
            onRefresh={() => refresh({ refresh: true })}
            onOpen={open}
          />
        ) : (
          <StudentCourseOverview
            data={data}
            filter={filter}
            onFilterChange={(event) => setFilter(event.target.value)}
            busy={busy}
            onGrades={() => run(async () => setView({ kind: "grades", value: await assessmentRequest("grades") }))}
            onRefresh={() => refresh({ refresh: true })}
            onOpen={open}
          />
        ))
      )}
    </div>
  );
}

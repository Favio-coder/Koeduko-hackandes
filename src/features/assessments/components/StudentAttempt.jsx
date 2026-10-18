import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import {
  confirmExamSubmission,
  showWarning,
} from "@/shared/lib/alerts";
import { assessmentRequest } from "../services/assessmentService";
import AssessmentCompleted from "./AssessmentCompleted";
import QuestionCard from "./QuestionCard";

function restore(key, attempt, questions) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (
      saved?.revision !== attempt.revision ||
      !saved.answers ||
      typeof saved.answers !== "object" ||
      Array.isArray(saved.answers)
    ) {
      return attempt.answers;
    }
    const validAnswers = Object.fromEntries(
      Object.entries(saved.answers).filter(([questionId, answer]) => {
        const question = questions.find((item) => item.questionId === questionId);
        return (
          question &&
          Number.isInteger(answer) &&
          answer >= 0 &&
          answer < question.options.length
        );
      }),
    );
    return { ...attempt.answers, ...validAnswers };
  } catch {
    return attempt.answers;
  }
}

function formatRemaining(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function errorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Revisa tu conexión e intenta guardar nuevamente.";
}

export default function StudentAttempt({
  initial,
  studentId,
  courseName,
  onDone,
}) {
  const { assessment, attempt } = initial;
  const key = `koeduko-assessment:${studentId}:${assessment.id}:${attempt.id}`;
  const [answers, setAnswers] = useState(() =>
    restore(key, attempt, assessment.questions),
  );
  const [locked, setLocked] = useState(attempt.answers);
  const answersRef = useRef(answers);
  const revisionRef = useRef(attempt.revision);
  const lastSavedAnswers = useRef(attempt.answers);
  const lockedRef = useRef(attempt.answers);
  const savePromise = useRef(null);
  const persistLatestRef = useRef(null);
  const queuedSave = useRef(false);
  const submitLock = useRef(false);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState(initial.feedback || []);
  const [submitted, setSubmitted] = useState(null);
  const [saveStatus, setSaveStatus] = useState(
    JSON.stringify(answers) === JSON.stringify(attempt.answers)
      ? "saved"
      : "saving",
  );
  const [saveError, setSaveError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const immediate = assessment.feedbackMode === "immediate";
  const question = assessment.questions[index];
  const count = Object.keys(answers).length;
  const unansweredQuestions = assessment.questions.filter(
    (item) => !Object.hasOwn(answers, item.questionId),
  );

  const parsedServerNow = Date.parse(initial.serverNow);
  const parsedStartedAt = Date.parse(attempt.startedAt);
  const serverTimeAnchor = Number.isFinite(parsedServerNow)
    ? parsedServerNow
    : Number.isFinite(parsedStartedAt)
      ? parsedStartedAt
      : Date.parse(attempt.expiresAt);
  const deadline = Date.parse(attempt.expiresAt);
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, deadline - serverTimeAnchor),
  );
  const clockAnchor = useRef(null);
  const expired = remainingMs === 0;
  const countdown = formatRemaining(remainingMs);
  const currentFeedback = feedback.find(
    (item) => item.questionId === question.questionId,
  );
  const unanswered = !Object.hasOwn(answers, question.questionId);
  const warningTier =
    remainingMs === 0 ? "expired" : remainingMs <= 60_000 ? "minute" :
      remainingMs <= 300_000 ? "five-minutes" : "";

  useEffect(() => {
    const monotonicStart =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    clockAnchor.current = {
      server: serverTimeAnchor,
      monotonic: monotonicStart,
    };
    const updateClock = () => {
      const monotonicNow =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const currentServerTime =
        serverTimeAnchor + Math.max(0, monotonicNow - monotonicStart);
      setRemainingMs(Math.max(0, deadline - currentServerTime));
    };
    const timer = setInterval(updateClock, 250);
    return () => clearInterval(timer);
  }, [deadline, serverTimeAnchor]);

  useEffect(() => {
    if (submitted) return undefined;
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ answers, revision: revisionRef.current }),
      );
    } catch {
      // The server remains the source of truth if browser storage is unavailable.
    }
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [answers, key, submitted]);

  const persistLatest = () => {
    if (expired) {
      setSaveStatus("expired");
      return Promise.resolve(false);
    }
    if (savePromise.current) {
      queuedSave.current = true;
      return savePromise.current;
    }
    if (
      JSON.stringify(answersRef.current) ===
      JSON.stringify(lastSavedAnswers.current)
    ) {
      return Promise.resolve(true);
    }

    const task = (async () => {
      do {
        queuedSave.current = false;
        const snapshot = answersRef.current;
        if (
          JSON.stringify(snapshot) === JSON.stringify(lastSavedAnswers.current)
        ) {
          continue;
        }
        if (Date.parse(attempt.expiresAt) <= serverClockNow()) {
          setSaveStatus("expired");
          return false;
        }
        setSaveStatus("saving");
        setSaveError("");
        try {
          const response = await assessmentRequest("saveAnswers", {
            assessmentId: assessment.id,
            attemptId: attempt.id,
            revision: revisionRef.current,
            answers: snapshot,
          });
          revisionRef.current = response.revision;
          lastSavedAnswers.current = snapshot;
          lockedRef.current = snapshot;
          setLocked(snapshot);
          setFeedback(response.feedback || []);
        } catch (error) {
          queuedSave.current = false;
          setSaveStatus("error");
          setSaveError(errorMessage(error));
          return false;
        }
      } while (
        queuedSave.current ||
        JSON.stringify(answersRef.current) !==
          JSON.stringify(lastSavedAnswers.current)
      );
      setSaveStatus("saved");
      return true;
    })().finally(() => {
      savePromise.current = null;
    });
    savePromise.current = task;
    return task;
  };
  useEffect(() => {
    persistLatestRef.current = persistLatest;
  });

  useEffect(() => {
    if (
      JSON.stringify(answersRef.current) !==
      JSON.stringify(lastSavedAnswers.current)
    ) {
      queuedSave.current = true;
      void persistLatestRef.current();
    }
  }, []);

  function serverClockNow() {
    if (!clockAnchor.current) return serverTimeAnchor;
    const monotonicNow =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    return (
      clockAnchor.current.server +
      Math.max(0, monotonicNow - clockAnchor.current.monotonic)
    );
  }

  const selectAnswer = (value) => {
    if (expired || (immediate && Object.hasOwn(lockedRef.current, question.questionId))) {
      return;
    }
    const nextAnswers = { ...answersRef.current, [question.questionId]: value };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setSaveStatus("saving");
    setSaveError("");
    queuedSave.current = true;
    void persistLatest();
  };

  const submit = async () => {
    if (submitLock.current || expired) return;
    if (unansweredQuestions.length) {
      await showWarning(
        `Te ${unansweredQuestions.length === 1 ? "queda 1 pregunta" : `quedan ${unansweredQuestions.length} preguntas`} sin responder. Revisa las preguntas marcadas antes de finalizar.`,
        "Aún hay preguntas pendientes",
      );
      setIndex(
        assessment.questions.findIndex(
          (item) => !Object.hasOwn(answersRef.current, item.questionId),
        ),
      );
      return;
    }
    if (
      !(await confirmExamSubmission({
        answeredCount: count,
        totalCount: assessment.questions.length,
      }))
    ) {
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const saved = await persistLatest();
      if (!saved) return;
      if (Date.parse(attempt.expiresAt) <= serverClockNow()) {
        setSaveStatus("expired");
        return;
      }
      const result = await assessmentRequest("submit", {
        assessmentId: assessment.id,
        attemptId: attempt.id,
        revision: revisionRef.current,
        answers: answersRef.current,
      });
      setSubmitted(result);
      try {
        sessionStorage.removeItem(key);
      } catch {
        // The recovery cache is optional.
      }
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (submitted)
    return (
      <AssessmentCompleted
        title={assessment.title}
        courseName={courseName}
        onDone={onDone}
      />
    );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-3 pb-8 text-[#304744] sm:space-y-5 sm:px-5">
      <header className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#E2E9E0] bg-[#F8FAF6] p-3 sm:p-5">
        <img
          src="/logo/logoKoedukosinfondo.png"
          alt=""
          className="h-12 w-12 shrink-0 object-contain sm:h-16 sm:w-16"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#2A7A35]">{courseName}</p>
          <h1 className="break-words text-xl font-bold sm:text-2xl">
            {assessment.title}
          </h1>
          <p className="mt-1 text-xs text-[#5A6B6A] sm:text-sm">
            Avanza a tu ritmo; puedes volver a revisar tus respuestas antes de
            finalizar.
          </p>
        </div>
        <div
          className={`shrink-0 rounded-xl border px-2.5 py-2 text-center tabular-nums sm:px-4 ${
            expired
              ? "border-red-300 bg-red-50 text-red-800"
              : warningTier
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-[#DCE6DC] bg-white text-[#304744]"
          }`}
          aria-label={`Tiempo restante: ${countdown}`}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wide sm:text-xs">
            Tiempo
          </span>
          <span role="timer" className="text-lg font-bold sm:text-2xl">
            {countdown}
          </span>
        </div>
      </header>

      {warningTier && (
        <p className="sr-only" role="status" aria-live="polite">
          {warningTier === "expired"
            ? "El tiempo terminó. Las respuestas guardadas se conservan y el intento está bloqueado."
            : warningTier === "minute"
              ? "Aviso: queda menos de un minuto."
              : "Aviso: quedan cinco minutos o menos."}
        </p>
      )}

      <section
        aria-label="Progreso de la evaluación"
        className="rounded-2xl border border-[#E2E9E0] bg-white p-3 sm:p-4"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-semibold">
            Pregunta {index + 1} de {assessment.questions.length}
          </p>
          <p className="text-[#5A6B6A]">
            {count} de {assessment.questions.length} respondidas
          </p>
        </div>
        <progress
          aria-label="Preguntas respondidas"
          value={count}
          max={assessment.questions.length}
          aria-valuetext={`${count} de ${assessment.questions.length} preguntas respondidas`}
          className="h-2.5 w-full accent-[#304744]"
        />
      </section>

      {saveError && (
        <Alert tone="danger" title="No se pudo guardar tu respuesta">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {saveError} Tu respuesta sigue en esta pantalla; vuelve a
              intentarlo cuando tengas conexión.
            </span>
            <Button
              variant="secondary"
              disabled={expired}
              onClick={() => void persistLatest()}
            >
              Reintentar guardado
            </Button>
          </div>
        </Alert>
      )}
      {submitError && (
        <Alert tone="danger" title="No se pudo finalizar">
          {submitError} Tus respuestas guardadas se conservan; puedes volver a
          intentarlo dentro del plazo.
        </Alert>
      )}
      {expired && (
        <Alert tone="warning" title="El tiempo terminó">
          El intento está bloqueado. Se conservan las respuestas guardadas
          automáticamente; no se enviarán cambios después del plazo.
        </Alert>
      )}

      <Card className="min-w-0 p-4 sm:p-6">
        <QuestionCard
          question={question}
          value={answers[question.questionId]}
          disabled={
            expired ||
            submitting ||
            (immediate && Object.hasOwn(locked, question.questionId))
          }
          onChange={selectAnswer}
        />
      </Card>

      {unanswered && !expired && (
        <Alert tone="info" title="Pregunta sin responder">
          Elige una alternativa. Puedes avanzar y regresar a esta pregunta
          antes de finalizar.
        </Alert>
      )}
      {immediate && (
        <p className="text-sm text-[#5A6B6A]">
          Esta práctica tiene retroalimentación inmediata habilitada por tu
          docente. Una respuesta guardada ya no se puede cambiar.
        </p>
      )}
      {currentFeedback && immediate && (
        <Alert
          tone="info"
          title="Sigamos aprendiendo"
        >
          Revisa la explicación de esta práctica.
          {currentFeedback.explanation
            ? ` ${currentFeedback.explanation}`
            : ""}
        </Alert>
      )}

      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-sm">
        <p role="status" aria-live="polite">
          {expired
            ? "Guardado detenido: el plazo terminó."
            : saveStatus === "saving"
            ? "Guardando respuesta…"
            : saveStatus === "saved"
              ? "Respuestas guardadas"
              : ""}
        </p>
        {saveStatus === "saved" && (
          <span className="text-xs text-[#5A6B6A]">Guardado automático</span>
        )}
      </div>

      <nav
        aria-label="Navegación de preguntas"
        className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between"
      >
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={index === 0 || submitting}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
        >
          Anterior
        </Button>
        {index < assessment.questions.length - 1 ? (
          <Button
            className="w-full sm:w-auto"
            disabled={submitting}
            onClick={() =>
              setIndex((current) =>
                Math.min(assessment.questions.length - 1, current + 1),
              )
            }
          >
            Siguiente
          </Button>
        ) : (
          <Button
            className="col-span-2 w-full sm:col-span-1 sm:w-auto"
            disabled={expired || submitting}
            loading={submitting}
            onClick={submit}
          >
            Finalizar examen
          </Button>
        )}
      </nav>
      <div className="flex justify-center">
        <Button
          variant="ghost"
          disabled={submitting}
          onClick={onDone}
        >
          Salir (puedes retomar dentro del plazo)
        </Button>
      </div>
    </main>
  );
}

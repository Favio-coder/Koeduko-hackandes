import { useEffect, useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import Modal from "@/components/ui/Modal";
import { assessmentRequest } from "../services/assessmentService";
import { useOperation } from "../hooks/useOperation";
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
  const [revision, setRevision] = useState(attempt.revision);
  const [locked, setLocked] = useState(attempt.answers);
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [feedback, setFeedback] = useState(initial.feedback || []);
  const [submitted, setSubmitted] = useState(null);
  const [saved, setSaved] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const { busy, error, run } = useOperation();
  const question = assessment.questions[index];
  const count = Object.keys(answers).length;
  const expired = now >= Date.parse(attempt.expiresAt);
  const immediate = assessment.feedbackMode === "immediate";
  const currentFeedback = feedback.find(
    (f) => f.questionId === question.questionId,
  );
  const unanswered = !Object.hasOwn(answers, question.questionId);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (submitted) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ answers, revision }));
    } catch {
      /* Server save remains available when browser storage is disabled. */
    }
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [answers, revision, key, submitted]);
  const persist = (nextIndex) =>
    run(async () => {
      const response = await assessmentRequest("saveAnswers", {
        assessmentId: assessment.id,
        attemptId: attempt.id,
        revision,
        answers,
      });
      setRevision(response.revision);
      setFeedback(response.feedback);
      setLocked(answers);
      setSaved("Respuestas guardadas en el servidor.");
      if (nextIndex !== undefined) setIndex(nextIndex);
    });
  const submit = () =>
    run(async () => {
      const result = await assessmentRequest("submit", {
        assessmentId: assessment.id,
        attemptId: attempt.id,
        revision,
        answers,
      });
      setSubmitted(result);
      setConfirm(false);
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Optional recovery cache. */
      }
    });
  if (submitted)
    return (
      <AssessmentCompleted
        title={assessment.title}
        courseName={courseName}
        onDone={onDone}
      />
    );
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center gap-3">
        <img
          src="/logo/logoKoedukosinfondo.png"
          alt=""
          className="h-14 w-14 object-contain"
        />
        <div>
          <p className="text-sm font-semibold text-green-800">{courseName}</p>
          <h2 className="text-2xl font-bold">{assessment.title}</h2>
        </div>
      </header>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <p>
          Pregunta {index + 1} de {assessment.questions.length} · {count}{" "}
          respondidas
        </p>
        <p>
          Tiempo restante:{" "}
          {Math.max(
            0,
            Math.ceil((Date.parse(attempt.expiresAt) - now) / 60000),
          )}{" "}
          min
        </p>
      </div>
      <progress
        aria-label="Progreso de respuestas"
        value={count}
        max={assessment.questions.length}
        aria-valuetext={`${count} de ${assessment.questions.length} preguntas respondidas`}
        className="h-3 w-full accent-green-600"
      />
      {error && (
        <Alert tone="danger" title="No se completó la operación">
          {error} Tus respuestas se conservan en esta pantalla; puedes
          reintentar.
        </Alert>
      )}
      {expired && (
        <Alert tone="warning" title="El plazo terminó">
          El servidor no aceptará nuevos envíos. Las respuestas guardadas se
          conservan.
        </Alert>
      )}
      <Card>
        <QuestionCard
          question={question}
          value={answers[question.questionId]}
          disabled={
            busy ||
            expired ||
            (immediate && Object.hasOwn(locked, question.questionId))
          }
          onChange={(value) => {
            setAnswers({ ...answers, [question.questionId]: value });
            setSaved("Hay cambios sin guardar en el servidor.");
          }}
        />
      </Card>
      {unanswered && (
        <Alert tone="info" title="Pregunta sin responder">
          Elige una alternativa antes de finalizar. Puedes continuar y volver a
          esta pregunta cuando quieras.
        </Alert>
      )}
      {immediate && (
        <p className="text-sm">
          Al guardar una respuesta, verás su corrección y ya no podrás
          cambiarla.
        </p>
      )}
      {currentFeedback && (
        <Alert
          tone={currentFeedback.correct ? "success" : "info"}
          title={
            currentFeedback.correct
              ? "¡Respuesta correcta!"
              : "Sigamos aprendiendo"
          }
        >
          Respuesta: {question.options[currentFeedback.correctAnswer]}.{" "}
          {currentFeedback.explanation}
        </Alert>
      )}
      <p role="status" className="text-sm">
        {saved}
      </p>
      <div className="flex flex-wrap justify-between gap-3">
        <Button
          variant="secondary"
          disabled={index === 0 || busy}
          onClick={() =>
            expired ? setIndex(index - 1) : persist(index - 1)
          }
        >
          Anterior
        </Button>
        <Button
          variant="secondary"
          disabled={expired}
          loading={busy}
          onClick={() => persist()}
        >
          Guardar respuestas
        </Button>
        {index < assessment.questions.length - 1 ? (
          <Button
            disabled={busy}
            onClick={() => (expired ? setIndex(index + 1) : persist(index + 1))}
          >
            Siguiente
          </Button>
        ) : (
          <Button
            disabled={busy || expired || count !== assessment.questions.length}
            onClick={() => setConfirm(true)}
          >
            Finalizar evaluación
          </Button>
        )}
      </div>
      <Button variant="ghost" disabled={busy} onClick={onDone}>
        Salir (puedes retomar dentro del plazo)
      </Button>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        dismissible={!busy}
        title="¿Enviar tus respuestas?"
        footer={
          <Button loading={busy} onClick={submit}>
            Confirmar envío
          </Button>
        }
      >
        <p>
          Respondiste {count} de {assessment.questions.length} preguntas. Al
          enviar, tus respuestas quedarán bloqueadas y no podrás modificarlas.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-red-800">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}

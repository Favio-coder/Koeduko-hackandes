import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentRequest } from "../services/assessmentService";
import {
  confirmExamSubmission,
  showWarning,
} from "@/shared/lib/alerts";
import StudentAttempt from "../components/StudentAttempt";

vi.mock("../services/assessmentService", () => ({
  assessmentRequest: vi.fn(),
}));
vi.mock("@/shared/lib/alerts", () => ({
  confirmExamSubmission: vi.fn(),
  showWarning: vi.fn(),
}));

const serverNow = new Date().toISOString();
const initial = {
  serverNow,
  assessment: {
    id: "exam-1",
    title: "Evaluación de práctica",
    scale: 20,
    feedbackMode: "none",
    questions: [
      {
        questionId: "q1",
        prompt: "¿Cuánto es 1 + 1?",
        options: ["2", "3"],
      },
      {
        questionId: "q2",
        prompt: "¿Cuánto es 2 + 2?",
        options: ["3", "4"],
      },
    ],
  },
  attempt: {
    id: "attempt-1",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    answers: {},
    revision: 0,
  },
};

function renderAttempt() {
  return render(
    <StudentAttempt
      initial={initial}
      studentId="student-1"
      courseName="Matemática 5A"
      onDone={vi.fn()}
    />,
  );
}

describe("StudentAttempt", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(assessmentRequest).mockReset();
    vi.mocked(confirmExamSubmission).mockReset();
    vi.mocked(showWarning).mockReset();
    vi.mocked(confirmExamSubmission).mockResolvedValue(true);
    vi.mocked(showWarning).mockResolvedValue({});
    vi.mocked(assessmentRequest).mockImplementation(async (action, payload) => {
      if (action === "saveAnswers") {
        return { revision: payload.revision + 1, feedback: [] };
      }
      if (action === "submit") return {};
      throw new Error(`Unexpected action: ${action}`);
    });
  });

  it("guarda al seleccionar y Siguiente solo navega sin mostrar corrección", async () => {
    renderAttempt();

    expect(screen.getByText("¿Cuánto es 1 + 1?")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "0");
    expect(screen.getByText("Pregunta sin responder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    expect(screen.queryByText("Pregunta sin responder")).not.toBeInTheDocument();
    await waitFor(() => expect(assessmentRequest).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("¿Cuánto es 2 + 2?")).toBeInTheDocument();
    expect(assessmentRequest).toHaveBeenCalledWith(
      "saveAnswers",
      expect.objectContaining({
        assessmentId: "exam-1",
        attemptId: "attempt-1",
        answers: { q1: 0 },
      }),
    );
    expect(
      screen.queryByText(/¡Respuesta correcta!|Incorrecto/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByText("¿Cuánto es 1 + 1?")).toBeInTheDocument();
  });

  it("recupera de sessionStorage una respuesta cuyo guardado falló", async () => {
    vi.mocked(assessmentRequest).mockRejectedValueOnce(
      new Error("Sin conexión"),
    );
    const firstRender = renderAttempt();
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    await waitFor(() => {
      expect(
        sessionStorage.getItem("koeduko-assessment:student-1:exam-1:attempt-1"),
      ).toContain('"q1":1');
    });
      expect(await screen.findByText(/Sin conexión/)).toBeInTheDocument();
      firstRender.unmount();

    renderAttempt();
    expect(screen.getByRole("radio", { name: "3" })).toBeChecked();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");
  });

  it("confirma el envío final y muestra la pantalla completada", async () => {
    renderAttempt();
    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(await screen.findByRole("radio", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "Finalizar examen" }));

    expect(confirmExamSubmission).toHaveBeenCalledWith({
      answeredCount: 2,
      totalCount: 2,
    });

    expect(
      await screen.findByRole("heading", { name: "¡Evaluación completada!" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tus respuestas se enviaron correctamente/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Finalizar examen" }),
    ).not.toBeInTheDocument();
    expect(assessmentRequest).toHaveBeenCalledWith(
      "submit",
      expect.objectContaining({
        answers: { q1: 0, q2: 1 },
      }),
    );
  });

  it("mantiene controles utilizables en layouts móviles y escritorio", () => {
    const { container } = renderAttempt();

    expect(container.querySelector(".mx-auto.w-full.max-w-3xl")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Guardar respuesta/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeInTheDocument();
    expect(container.querySelector(".grid-cols-2")).toBeInTheDocument();
  });

  it("no envía el intento si se cancela la confirmación", async () => {
    vi.mocked(confirmExamSubmission).mockResolvedValue(false);
    renderAttempt();
    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(await screen.findByRole("radio", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "Finalizar examen" }));

    await waitFor(() => expect(confirmExamSubmission).toHaveBeenCalled());
    expect(assessmentRequest).not.toHaveBeenCalledWith(
      "submit",
      expect.anything(),
    );
  });

  it("serializa cambios rápidos y guarda la respuesta más reciente", async () => {
    let resolveFirst;
    vi.mocked(assessmentRequest).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    renderAttempt();
    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("radio", { name: "3" }));

    expect(assessmentRequest).toHaveBeenCalledTimes(1);
    resolveFirst({ revision: 1, feedback: [] });
    await waitFor(() => expect(assessmentRequest).toHaveBeenCalledTimes(2));
    expect(assessmentRequest).toHaveBeenLastCalledWith(
      "saveAnswers",
      expect.objectContaining({
        revision: 1,
        answers: { q1: 0, q2: 0 },
      }),
    );
  });

  it("muestra el tiempo y bloquea respuestas al vencer el intento", () => {
    const expiredInitial = {
      ...initial,
      serverNow: new Date().toISOString(),
      attempt: {
        ...initial.attempt,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      },
    };
    render(
      <StudentAttempt
        initial={expiredInitial}
        studentId="student-1"
        courseName="Matemática 5A"
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.getByText("El tiempo terminó")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "2" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("button", { name: "Finalizar examen" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "4" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "4" }));
    expect(assessmentRequest).not.toHaveBeenCalledWith(
      "saveAnswers",
      expect.anything(),
    );
  });

  it("cuenta hacia atrás y usa horas cuando el tiempo supera una hora", async () => {
    const start = Date.now();
    const timedInitial = {
      ...initial,
      serverNow: new Date(start).toISOString(),
      attempt: {
        ...initial.attempt,
        expiresAt: new Date(start + 3_600_000).toISOString(),
      },
    };
    vi.useFakeTimers();
    vi.setSystemTime(start);
    try {
      render(
        <StudentAttempt
          initial={timedInitial}
          studentId="student-1"
          courseName="Matemática 5A"
          onDone={vi.fn()}
        />,
      );
      expect(screen.getByRole("timer")).toHaveTextContent("01:00:00");
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });
      expect(screen.getByRole("timer")).toHaveTextContent("59:59");
    } finally {
      vi.useRealTimers();
    }
  });

  it("advierte las preguntas pendientes sin solicitar confirmación de entrega", async () => {
    renderAttempt();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Finalizar examen" }));

    expect(showWarning).toHaveBeenCalledWith(
      expect.stringContaining("quedan 2 preguntas sin responder"),
      "Aún hay preguntas pendientes",
    );
    expect(confirmExamSubmission).not.toHaveBeenCalled();
    expect(await screen.findByText("¿Cuánto es 1 + 1?")).toBeInTheDocument();
  });

  it("evita envíos duplicados mientras la entrega está en curso", async () => {
    let resolveSubmit;
    vi.mocked(assessmentRequest).mockImplementation((action, payload) => {
      if (action === "saveAnswers") {
        return Promise.resolve({
          revision: payload.revision + 1,
          feedback: [],
        });
      }
      if (action === "submit") {
        return new Promise((resolve) => {
          resolveSubmit = resolve;
        });
      }
      throw new Error(`Unexpected action: ${action}`);
    });
    renderAttempt();
    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(await screen.findByRole("radio", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "Finalizar examen" }));
    await waitFor(() =>
      expect(assessmentRequest).toHaveBeenCalledWith(
        "submit",
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Finalizar examen" }));
    expect(
      vi.mocked(assessmentRequest).mock.calls.filter(
        ([action]) => action === "submit",
      ),
    ).toHaveLength(1);

    resolveSubmit({});
    expect(
      await screen.findByRole("heading", { name: "¡Evaluación completada!" }),
    ).toBeInTheDocument();
  });
});

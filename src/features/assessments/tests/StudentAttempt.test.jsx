import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentRequest } from "../services/assessmentService";
import StudentAttempt from "../components/StudentAttempt";

vi.mock("../services/assessmentService", () => ({
  assessmentRequest: vi.fn(),
}));

const initial = {
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
    vi.mocked(assessmentRequest).mockImplementation(async (action, payload) => {
      if (action === "saveAnswers") {
        return { revision: payload.revision + 1, feedback: [] };
      }
      if (action === "submit") return {};
      throw new Error(`Unexpected action: ${action}`);
    });
  });

  it("navega, indica preguntas sin responder y persiste al cambiar de pregunta", async () => {
    renderAttempt();

    expect(screen.getByText("¿Cuánto es 1 + 1?")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "0");
    expect(screen.getByText("Pregunta sin responder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    expect(screen.queryByText("Pregunta sin responder")).not.toBeInTheDocument();
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
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByText("¿Cuánto es 1 + 1?")).toBeInTheDocument();
  });

  it("recupera respuestas locales de la misma revisión al volver a abrir el intento", async () => {
    const firstRender = renderAttempt();
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    await waitFor(() => {
      expect(
        sessionStorage.getItem("koeduko-assessment:student-1:exam-1:attempt-1"),
      ).toContain('"q1":1');
    });
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
    fireEvent.click(screen.getByRole("button", { name: "Finalizar evaluación" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Al enviar, tus respuestas quedarán bloqueadas",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));

    expect(
      await screen.findByRole("heading", { name: "¡Evaluación completada!" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tus respuestas se enviaron correctamente/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Finalizar evaluación" }),
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

    expect(container.querySelector(".mx-auto.max-w-3xl")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar respuestas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeInTheDocument();
  });
});

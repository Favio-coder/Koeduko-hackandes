import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentRequest } from "../services/assessmentService";
import {
  confirmDestructive,
  showConfirmation,
  showError,
  showSuccess,
  showWarning,
} from "@/shared/lib/alerts";
import AssessmentEditor from "../components/AssessmentEditor";

vi.mock("../services/assessmentService", () => ({
  assessmentRequest: vi.fn(),
}));

vi.mock("@/shared/lib/alerts", () => ({
  confirmDestructive: vi.fn(),
  showConfirmation: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
}));

const courses = [
  {
    id: "course-1",
    name: "Matemática 5A",
    competencyId: "quantity",
    areas: [{ id: "math", label: "Matemática" }],
    competencies: [{ id: "quantity", label: "Resuelve problemas" }],
    skills: [{ id: "addition", label: "Adición" }],
    students: [{ id: "student-1", name: "Ana" }],
  },
];

const validQuestion = {
  questionId: "question-1",
  prompt: "¿Cuánto es 2 + 3?",
  type: "multiple_choice",
  options: ["5", "6"],
  correctAnswer: 0,
  skillId: "addition",
  maxScore: 1,
  explanation: "",
};

function initial(overrides = {}) {
  return {
    title: "Evaluación de unidad",
    description: "",
    courseId: "course-1",
    areaId: "math",
    competencyId: "quantity",
    type: "exam",
    scale: 20,
    maxScore: 1,
    durationMinutes: 30,
    attemptLimit: 1,
    weightPercent: 0,
    feedbackMode: "after_close",
    startsAt: new Date(Date.now() + 60_000).toISOString(),
    endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    studentIds: ["student-1"],
    questions: [],
    ...overrides,
  };
}

function renderEditor(value = initial(), onDone = vi.fn()) {
  return {
    onDone,
    ...render(
      <AssessmentEditor initial={value} courses={courses} onDone={onDone} />,
    ),
  };
}

describe("AssessmentEditor", () => {
  beforeEach(() => {
    vi.mocked(assessmentRequest).mockReset();
    vi.mocked(confirmDestructive).mockReset();
    vi.mocked(showConfirmation).mockReset();
    vi.mocked(showError).mockReset();
    vi.mocked(showSuccess).mockReset();
    vi.mocked(showWarning).mockReset();
    vi.mocked(confirmDestructive).mockResolvedValue(true);
    vi.mocked(showConfirmation).mockResolvedValue(true);
    vi.mocked(showError).mockResolvedValue({});
    vi.mocked(showSuccess).mockResolvedValue({});
    vi.mocked(showWarning).mockResolvedValue({});
    vi.mocked(assessmentRequest).mockImplementation(async (action, payload) => {
      if (action === "save") return { id: "draft-1" };
      if (action === "detail") return { ...payload, ...initial({ id: "draft-1" }), id: "draft-1", revision: 1 };
      if (action === "publish") return { id: "assessment-1" };
      throw new Error(`Unexpected action: ${action}`);
    });
  });

  it("presents distinct general, configuration, questions, and review sections", () => {
    renderEditor();

    expect(screen.getByRole("heading", { name: "A. Información general" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "B. Configuración" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "C. Preguntas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "D. Revisión y publicación" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Área/ })).toHaveValue("math");
    expect(screen.queryByLabelText("Ponderación prevista (%)")).not.toBeInTheDocument();
  });

  it("saves a draft with its authorized area and keeps the teacher in the editor", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() => {
      expect(assessmentRequest).toHaveBeenCalledWith(
        "save",
        expect.objectContaining({ areaId: "math", description: "" }),
      );
    });
    expect(await screen.findByText(/Borrador guardado a las/)).toBeInTheDocument();
    expect(showSuccess).toHaveBeenCalledWith(
      "El borrador se guardó correctamente.",
    );
  });

  it("shows field-level feedback and prevents publishing incomplete questions", async () => {
    renderEditor(initial({ questions: [validQuestion], maxScore: 2 }));
    fireEvent.click(screen.getByRole("button", { name: "Publicar evaluación" }));

    expect(await screen.findByText(/debe coincidir con la suma/)).toBeInTheDocument();
    expect(showWarning).toHaveBeenCalled();
    expect(assessmentRequest).not.toHaveBeenCalledWith(
      "publish",
      expect.anything(),
    );
  });

  it("confirms publication, keeps correct answers in the server request, and reports success", async () => {
    const onDone = vi.fn();
    renderEditor(initial({ questions: [validQuestion] }), onDone);
    fireEvent.click(screen.getByRole("button", { name: "Publicar evaluación" }));

    await waitFor(() => {
      expect(assessmentRequest).toHaveBeenCalledWith(
        "publish",
        expect.objectContaining({
          areaId: "math",
          questions: [validQuestion],
        }),
      );
    });
    expect(showConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Publicar evaluación" }),
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "La evaluación se publicó correctamente.",
    );
    expect(onDone).toHaveBeenCalled();
  });

  it("shows backend save errors and associates known failures with a field", async () => {
    vi.mocked(assessmentRequest).mockRejectedValueOnce(
      new Error("El área no está autorizada para este curso."),
    );
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));

    const areaField = screen.getByRole("combobox", { name: /Área/ });
    await waitFor(() => expect(areaField).toHaveAttribute("aria-invalid", "true"));
    expect(document.getElementById("assessment-areaId-error")).toHaveTextContent(
      "El área no está autorizada para este curso.",
    );
    expect(showError).toHaveBeenCalledWith(
      "El área no está autorizada para este curso.",
      "No se pudo guardar la evaluación",
    );
  });

  it("confirms destructive question removal and warns before leaving dirty changes", async () => {
    const onDone = vi.fn();
    renderEditor(initial({ questions: [validQuestion] }), onDone);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar pregunta" }));

    await waitFor(() => expect(confirmDestructive).toHaveBeenCalled());
    expect(screen.queryByText("¿Cuánto es 2 + 3?")).not.toBeInTheDocument();

    vi.mocked(confirmDestructive).mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    await waitFor(() => {
      expect(confirmDestructive).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Hay cambios sin guardar" }),
      );
    });
    expect(onDone).not.toHaveBeenCalled();
  });
});

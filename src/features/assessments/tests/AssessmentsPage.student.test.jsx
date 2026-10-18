import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentRequest } from "../services/assessmentService";
import AssessmentsPage from "../pages/AssessmentsPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isTeacher: false, user: { uid: "student-1" } }),
}));

vi.mock("../services/assessmentService", () => ({
  assessmentRequest: vi.fn(),
}));

const course = {
  id: "course-1",
  name: "Matemática 5A",
  students: [],
};
const assessment = {
  id: "assessment-1",
  title: "Evaluación semanal",
  courseId: course.id,
  status: "published",
  startsAt: new Date(Date.now() - 60_000).toISOString(),
  endsAt: new Date(Date.now() + 60_000).toISOString(),
  attemptLimit: 2,
  durationMinutes: 30,
};

describe("AssessmentsPage estudiante", () => {
  beforeEach(() => {
    vi.mocked(assessmentRequest).mockReset();
    vi.mocked(assessmentRequest).mockImplementation(async (action) => {
      if (action === "bootstrap") {
        return { courses: [course], assessments: [assessment] };
      }
      if (action === "detail") {
        return {
          ...assessment,
          assignment: {
            count: 0,
            activeAttemptId: null,
            resultStatus: "pending",
          },
        };
      }
      if (action === "start") {
        return {
          assessment: {
            ...assessment,
            questions: [
              {
                questionId: "q1",
                prompt: "¿Cuánto es 1 + 1?",
                options: ["2", "3"],
              },
            ],
          },
          attempt: {
            id: "attempt-1",
            expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
            answers: {},
            revision: 0,
          },
        };
      }
      throw new Error(`Unexpected action: ${action}`);
    });
  });

  it("muestra las evaluaciones asignadas y permite abrir la disponible", async () => {
    render(<AssessmentsPage />);

    expect(
      await screen.findByRole("heading", { name: assessment.title }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir evaluación" }));

    const startButton = await screen.findByRole("button", {
      name: "Iniciar evaluación",
    });
    await waitFor(() => expect(startButton).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Iniciar evaluación" }));

    await waitFor(() => {
      expect(assessmentRequest).toHaveBeenCalledWith("start", {
        assessmentId: assessment.id,
      });
    });
  });

  it("muestra completada al reabrir una evaluación ya enviada", async () => {
    vi.mocked(assessmentRequest).mockImplementation(async (action) => {
      if (action === "bootstrap") {
        return { courses: [course], assessments: [assessment] };
      }
      if (action === "detail") {
        return {
          ...assessment,
          assignment: {
            count: 1,
            activeAttemptId: null,
            resultStatus: "graded",
          },
        };
      }
      throw new Error(`Unexpected action: ${action}`);
    });
    render(<AssessmentsPage />);

    await screen.findByRole("heading", { name: assessment.title });
    fireEvent.click(screen.getByRole("button", { name: "Abrir evaluación" }));

    expect(
      await screen.findByRole("heading", {
        name: "¡Evaluación completada!",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Iniciar evaluación" }),
    ).not.toBeInTheDocument();
  });
});

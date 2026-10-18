import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GradeHistoryPanel from "../components/GradeHistoryPanel";

describe("GradeHistoryPanel", () => {
  it("muestra promedio normalizado, notas y pendientes sin asumir cero", () => {
    render(
      <GradeHistoryPanel
        initial={{
          records: [
            {
              studentId: "student-1",
              courseName: "Matemática 5A",
              areaName: "Matemática",
              assessmentId: "exam-1",
              assessmentTitle: "Diagnóstico",
              rawScore: 10,
              maxScore: 20,
              score20: 10,
              gradeStatus: "graded",
              gradedAt: "2026-10-01T10:00:00.000Z",
            },
            {
              studentId: "student-1",
              courseName: "Matemática 5A",
              areaName: "Matemática",
              assessmentId: "exam-2",
              assessmentTitle: "Examen",
              rawScore: null,
              maxScore: 20,
              score20: null,
              gradeStatus: "pending",
              gradedAt: null,
            },
          ],
          averages: [
            {
              studentId: "student-1",
              courseName: "Matemática 5A",
              areaName: "Matemática",
              average20: 10,
              method: "arithmetic",
              gradedCount: 1,
              pendingCount: 1,
            },
          ],
        }}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getAllByText("10 / 20")).toHaveLength(3);
    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de entrega")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("muestra estudiante y errores de configuración de peso en el docente", () => {
    render(
      <GradeHistoryPanel
        teacher
        initial={{
          records: [],
          averages: [
            {
              studentId: "student-1",
              studentName: "Jelibeth",
              courseName: "Matemática 5A",
              areaName: "Matemática",
              average20: null,
              method: "weighted",
              gradedCount: 2,
              pendingCount: 1,
              configurationError: "Falta definir un peso para una evaluación.",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Jelibeth")).toBeInTheDocument();
    expect(screen.getByText("Revisar ponderaciones")).toBeInTheDocument();
    expect(screen.getByText(/Falta definir un peso/)).toBeInTheDocument();
  });
});

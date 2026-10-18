import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ResultsPanel from "../components/ResultsPanel";

vi.mock("../services/assessmentService", () => ({
  assessmentRequest: vi.fn(),
}));

const initial = {
  assessment: {
    id: "assessment-1",
    title: "Evaluación final",
    courseId: "course-1",
    status: "finalized",
    scale: 20,
  },
  assignments: [
    {
      studentId: "student-1",
      count: 1,
      result: {
        overallScore: 5,
        maxScore: 10,
        skills: [],
      },
      scaledScore: 10,
    },
  ],
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe("ResultsPanel matching integration", () => {
  it("reemplaza la exportación manual por navegación a perfiles automáticos", () => {
    render(
      <MemoryRouter initialEntries={["/results"]}>
        <Routes>
          <Route
            path="/results"
            element={
              <ResultsPanel
                initial={initial}
                course={{ students: [], skills: [] }}
                onDone={vi.fn()}
              />
            }
          />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Exportar JSON matching v1.0" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Preparar perfiles para matching" }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/matching?courseId=course-1&assessmentId=assessment-1",
    );
  });
});

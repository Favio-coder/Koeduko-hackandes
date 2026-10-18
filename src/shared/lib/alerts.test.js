import { beforeEach, describe, expect, it, vi } from "vitest";
import Swal from "sweetalert2";
import {
  confirmDestructive,
  confirmExamSubmission,
  showConfirmation,
  showError,
  showSuccess,
  showWarning,
} from "./alerts";

vi.mock("sweetalert2", () => ({ default: { fire: vi.fn() } }));

describe("alert service", () => {
  beforeEach(() => {
    vi.mocked(Swal.fire).mockReset();
    vi.mocked(Swal.fire).mockResolvedValue({ isConfirmed: true });
  });

  it("returns whether a confirmation was accepted", async () => {
    expect(
      await showConfirmation({ title: "Guardar", text: "¿Continuar?" }),
    ).toBe(true);
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Guardar",
        text: "¿Continuar?",
        showCancelButton: true,
        buttonsStyling: false,
      }),
    );

    vi.mocked(Swal.fire).mockResolvedValueOnce({ isConfirmed: false });
    await expect(
      showConfirmation({ title: "Guardar", text: "¿Continuar?" }),
    ).resolves.toBe(false);
  });

  it("provides explicit destructive and final-submission confirmations", async () => {
    await confirmDestructive({
      title: "Cerrar evaluación",
      text: "Se cancelarán intentos abiertos.",
    });
    expect(Swal.fire).toHaveBeenLastCalledWith(
      expect.objectContaining({ icon: "warning", showCancelButton: true }),
    );

    await confirmExamSubmission({ answeredCount: 4, totalCount: 4 });
    expect(Swal.fire).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "¿Enviar tus respuestas?",
        text: expect.stringContaining("4 de 4"),
        confirmButtonText: "Confirmar envío",
      }),
    );
  });

  it("exposes error, warning, and success dialogs", async () => {
    await showError("Error de red");
    expect(Swal.fire).toHaveBeenLastCalledWith(
      expect.objectContaining({ icon: "error", text: "Error de red" }),
    );

    await showWarning("Quedan preguntas");
    expect(Swal.fire).toHaveBeenLastCalledWith(
      expect.objectContaining({ icon: "warning", text: "Quedan preguntas" }),
    );

    await showSuccess("Evaluación enviada");
    expect(Swal.fire).toHaveBeenLastCalledWith(
      expect.objectContaining({
        icon: "success",
        text: "Evaluación enviada",
      }),
    );
  });
});

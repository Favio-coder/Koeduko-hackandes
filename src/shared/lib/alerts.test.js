import { beforeEach, describe, expect, it, vi } from "vitest";
import Swal from "sweetalert2";
import {
  bulletList,
  confirmDestructive,
  confirmExamSubmission,
  showConfirmation,
  showError,
  showInfo,
  showSuccess,
  showWarning,
} from "./alerts";

vi.mock("sweetalert2", () => ({ default: { fire: vi.fn() } }));

const lastCall = () => vi.mocked(Swal.fire).mock.calls.at(-1)[0];

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

  it("pinta cada diálogo con el tono y los botones del sistema visual", async () => {
    await showConfirmation({ title: "Guardar", text: "¿Continuar?" });
    expect(lastCall().customClass).toMatchObject({
      popup: "koeduko-swal koeduko-swal--primary",
      confirmButton: "koeduko-swal__btn koeduko-swal__btn--primary",
      cancelButton: "koeduko-swal__btn koeduko-swal__btn--secondary",
    });

    await confirmDestructive({ title: "Eliminar", text: "No se puede deshacer." });
    expect(lastCall().customClass).toMatchObject({
      popup: "koeduko-swal koeduko-swal--primary",
      confirmButton: "koeduko-swal__btn koeduko-swal__btn--danger",
    });

    await showError("Fallo al guardar");
    expect(lastCall()).toMatchObject({
      icon: "error",
      customClass: expect.objectContaining({
        popup: "koeduko-swal koeduko-swal--danger",
        confirmButton: "koeduko-swal__btn koeduko-swal__btn--danger",
      }),
    });

    await showWarning("Faltan datos");
    expect(lastCall().customClass.popup).toBe("koeduko-swal koeduko-swal--warning");

    await showSuccess("Listo");
    expect(lastCall().customClass.popup).toBe("koeduko-swal koeduko-swal--success");

    await showInfo("Nota");
    expect(lastCall().customClass.popup).toBe("koeduko-swal koeduko-swal--info");
  });

  it("ignora variantes de botón desconocidas", async () => {
    await showConfirmation({
      title: "Guardar",
      text: "¿Continuar?",
      variant: "neon",
    });
    expect(lastCall().customClass.confirmButton).toBe(
      "koeduko-swal__btn koeduko-swal__btn--primary",
    );
  });

  it("usa HTML en lugar de texto plano cuando hay lista", async () => {
    await showWarning({ html: bulletList(["Falta el título", "Falta el curso"]) });
    const { text, html } = lastCall();
    expect(text).toBeUndefined();
    expect(html).toContain("Falta el título");
    expect(html).toContain("koeduko-swal__list");
  });

  it("escapa el contenido de la lista", () => {
    expect(bulletList(['<img src=x onerror="alert(1)">'])).not.toContain("<img");
    expect(bulletList(["a & b"])).toContain("a &amp; b");
    expect(bulletList([])).toBe("");
  });

  it("marca el fondo desenfocado al abrir el diálogo", async () => {
    await showInfo("Con fondo");
    const container = { classList: { add: vi.fn() } };
    lastCall().willOpen({ parentElement: container });
    expect(container.classList.add).toHaveBeenCalledWith("koeduko-swal-backdrop");
    expect(lastCall()).toMatchObject({
      backdrop: expect.any(String),
      buttonsStyling: false,
      returnFocus: true,
    });
  });
});

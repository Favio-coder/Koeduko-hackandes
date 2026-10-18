import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

function fire(options) {
  return Swal.fire({
    buttonsStyling: false,
    confirmButtonColor: "#176a50",
    cancelButtonColor: "#5a6b6a",
    ...options,
  });
}

export function showConfirmation({
  title,
  text,
  confirmButtonText = "Confirmar",
  cancelButtonText = "Cancelar",
  icon = "question",
}) {
  return fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
  }).then(({ isConfirmed }) => isConfirmed);
}

export function showError(text, title = "No se pudo completar la operación") {
  return fire({ icon: "error", title, text, confirmButtonText: "Entendido" });
}

export function showWarning(text, title = "Atención") {
  return fire({ icon: "warning", title, text, confirmButtonText: "Entendido" });
}

export function showSuccess(text, title = "Operación completada") {
  return fire({ icon: "success", title, text, confirmButtonText: "Entendido" });
}

export function confirmDestructive({
  title,
  text,
  confirmButtonText = "Continuar",
  cancelButtonText = "Cancelar",
}) {
  return showConfirmation({
    title,
    text,
    icon: "warning",
    confirmButtonText,
    cancelButtonText,
  });
}

export function confirmExamSubmission({ answeredCount, totalCount }) {
  return showConfirmation({
    title: "¿Enviar tus respuestas?",
    text: `Respondiste ${answeredCount} de ${totalCount} preguntas. Al enviar, tus respuestas quedarán bloqueadas y no podrás modificarlas.`,
    icon: "warning",
    confirmButtonText: "Confirmar envío",
    cancelButtonText: "Seguir revisando",
  });
}

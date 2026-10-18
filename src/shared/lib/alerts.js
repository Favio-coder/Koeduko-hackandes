/**
 * Alertas — diálogos de SweetAlert2 con el estilo visual del sistema.
 *
 * Todo diálogo de la aplicación pasa por aquí para que las confirmaciones,
 * avisos y errores se vean iguales y tengan el mismo comportamiento:
 *
 * - `buttonsStyling: false` + `alerts.css`: los botones usan los tokens de
 *   `ui/Button.jsx` (marca, peligro, secundario) en lugar del azul por defecto.
 * - Un tono por diálogo (`danger`, `warning`, `info`, `success`, `primary`) que
 *   tiñe la franja superior y el icono.
 * - Lista con viñetas (`bulletList`) cuando hay varios mensajes.
 * - Cancelar nunca es la opción por defecto: `Esc`, clic fuera y «Cancelar»
 *   equivalen a `false`, así que el resultado se lee como un booleano.
 *
 * Ejemplos:
 *   await showConfirmation({ title: "Publicar", text: "¿Continuar?" });
 *   await confirmDestructive({ title: "Eliminar", text: "No se puede deshacer." });
 *   showError("No se pudo guardar la evaluación");
 *   showWarning({ html: bulletList(["Falta el título", "Falta el área"]) }, "Completa este paso");
 */
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import "./alerts.css";

/** Botones disponibles: espejo de las variantes de `ui/Button.jsx`. */
const BUTTON_VARIANTS = new Set([
  "primary",
  "danger",
  "warning",
  "info",
  "secondary",
  "ghost",
]);

/** Tono del diálogo → variante de su botón principal. */
const TONE_BUTTON = {
  primary: "primary",
  danger: "danger",
  warning: "warning",
  info: "info",
  success: "primary",
};

/** Icono por tono (SweetAlert2 solo conoce estos cuatro). */
const TONE_ICON = {
  primary: "question",
  danger: "warning",
  warning: "warning",
  info: "info",
  success: "success",
};

const buttonClass = (variant) =>
  `koeduko-swal__btn koeduko-swal__btn--${
    BUTTON_VARIANTS.has(variant) ? variant : "primary"
  }`;

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

/**
 * Lista con viñetas para diálogos con varios mensajes.
 * @param {string[]} messages
 * @returns {string} HTML listo para la opción `html` de SweetAlert2.
 */
export function bulletList(messages) {
  if (!messages?.length) return "";
  return `<ul class="koeduko-swal__list">${messages
    .filter(Boolean)
    .map((message) => `<li>${escapeHtml(message)}</li>`)
    .join("")}</ul>`;
}

/** Marca el contenedor del diálogo para aplicar el desenfoque del fondo. */
function markBackdrop(popup) {
  popup?.parentElement?.classList.add("koeduko-swal-backdrop");
}

/**
 * Acepta un mensaje como texto plano o como `{ text, html }` cuando el
 * diálogo necesita formato (listas, énfasis).
 */
function normalizeMessage(message) {
  return message && typeof message === "object"
    ? { text: message.text, html: message.html }
    : { text: message };
}

function fire({
  tone = "primary",
  variant,
  cancelVariant = "secondary",
  showCloseButton = false,
  ...options
}) {
  /* SweetAlert2 prioriza `html` sobre `text`: si hay HTML, `text` estorba. */
  const text = options.html ? undefined : options.text;
  return Swal.fire({
    /* Sin estilado nativo: los botones se pintan en `alerts.css`. */
    buttonsStyling: false,
    backdrop: "rgba(38, 61, 72, 0.45)",
    icon: TONE_ICON[tone],
    customClass: {
      popup: `koeduko-swal koeduko-swal--${tone}`,
      confirmButton: buttonClass(variant ?? TONE_BUTTON[tone]),
      cancelButton: buttonClass(cancelVariant),
      denyButton: buttonClass("secondary"),
    },
    showClass: {
      popup: "koeduko-swal--animate-in",
      backdrop: "koeduko-swal--backdrop-in",
    },
    hideClass: {
      popup: "koeduko-swal--animate-out",
      backdrop: "koeduko-swal--backdrop-out",
    },
    showCloseButton,
    /* Devuelve el foco al elemento que abrió el diálogo. */
    returnFocus: true,
    ...options,
    text,
    willOpen: (popup) => {
      markBackdrop(popup);
      options.willOpen?.(popup);
    },
  });
}

/**
 * Confirmación de dos botones. Devuelve `true` solo si se confirma.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.text]  mensaje breve; `html` tiene prioridad.
 * @param {string} [options.html]   contenido con formato (ver `bulletList`).
 * @param {'question'|'warning'|'info'|'success'|'error'} [options.icon]
 * @param {'primary'|'danger'|'warning'|'info'|'secondary'|'ghost'} [options.variant]
 * @param {'secondary'|'ghost'} [options.cancelVariant]
 * @param {string} [options.confirmButtonText]
 * @param {string} [options.cancelButtonText]
 */
export function showConfirmation({
  title,
  text,
  html,
  icon,
  variant,
  confirmButtonText = "Confirmar",
  cancelButtonText = "Cancelar",
  ...options
}) {
  return fire({
    title,
    text,
    html,
    icon,
    variant,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    ...options,
  }).then(({ isConfirmed }) => isConfirmed);
}

/**
 * Confirmación de una acción irreversible: botón principal en rojo.
 * @param {object} options Igual que `showConfirmation`, sin `icon` ni `variant`.
 */
export function confirmDestructive({
  title,
  text,
  html,
  confirmButtonText = "Continuar",
  cancelButtonText = "Cancelar",
  ...options
}) {
  return showConfirmation({
    title,
    text,
    html,
    icon: "warning",
    variant: "danger",
    confirmButtonText,
    cancelButtonText,
    ...options,
  });
}

/**
 * Diálogo informativo de un solo botón.
 * @param {string|{text?: string, html?: string}} message
 * @param {string} title
 * @param {object} [options] opciones extra de SweetAlert2 (`confirmButtonText`, …).
 */
function notify(tone, icon, confirmButtonText, message, title, options) {
  return fire({
    ...options,
    tone,
    icon: options.icon ?? icon,
    title,
    ...normalizeMessage(message),
    confirmButtonText: options.confirmButtonText ?? confirmButtonText,
  });
}

export function showError(message, title = "No se pudo completar la operación", options = {}) {
  return notify("danger", "error", "Entendido", message, title, options);
}

export function showWarning(message, title = "Atención", options = {}) {
  return notify("warning", "warning", "Entendido", message, title, options);
}

export function showSuccess(message, title = "Operación completada", options = {}) {
  return notify("success", "success", "Listo", message, title, options);
}

export function showInfo(message, title = "Información", options = {}) {
  return notify("info", "info", "Entendido", message, title, options);
}

export function confirmExamSubmission({ answeredCount, totalCount }) {
  const missing = totalCount - answeredCount;
  return showConfirmation({
    title: "¿Enviar tus respuestas?",
    text: `Respondiste ${answeredCount} de ${totalCount} preguntas. Al enviar, tus respuestas quedarán bloqueadas y no podrás modificarlas.`,
    /* Solo cuando falta algo: la lista detalla mejor qué revisar. */
    html: missing
      ? bulletList([
          `Respondiste ${answeredCount} de ${totalCount} preguntas`,
          `Quedan ${missing} ${missing === 1 ? "pregunta sin responder" : "preguntas sin responder"}`,
          "Después del envío no podrás modificar tus respuestas",
        ])
      : undefined,
    icon: "warning",
    variant: "warning",
    confirmButtonText: "Confirmar envío",
    cancelButtonText: "Seguir revisando",
  });
}

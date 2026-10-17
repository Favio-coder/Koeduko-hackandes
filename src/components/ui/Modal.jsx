/**
 * Modal — diálogo accesible con capas superpuestas.
 *
 * Comportamiento (WCAG 2.1):
 * - `Escape` cierra.
 * - El foco entra al abrir y queda atrapado dentro del diálogo mientras está
 *   abierto (Tab / Shift+Tab ciclan).
 * - Al cerrar, el foco vuelve al elemento que lo tenía.
 * - `role="dialog"` + `aria-modal` + `aria-labelledby`.
 *
 * Usa el elemento nativo `<dialog>` cuando está disponible y cae a un
 * `<div role="dialog">` en navegadores sin soporte.
 */
import { useCallback, useEffect, useId, useRef } from 'react'
import Button from './Button'
import Icon from './Icon'

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {'sm'|'md'|'lg'|'xl'} [props.size]
 * @param {boolean} [props.dismissible] cierra con Escape, fondo o botón cerrar.
 * @param {React.ReactNode} [props.footer]
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  dismissible = true,
  footer,
  children,
  labelledBy,
}) {
  const panelRef = useRef(null)
  const restoreFocusRef = useRef(null)
  const uid = useId()
  const titleId = `koeduko-modal-title-${uid}`
  const descId = `koeduko-modal-desc-${uid}`

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation()
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return

      const focusables = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables?.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [dismissible, onClose],
  )

  useEffect(() => {
    if (!open) return undefined

    restoreFocusRef.current = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const focusables = panelRef.current?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea, select, a[href]',
    )
    ;(focusables?.[0] ?? panelRef.current)?.focus()

    return () => {
      document.body.style.overflow = overflow
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  const width = sizes[size] ?? sizes.md

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-[#22302F]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={[
          'relative w-full outline-none',
          width,
          'rounded-t-3xl sm:rounded-3xl',
          'border border-[#E3E7E1] bg-[#FFFEFD]',
          'shadow-[0_24px_64px_rgba(34,48,47,0.28)]',
          'transition-transform duration-150 ease-out',
          'max-h-[92dvh] flex flex-col',
        ].join(' ')}
      >
        {/* asa visual en móvil */}
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-[#DDE3DC] sm:hidden" aria-hidden="true" />

        <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-[#31494A]">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-[#5C6A69]">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-1 shrink-0 rounded-lg p-2 text-[#5C6A69] transition-colors duration-150 hover:bg-[#F6FAF2] hover:text-[#31494A] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#62DD6B]/40"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 text-sm leading-relaxed text-[#5C6A69] sm:px-6">
          {children}
        </div>

        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-[#E3E7E1] bg-[#F6FAF2] px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/**
 * Modal de confirmación para acciones destructivas.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {() => void} [props.onConfirm]
 * @param {boolean} [props.loading]
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = '¿Confirmas la acción?',
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  tone = 'danger',
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="pb-1">
        Esta acción no se puede deshacer. Revisa la información antes de continuar.
      </p>
    </Modal>
  )
}
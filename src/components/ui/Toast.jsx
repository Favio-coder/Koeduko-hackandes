/**
 * Toast — notificaciones efímeras.
 *
 * `ToastProvider` expone el hook `useToast()` (en `@/components/ui/useToast`)
 * con `toast.success(...)`, `toast.error(...)` y compañía. El proveedor no
 * necesita props desde los consumidores.
 *
 * Accesibilidad: la región tiene `aria-live="polite"`; los errores usan
 * `role="alert"` para ser interruptivos.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import Button from './Button'
import Icon from './Icon'
import { ToastContext } from './toastContext'

const toneStyles = {
  success: 'border-[#B6E9AE] bg-[#E8F8E4] text-[#2F7F3C]',
  error: 'border-[#F0BEBE] bg-[#FCEDED] text-[#9B2C2C]',
  warning: 'border-[#F0DBAB] bg-[#FDF5E4] text-[#8A6410]',
  info: 'border-[#BBDDE3] bg-[#E7F3F5] text-[#215B66]',
}

const toneIcons = { success: 'check', error: 'alert', warning: 'alert', info: 'info' }

const DEFAULT_DURATION = 4200

/**
 * @param {object} props
 * @param {number} [props.duration] ms hasta el cierre automático (0 = manual).
 * @param {number} [props.max] cantidad máxima de toasts visibles a la vez.
 */
export function ToastProvider({ children, duration = DEFAULT_DURATION, max = 4 }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone, message, opts = {}) => {
      idRef.current += 1
      const id = idRef.current
      const life = opts.duration ?? duration
      setToasts((list) => [...list, { id, tone, message, ...opts }].slice(-max))
      if (life > 0) setTimeout(() => dismiss(id), life)
    },
    [dismiss, duration, max],
  )

  const toast = useMemo(
    () => ({
      success: (message, opts) => push('success', message, opts),
      error: (message, opts) => push('error', message, opts),
      warning: (message, opts) => push('warning', message, opts),
      info: (message, opts) => push('info', message, opts),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end"
        aria-live="polite"
        aria-label="Notificaciones"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={[
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border',
              'px-4 py-3.5 shadow-[0_12px_32px_rgba(49,73,74,0.18)]',
              'transition-[transform,opacity] duration-200 ease-out',
              toneStyles[t.tone] ?? toneStyles.info,
            ].join(' ')}
          >
            <Icon name={toneIcons[t.tone] ?? 'info'} className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 text-sm font-medium">{t.message}</div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Cerrar notificación"
              onClick={() => dismiss(t.id)}
              className="-mr-2 -mt-1 h-8 w-8 shrink-0 px-0 text-current hover:bg-black/5"
            >
              <Icon name="close" className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

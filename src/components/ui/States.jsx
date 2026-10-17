/**
 * Estados — carga, error y vacío.
 *
 * Mantienen la API del diseño anterior (`label`, `error`, `onRetry`, `title`,
 * `description`, `action`) y agregan `variant`, `compact` e iconos por defecto
 * coherentes con la marca.
 */
import { useState } from 'react'
import Button from './Button'
import Icon from './Icon'

/* -------------------------------------------------------------------------- */
/* Spinner                                                                     */
/* -------------------------------------------------------------------------- */

const spinnerSizes = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-[3px]' }
const spinnerColors = {
  brand: 'border-[#4CDB59] border-t-transparent',
  forest: 'border-[#304744] border-t-transparent',
  current: 'border-current border-t-transparent',
}

/**
 * @param {object} props
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {'brand'|'forest'|'current'} [props.tone] `current` para botones.
 * @param {string} [props.label] si se omite, el spinner es decorativo y quien
 *   anuncia el estado es el contenedor (p. ej. `LoadingState`).
 */
export function Spinner({ size = 'md', tone = 'brand', label, className = '' }) {
  return (
    <span
      className={[
        'inline-block shrink-0 animate-spin rounded-full',
        spinnerSizes[size] ?? spinnerSizes.md,
        spinnerColors[tone] ?? spinnerColors.brand,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Bloque de carga con animación de pulso. Para listas y tarjetas mientras
 * llegan los datos (evita saltos de layout frente a un spinner centrado).
 */
export function Skeleton({ className = '', rounded = 'md' }) {
  const shapes = { sm: 'rounded-md', md: 'rounded-lg', lg: 'rounded-2xl', pill: 'rounded-full' }
  return (
    <div
      aria-hidden="true"
      className={[
        'animate-pulse bg-[#EAEEE7]',
        shapes[rounded] ?? shapes.md,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}

/** Skeleton compuesto: avatar + dos líneas de texto. */
export function SkeletonRow({ className = '' }) {
  return (
    <div className={['flex items-center gap-3', className].filter(Boolean).join(' ')}>
      <Skeleton className="h-10 w-10 shrink-0" rounded="pill" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}

/** Reproduce la animación de marca y conserva un fallback accesible/estático. */
export function LoadingAnimation({ className = '', fallbackSize = 'md' }) {
  const [videoUnavailable, setVideoUnavailable] = useState(false)

  return (
    <span
      className={['relative inline-flex shrink-0 items-center justify-center', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <video
        src="/carga/carga.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        onError={() => setVideoUnavailable(true)}
        className={[
          'h-full w-full object-contain',
          'motion-reduce:hidden',
          videoUnavailable ? 'hidden' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
      <Icon
        name="koala"
        className={[
          'h-10 w-10 text-[#304744]',
          fallbackSize === 'lg' && 'h-14 w-14',
          videoUnavailable ? 'inline-block' : 'hidden motion-reduce:inline-block',
        ].join(' ')}
      />
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* LoadingState                                                                */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} props
 * @param {string} [props.label]
 * @param {boolean} [props.compact] usa una etiqueta más compacta.
 * @param {boolean} [props.inline] renderiza dentro del flujo en vez de como overlay.
 */
export function LoadingState({ label = 'Cargando…', compact = false, inline = false, className = '' }) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-[#304744]',
        inline
          ? ['w-full gap-3', compact ? 'py-6' : 'py-16'].join(' ')
          : 'fixed inset-0 z-[100] gap-3 bg-[#F8FAF6]/75 px-5 py-8 text-center backdrop-blur-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingAnimation
        className={inline ? 'h-12 w-12' : 'h-40 w-40 sm:h-56 sm:w-56'}
        fallbackSize={inline ? 'sm' : 'lg'}
      />
      <p className={compact ? 'text-sm font-semibold' : 'text-base font-semibold'}>{label}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* ErrorState                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} props
 * @param {Error|string} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {string} [props.title]
 * @param {boolean} [props.compact]
 */
export function ErrorState({
  error,
  onRetry,
  title = 'No se pudo completar la operación',
  compact = false,
  className = '',
}) {
  const message =
    typeof error === 'string' ? error : error?.message || 'Ocurrió un error inesperado.'
  return (
    <div
      className={[
        'rounded-2xl border border-[#F0BEBE] bg-[#FCEDED]',
        compact ? 'p-4' : 'p-6',
        'text-center',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="alert"
    >
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#F6D6D6] text-[#9B2C2C]">
        <Icon name="alert" className="h-6 w-6" />
      </span>
      <p className="text-sm font-bold text-[#9B2C2C]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#B4544E]">{message}</p>
      {onRetry && (
        <Button variant="dangerSoft" size="sm" icon="refresh" onClick={onRetry} className="mt-4">
          Reintentar
        </Button>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* EmptyState                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.action]
 * @param {string} [props.icon] nombre de un icono de `Icon`.
 * @param {boolean} [props.compact]
 */
export function EmptyState({
  title = 'Sin datos',
  description,
  action,
  icon = 'sparkles',
  compact = false,
  className = '',
}) {
  return (
    <div
      className={[
        'rounded-2xl border-2 border-dashed border-[#ABB1AB]/45 bg-[#F8FAF6]',
        compact ? 'px-5 py-8' : 'px-6 py-14',
        'text-center',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E9F8EA] text-[#2A7A35]">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="text-sm font-bold text-[#304744]">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-[#5A6B6A]">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  )
}
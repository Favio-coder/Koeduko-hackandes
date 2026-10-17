/**
 * Card / Badge / ProgressBar — superficies y comunicadores de estado.
 *
 * Todos aceptan `className` para ajustes puntuales y respetan el orden de
 * utilidades de Tailwind (el `className` del consumidor gana).
 */
import Icon from './Icon'

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

const cardVariants = {
  /** Superficie estándar sobre el fondo de página. */
  default: 'bg-[#FFFEFD] border-[#E3E7E1] shadow-[0_1px_3px_rgba(49,73,74,0.08),0_1px_2px_rgba(49,73,74,0.04)]',
  /** Sin relieve, para listas densas. */
  flat: 'bg-[#FFFEFD] border-[#E3E7E1] shadow-none',
  /** Zona de acento o estado positivo. */
  accent: 'bg-[#E8F8E4] border-[#B6E9AE] shadow-none',
  /** Superficie hundida, para código o datos. */
  sunken: 'bg-[#F6FAF2] border-[#E3E7E1] shadow-none',
}

const cardPadding = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }

/**
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.actions]  slot a la derecha del encabezado.
 * @param {'default'|'flat'|'accent'|'sunken'} [props.variant]
 * @param {'none'|'sm'|'md'|'lg'} [props.padding]
 * @param {boolean} [props.interactive] añade elevación y foco al hacer hover.
 */
export function Card({
  title,
  description,
  actions,
  variant = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...props
}) {
  return (
    <section
      className={[
        'rounded-2xl border',
        cardVariants[variant] ?? cardVariants.default,
        cardPadding[padding] ?? cardPadding.md,
        interactive &&
          'transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#B6E9AE] hover:shadow-[0_12px_32px_rgba(49,73,74,0.14)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {(title || description || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-bold tracking-tight text-[#31494A]">{title}</h2>
            )}
            {description && <p className="mt-1 text-sm text-[#5C6A69]">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/** Alias semántico: usar cuando la tarjeta sea clicable (link o botón). */
export function CardLink({ to, children, className = '', ...props }) {
  return (
    <a
      href={to}
      className={[
        'block rounded-2xl border border-[#E3E7E1] bg-[#FFFEFD]',
        'shadow-[0_1px_3px_rgba(49,73,74,0.08),0_1px_2px_rgba(49,73,74,0.04)]',
        'transition-[box-shadow,transform,border-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-[#B6E9AE] hover:shadow-[0_12px_32px_rgba(49,73,74,0.14)]',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#62DD6B]/45',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </a>
  )
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

const badgeTones = {
  /* marca */
  brand: 'bg-[#E8F8E4] text-[#2F7F3C] ring-[#B6E9AE]',
  forest: 'bg-[#31494A] text-white ring-[#31494A]',
  /* semánticos */
  success: 'bg-[#E8F8E4] text-[#2F7F3C] ring-[#B6E9AE]',
  warning: 'bg-[#FDF5E4] text-[#8A6410] ring-[#F0DBAB]',
  danger: 'bg-[#FCEDED] text-[#9B2C2C] ring-[#F0BEBE]',
  info: 'bg-[#E7F3F5] text-[#215B66] ring-[#BBDDE3]',
  /* neutros */
  neutral: 'bg-[#F6FAF2] text-[#5C6A69] ring-[#E3E7E1]',
  outline: 'bg-transparent text-[#5C6A69] ring-[#ABB1AB]',
}

/** Alias heredados del diseño anterior, para no romper código existente. */
const legacyTones = {
  slate: 'neutral',
  indigo: 'brand',
  green: 'success',
  amber: 'warning',
  red: 'danger',
}

const badgeSizes = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-0.5 text-xs gap-1.5',
}

/**
 * @param {object} props
 * @param {string} [props.tone] ver `badgeTones` (+ alias legacy).
 * @param {'sm'|'md'} [props.size]
 * @param {string} [props.icon]
 * @param {boolean} [props.dot] punto de estado a la izquierda.
 */
export function Badge({ children, tone = 'neutral', size = 'md', icon, dot = false, className = '', ...props }) {
  const resolved = badgeTones[legacyTones[tone] ?? tone] ?? badgeTones.neutral
  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-semibold ring-1 ring-inset',
        badgeSizes[size] ?? badgeSizes.md,
        resolved,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {icon && !dot && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* ProgressBar                                                                 */
/* -------------------------------------------------------------------------- */

const progressTones = {
  brand: 'bg-[#62DD6B]',
  forest: 'bg-[#31494A]',
  warning: 'bg-[#E8B33C]',
  danger: 'bg-[#D64545]',
  info: 'bg-[#2F7F8F]',
}

/**
 * Barra de progreso accesible.
 *
 * @param {number} value  0–1 (se recorta fuera de rango).
 * @param {string} [props.tone]
 * @param {'sm'|'md'} [props.size]
 * @param {string} [props.label]
 * @param {string} [props.valueLabel] texto a la derecha; por defecto el porcentaje.
 */
export function ProgressBar({ value = 0, tone = 'brand', size = 'md', label, valueLabel, className = '', ...props }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className={className} {...props}>
      {(label || valueLabel !== undefined) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && <span className="text-xs font-medium text-[#5C6A69]">{label}</span>}
          <span className="text-xs font-semibold tabular-nums text-[#31494A]">
            {valueLabel ?? `${pct}%`}
          </span>
        </div>
      )}
      <div
        className={[
          'w-full overflow-hidden rounded-full bg-[#E3E7E1]',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        ].join(' ')}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || undefined}
      >
        <div
          className={[
            'h-full rounded-full transition-[width] duration-500 ease-out',
            progressTones[tone] ?? progressTones.brand,
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
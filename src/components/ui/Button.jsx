/**
 * Button — acción principal del sistema.
 *
 * Polimórfico: renderiza `<button>`, o un `<Link>` de react-router si se pasa
 * `to`, o el elemento indicado en `as`.
 *
 * Variantes: primary · secondary · ghost · subtle · danger · dangerSoft
 * Tamaños:  sm · md · lg
 *
 * Accesibilidad:
 * - El foco visible se aplica con `focus-visible` (teclado, no ratón).
 * - `loading` mantiene el botón en el árbol con `aria-busy` y ancho estable
 *   para evitar saltos de layout.
 *
 * @example
 * <Button onClick={save}>Guardar</Button>
 * <Button to="/sessions" variant="secondary">Ver sesiones</Button>
 * <Button loading={saving}>Guardando…</Button>
 */
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { LoadingAnimation } from './States'

const variants = {
  primary:
    'bg-[#4CDB59] text-[#263D48] hover:bg-[#3FC94D] active:bg-[#35B645] shadow-[0_1px_2px_rgba(48,71,68,0.10)]',
  secondary:
    'bg-[#FFFFFF] text-[#304744] border border-[#ABB1AB]/60 hover:bg-[#F8FAF6] hover:border-[#4CDB59] active:bg-[#EDF5E9]',
  ghost: 'bg-transparent text-[#304744] hover:bg-[#F8FAF6] active:bg-[#E9F8EA]',
  subtle: 'bg-[#E9F8EA] text-[#2A7A35] hover:bg-[#DDF3DD] active:bg-[#D3F0CF]',
  danger: 'bg-[#D64545] text-white hover:bg-[#BC3A3A] active:bg-[#A53232]',
  dangerSoft: 'bg-[#FCEDED] text-[#9B2C2C] border border-[#F0BEBE] hover:bg-[#F8DFDF]',
}

const sizes = {
  sm: 'h-8 gap-1.5 px-3 text-xs rounded-lg',
  md: 'h-10 gap-2 px-4 text-sm rounded-xl',
  lg: 'h-12 gap-2 px-6 text-base rounded-2xl',
}

const iconSizes = { sm: 'h-4 w-4', md: 'h-4 w-4', lg: 'h-5 w-5' }

const disabledStyles = 'cursor-not-allowed opacity-55 shadow-none'

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'subtle'|'danger'|'dangerSoft'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.loading]
 * @param {string} [props.to]  renderiza un `<Link>` de react-router.
 * @param {string} [props.as]  elemento a renderizar (por defecto `button`).
 * @param {'left'|'right'} [props.iconPosition]
 * @param {string} [props.icon] nombre de `Icon`.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  to,
  as,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  children,
  disabled,
  type,
  ...props
}) {
  const isDisabled = Boolean(disabled) || loading

  const classes = [
    'inline-flex items-center justify-center font-semibold whitespace-nowrap',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8FAF6]',
    'disabled:pointer-events-none',
    sizes[size],
    variants[variant] ?? variants.primary,
    isDisabled && disabledStyles,
    fullWidth && 'w-full',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {loading ? (
        <LoadingAnimation className="h-5 w-5" fallbackSize="sm" />
      ) : (
        icon &&
        iconPosition === 'left' && <Icon name={icon} className={`shrink-0 ${iconSizes[size]}`} />
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <Icon name={icon} className={`shrink-0 ${iconSizes[size]}`} />
      )}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} aria-disabled={isDisabled || undefined} {...props}>
        {content}
      </Link>
    )
  }

  const Component = as || 'button'
  return (
    <Component
      className={classes}
      type={Component === 'button' ? type ?? 'button' : undefined}
      disabled={Component === 'button' ? isDisabled : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </Component>
  )
}
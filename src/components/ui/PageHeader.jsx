/**
 * PageHeader y Breadcrumbs — encabezado de vista y ruta de navegación.
 *
 * pensados para que DEV 1 (dashboard), DEV 2 (matching) y DEV 3 (sesiones)
 * tengan una estructura visual idéntica sin reinventar el markup.
 */
import { Link } from 'react-router-dom'
import Icon from './Icon'

/**
 * @param {object} props
 * @param {string} [props.eyebrow]  texto sobreline superior.
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.badge]
 * @param {React.ReactNode} [props.actions]  slot de acciones (alineado a la derecha).
 */
export function PageHeader({ eyebrow, title, description, badge, actions, className = '' }) {
  return (
    <header
      className={[
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2F7F3C]">
            {eyebrow}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#31494A] sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-[#5C6A69]">{description}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </header>
  )
}

/**
 * @param {object} props
 * @param {Array<{label: string, to?: string}>} props.items
 *   El último elemento no debe traer `to` (representa la página actual).
 */
export function Breadcrumbs({ items = [], className = '' }) {
  if (!items.length) return null
  return (
    <nav aria-label="Ruta de navegación" className={['mb-3', className].filter(Boolean).join(' ')}>
      <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-[#5C6A69]">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-[#ABB1AB]" />}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="rounded transition-colors duration-150 hover:text-[#2F7F3C] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#62DD6B]/40"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-[#31494A]">
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * PageBody — contenedor estándar de contenido de una vista dentro del layout.
 * Unifica ancho máximo y padding responsive para todas las páginas.
 */
export function PageBody({ children, className = '' }) {
  return (
    <div className={['mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
/**
 * Icon — set SVG inline (sin dependencias externas).
 *
 * Todos los iconos son decorativos por defecto (`aria-hidden`). Si el icono es
 * la única representación de una acción, el botón debe llevar `aria-label`.
 *
 * @example <Icon name="home" className="h-5 w-5" />
 * @example <Icon name="plus" /> <span>Nueva sesión</span>
 */

import { paths } from './iconPaths'


/**
 * @param {object} props
 * @param {keyof typeof paths} props.name
 * @param {string} [props.className] tamaño y color (utilidades Tailwind).
 * @param {string} [props.title] si se pasa, el SVG deja de ser decorativo.
 */
export default function Icon({ name, className = 'h-5 w-5', title, ...props }) {
  const d = paths[name]
  if (!d) return null
  const decorative = title === undefined
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  )
}

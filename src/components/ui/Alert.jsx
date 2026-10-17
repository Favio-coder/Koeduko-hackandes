/**
 * Alert — mensaje contextual en línea (éxito, error, aviso, información).
 *
 * No reemplaza a `ErrorState`: sirve para confirmar acciones o advertir dentro
 * de un formulario o al tope de una vista.
 */
import Icon from './Icon'

const tones = {
  success: { wrap: 'border-[#B7E8B5] bg-[#E9F8EA] text-[#2A7A35]', icon: 'check' },
  error: { wrap: 'border-[#F0BEBE] bg-[#FCEDED] text-[#9B2C2C]', icon: 'alert' },
  warning: { wrap: 'border-[#F0DBAB] bg-[#FDF5E4] text-[#8A6410]', icon: 'alert' },
  info: { wrap: 'border-[#BBDDE3] bg-[#E7F3F5] text-[#215B66]', icon: 'info' },
}

const legacyTones = { red: 'error', amber: 'warning', green: 'success', indigo: 'info' }

/**
 * @param {object} props
 * @param {'success'|'error'|'warning'|'info'} [props.tone]
 * @param {string} [props.title]
 * @param {string} [props.icon] nombre de icono; `false` lo oculta.
 * @param {React.ReactNode} [props.action]
 * @param {boolean} [props.compact]
 */
export default function Alert({
  tone = 'info',
  title,
  description,
  children,
  icon,
  action,
  compact = false,
  role,
  className = '',
}) {
  const resolved = tones[legacyTones[tone] ?? tone] ?? tones.info
  const showIcon = icon === false ? false : icon ?? resolved.icon
  const alertRole = role ?? (tone === 'error' ? 'alert' : 'status')

  return (
    <div
      className={[
        'flex items-start gap-3 rounded-2xl border',
        compact ? 'px-3.5 py-3' : 'px-4 py-4',
        resolved.wrap,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role={alertRole}
    >
      {showIcon && (
        <span className="mt-0.5 shrink-0">
          <Icon name={showIcon} className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-bold">{title}</p>}
        {(description || children) && (
          <div className={['text-sm', title ? 'mt-0.5' : ''].filter(Boolean).join(' ')}>
            {description}
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
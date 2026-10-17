/**
 * Campo de formulario (input, textarea y select) con etiqueta, ayuda, error y
 * estados de carga. Tres componentes separados en un mismo archivo porque
 * comparten toda la lógica de envoltura.
 *
 * Accesibilidad:
 * - El `<label>` siempre está asociado por id (o por `aria-label` si no hay
 *   etiqueta visible).
 * - El error se anuncia con `aria-invalid` + `aria-describedby` y rol `alert`.
 * - El estado de carga usa `aria-busy` en el control.
 */
import { useId } from 'react'
import Icon from './Icon'
import { LoadingAnimation } from './States'

const controlBase = [
  'w-full rounded-xl border bg-[#FFFFFF] text-sm text-[#304744] placeholder:text-[#7D8C8A]',
  'transition-[background-color,border-color,box-shadow] duration-150 ease-out',
  'focus:outline-none focus:ring-[3px] focus:ring-[#4CDB59]/40',
  'disabled:cursor-not-allowed disabled:bg-[#F8FAF6] disabled:text-[#7D8C8A]',
].join(' ')

const toneClasses = {
  default: 'border-[#ABB1AB]/60 focus:border-[#4CDB59]',
  error: 'border-[#D64545] focus:border-[#D64545] focus:ring-[#D64545]/25',
}

function FieldShell({ id, label, hint, error, required, children, className = '', labelRight }) {
  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      {(label || labelRight) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={id} className="text-sm font-semibold text-[#304744]">
              {label}
              {required && (
                <span className="ml-0.5 text-[#D64545]" aria-hidden="true">
                  *
                </span>
              )}
            </label>
          )}
          {labelRight}
        </div>
      )}
      {children}
      <div className="mt-1.5 flex items-start justify-between gap-3">
        {error ? (
          <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-xs font-medium text-[#9B2C2C]">
            <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : (
          hint && <p id={`${id}-hint`} className="text-xs text-[#5A6B6A]">{hint}</p>
        )}
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {string} [props.label]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {string} [props.icon]  ícono a la izquierda.
 * @param {boolean} [props.loading]
 * @param {React.ReactNode} [props.labelRight]
 */
export function Input({
  label,
  hint,
  error,
  required = false,
  icon,
  loading = false,
  labelRight,
  className = '',
  containerClassName = '',
  id: idProp,
  ...props
}) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      labelRight={labelRight}
      className={containerClassName}
    >
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7D8C8A]">
            <Icon name={icon} className="h-4.5 w-4.5" />
          </span>
        )}
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-busy={loading || undefined}
          className={[
            controlBase,
            toneClasses[error ? 'error' : 'default'],
            'h-11',
            icon && 'pl-10',
            loading && 'pr-10',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <LoadingAnimation className="h-5 w-5" fallbackSize="sm" />
          </span>
        )}
      </div>
    </FieldShell>
  )
}

/** Igual que `Input`, multilínea. */
export function Textarea({
  label,
  hint,
  error,
  required = false,
  labelRight,
  rows = 4,
  className = '',
  containerClassName = '',
  id: idProp,
  ...props
}) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      labelRight={labelRight}
      className={containerClassName}
    >
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={[controlBase, toneClasses[error ? 'error' : 'default'], 'resize-y py-2.5 leading-relaxed', className]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    </FieldShell>
  )
}

/**
 * Select con chevron propio.
 *
 * @param {object} props
 * @param {Array<{value: string, label: string, disabled?: boolean}>} [props.options]
 */
export function Select({
  label,
  hint,
  error,
  required = false,
  labelRight,
  options,
  children,
  className = '',
  containerClassName = '',
  id: idProp,
  ...props
}) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      labelRight={labelRight}
      className={containerClassName}
    >
      <div className="relative">
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={[
            controlBase,
            toneClasses[error ? 'error' : 'default'],
            'h-11 cursor-pointer appearance-none pr-10',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6B6A]">
          <Icon name="chevronDown" className="h-4 w-4" />
        </span>
      </div>
    </FieldShell>
  )
}

/** Casilla de verificación y radio accesibles (sin dependencia extra). */
export function Checkbox({ label, description, className = '', id: idProp, ...props }) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <label
      htmlFor={id}
      className={[
        'flex cursor-pointer items-start gap-2.5 text-sm text-[#304744]',
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer appearance-none rounded border border-[#ABB1AB] bg-[#FFFFFF] transition-colors duration-150 checked:border-[#4CDB59] checked:bg-[#4CDB59] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/40 checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23263D48%22 stroke-width=%223.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m5 12.5 4.5 4.5L19 7.5%22/></svg>')] checked:bg-[length:75%] checked:bg-center checked:bg-no-repeat disabled:cursor-not-allowed"
        {...props}
      />
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-[#5A6B6A]">{description}</span>}
      </span>
    </label>
  )
}

/** Grupo de botones radio. */
export function RadioGroup({ label, name, options = [], value, onChange, className = '' }) {
  return (
    <fieldset className={className}>
      {label && (
        <legend className="mb-1.5 text-sm font-semibold text-[#304744]">{label}</legend>
      )}
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2.5 text-sm text-[#304744]"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange?.(o.value)}
              className="h-4.5 w-4.5 shrink-0 cursor-pointer accent-[#4CDB59]"
            />
            <span className="font-medium">{o.label}</span>
            {o.hint && <span className="text-xs text-[#5A6B6A]">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
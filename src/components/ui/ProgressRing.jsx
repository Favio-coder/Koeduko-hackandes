/**
 * ProgressRing — indicador circular de progreso.
 *
 * Complementa a `ProgressBar` cuando el dato es una cifra de juego (nivel, XP,
 * dominio alcanzado): el aro hace legible el progreso de un vistazo y admite
 * contenido central (cifra grande + etiqueta).
 *
 * Accesibilidad: el rol es `progressbar` con `aria-valuenow/min/max` y
 * `aria-label`, de modo que el texto del centro sea decorativo para el lector
 * de pantalla y no se duplique la lectura.
 */
const tones = {
  brand: { stroke: '#4CDB59', track: '#D8EFDA' },
  forest: { stroke: '#304744', track: '#DCE5DC' },
  info: { stroke: '#1D63D6', track: '#D6E3FA' },
  warning: { stroke: '#E8B33C', track: '#F6E7C4' },
  danger: { stroke: '#D64545', track: '#F5D3D3' },
}

const sizes = {
  sm: { box: 'h-14 w-14', width: 6, text: 'text-sm', sub: 'text-[9px]' },
  md: { box: 'h-20 w-20', width: 7, text: 'text-xl', sub: 'text-[10px]' },
  lg: { box: 'h-28 w-28', width: 9, text: 'text-3xl', sub: 'text-xs' },
}

const clamp = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

/**
 * @param {object} props
 * @param {number} props.value 0–1 (se recorta fuera de rango).
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {'brand'|'forest'|'info'|'warning'|'danger'} [props.tone]
 * @param {string} [props.label]  nombre accesible del indicador.
 * @param {string} [props.valueLabel]  texto principal del centro (ej. «72 %»).
 * @param {string} [props.caption]  texto secundario del centro.
 * @param {React.ReactNode} [props.children]  reemplaza el contenido del centro.
 * @param {boolean} [props.indeterminate]  dibuja el aro sin valor (carga).
 */
export default function ProgressRing({
  value = 0,
  size = 'md',
  tone = 'brand',
  label,
  valueLabel,
  caption,
  children,
  indeterminate = false,
  className = '',
  ...props
}) {
  const pct = clamp(value)
  const palette = tones[tone] ?? tones.brand
  const metrics = sizes[size] ?? sizes.md
  const radius = 42
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className={['relative inline-flex shrink-0 items-center justify-center', metrics.box, className]
        .filter(Boolean)
        .join(' ')}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      aria-valuetext={valueLabel || label}
      {...props}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={palette.track}
          strokeWidth={metrics.width}
        />
        {!indeterminate && pct > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={palette.stroke}
            strokeWidth={metrics.width}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
          />
        )}
      </svg>
      <span className="relative z-10 flex flex-col items-center leading-none">
        {children ?? (
          <>
            {valueLabel && (
              <span
                className={['font-extrabold tabular-nums text-[#263D48]', metrics.text]
                  .filter(Boolean)
                  .join(' ')}
              >
                {valueLabel}
              </span>
            )}
            {caption && (
              <span
                className={['mt-1 font-semibold uppercase tracking-wide text-[#5A6B6A]', metrics.sub]
                  .filter(Boolean)
                  .join(' ')}
              >
                {caption}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  )
}

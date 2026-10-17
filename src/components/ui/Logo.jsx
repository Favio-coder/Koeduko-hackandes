/**
 * Logo — reutiliza los recursos oficiales de `public/logo/`.
 *
 * No se generan logos nuevos ni se altera la mascota. Solo:
 * - `object-contain` para preservar la proporción (nada de deformación).
 * - Derivados **reducidos** de la misma imagen (`koeduko-128.png`,
 *   `koeduko-512.png`) porque el original pesa 1.6 MB y se pintaría en cada
 *   página. Los originales quedan intactos en `public/logo/`.
 * - Recorte del símbolo (cabeza del koala) por CSS, no por edición del archivo.
 *
 * Fuentes:
 * - `logoKoedukosinfondo.png` → zonas con transparencia (sidebar, navbar, login).
 * - `logoKoeduko.jpeg`        → piezas institucionales (portada, presentación).
 */
const SOURCES = {
  /** Transparente:koala + tipografía. */
  full: { src: '/logo/koeduko-512.png', w: 2000, h: 2000 },
  /** Transparente, versión ligera para espacios pequeños. */
  sm: { src: '/logo/koeduko-128.png', w: 2000, h: 2000 },
  /** Fondo blanco/marco: piezas institucionales. */
  box: { src: '/logo/logoKoeduko.jpeg', w: 494, h: 490 },
}

/** Alto del logo completo según el espacio disponible. */
const FULL_SIZES = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
  xl: 'h-20',
}

/** Lado del cuadro del símbolo (solo cabeza del koala). */
const MARK_SIZES = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
}

/**
 * @param {object} props
 * @param {'mark'|'full'} [props.variant] `mark` = símbolo, `full` = logo completo.
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.size]
 * @param {'full'|'sm'|'box'} [props.source]
 * @param {string} [props.alt]
 * @param {boolean} [props.onDark] ajusta el anillo de contraste en fondos oscuros.
 */
export default function Logo({
  variant = 'full',
  size = 'md',
  source,
  alt = 'KoEduko',
  onDark = false,
  className = '',
}) {
  const src = SOURCES[variant === 'mark' ? 'sm' : source ?? 'full'] ?? SOURCES.full

  if (variant === 'mark') {
    return (
      <span
        className={[
          MARK_SIZES[size] ?? MARK_SIZES.md,
          'relative inline-block shrink-0 overflow-hidden',
          onDark && 'rounded-xl bg-white/90 p-0.5 ring-1 ring-white/20',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <img
          src={src.src}
          alt={alt}
          width={src.w}
          height={src.h}
          decoding="async"
          className="absolute left-0 top-0 w-full origin-top scale-[1.45] object-contain"
        />
      </span>
    )
  }

  return (
    <img
      src={src.src}
      alt={alt}
      width={src.w}
      height={src.h}
      decoding="async"
      className={[
        FULL_SIZES[size] ?? FULL_SIZES.md,
        'w-auto shrink-0 object-contain',
        onDark && 'rounded-xl bg-white/90 p-1',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
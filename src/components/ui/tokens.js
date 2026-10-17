/**
 * KoEduko — Design Tokens
 * ---------------------------------------------------------------------------
 * Fuente única de verdad del sistema visual.
 *
 * IMPORTANTE (Tailwind CSS v4 sin archivo de configuración):
 * el escáner de Tailwind detecta clases literalmente escritas en el código.
 * Por eso aquí NO se interpolan valores (nada de `bg-[${color}]`): cada valor
 * es una clase arbitraria completa y estática. Si alguna vez se agrega una
 * clase de forma dinámica, debe escribirse completa en el componente o
 *registrada en el código para que Tailwind la genere.
 *
 * Cuando Tailwind admita `@theme` en CSS, este archivo puede migrarse 1:1.
 * Los valores hexadecimales de marca se exportan aparte (`palette`) para poder
 * usarlos en estilos inline inevitables (ej. `ProgressBar`, gráficos).
 */

/* -------------------------------------------------------------------------- */
/* Paleta de marca                                                            */
/* -------------------------------------------------------------------------- */

export const palette = {
  /** Verde bosque — texto principal, títulos, fondos oscuros. */
  forest: '#304744',
  /** Verde KoEduko (koala) — rellenos, acentos, acciones. */
  brand: '#4CDB59',
  /** Verde menta — superficies suaves, acentos y zonas de éxito. */
  mint: '#E9F8EA',
  /** Fondo principal de la aplicación. */
  canvas: '#F8FAF6',
  /** Blanco — superficie de tarjetas y paneles. */
  white: '#FFFFFF',
  /** Texto principal. */
  ink: '#263D48',
  /** Gris natural — bordes, metadatos, texto deshabilitado. */
  stone: '#ABB1AB',
}

/* -------------------------------------------------------------------------- */
/* Colores semánticos (clases Tailwind literales)                             */
/* -------------------------------------------------------------------------- */

export const colors = {
  /** Texto principal sobre fondo claro. */
  ink: 'text-[#304744]',
  inkStrong: 'text-[#263D48]',
  inkMuted: 'text-[#5A6B6A]',
  inkSubtle: 'text-[#7D8C8A]',

  /** Superficies. */
  surface: 'bg-white',
  surfaceSunken: 'bg-[#F8FAF6]',
  surfaceRaised: 'bg-white',

  /** Marca. */
  brand: 'bg-[#4CDB59]',
  brandHover: 'hover:bg-[#3FC94D]',
  brandActive: 'active:bg-[#35B645]',
  brandSoft: 'bg-[#E9F8EA]',
  brandSoftHover: 'hover:bg-[#DDF3DD]',
  brandBorder: 'border-[#B7E8B5]',
  brandText: 'text-[#2A7A35]',
  brandRing: 'ring-[#4CDB59]',

  /** Neutros. */
  line: 'border-[#E6EAE3]',
  lineStrong: 'border-[#ABB1AB]',
  stone: 'bg-[#ABB1AB]',

  /** Semánticos. */
  danger: 'bg-[#D64545]',
  dangerHover: 'hover:bg-[#BC3A3A]',
  dangerSoft: 'bg-[#FCEDED]',
  dangerBorder: 'border-[#F0BEBE]',
  dangerText: 'text-[#9B2C2C]',

  warning: 'bg-[#E8B33C]',
  warningSoft: 'bg-[#FDF5E4]',
  warningBorder: 'border-[#F0DBAB]',
  warningText: 'text-[#8A6410]',

  info: 'bg-[#2F7F8F]',
  infoSoft: 'bg-[#E7F3F5]',
  infoBorder: 'border-[#BBDDE3]',
  infoText: 'text-[#215B66]',
}

/* -------------------------------------------------------------------------- */
/* Tipografía                                                                 */
/* -------------------------------------------------------------------------- */

export const font = {
  /** Pila por defecto del proyecto (Tailwind `font-sans`). */
  sans: 'font-sans',
  /** Títulos / cifras destacadas: Nunito. */
  display: 'font-[Nunito,ui-sans-serif,system-ui,sans-serif]',
  mono: 'font-mono',
}

export const text = {
  display: 'text-3xl sm:text-4xl font-bold tracking-tight',
  title: 'text-xl sm:text-2xl font-bold tracking-tight',
  subtitle: 'text-base sm:text-lg font-semibold',
  body: 'text-sm leading-relaxed',
  label: 'text-sm font-medium',
  caption: 'text-xs',
  overline: 'text-[11px] font-semibold uppercase tracking-[0.14em]',
}

/* -------------------------------------------------------------------------- */
/* Radios, sombras, movimiento                                                */
/* -------------------------------------------------------------------------- */

export const radius = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  pill: 'rounded-full',
}

export const shadow = {
  xs: 'shadow-[0_1px_2px_rgba(48,71,68,0.06)]',
  sm: 'shadow-[0_1px_3px_rgba(48,71,68,0.08),0_1px_2px_rgba(48,71,68,0.04)]',
  md: 'shadow-[0_4px_14px_rgba(48,71,68,0.10)]',
  lg: 'shadow-[0_12px_32px_rgba(48,71,68,0.14)]',
  ring: 'ring-[3px] ring-[#4CDB59]/35',
}

export const motion = {
  fast: 'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out',
  base: 'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out',
  lift: 'hover:-translate-y-0.5',
  pop: 'active:translate-y-0',
}

/* -------------------------------------------------------------------------- */
/* Foco accesible (WCAG 2.4.7)                                                */
/* -------------------------------------------------------------------------- */

export const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFFFF]'

/* -------------------------------------------------------------------------- */
/* Mapas compuestos (los más usados)                                          */
/* -------------------------------------------------------------------------- */

/** Superficie base de cualquier bloque con relieve. */
export const surfaceCard =
  'rounded-2xl border border-[#E6EAE3] bg-[#FFFFFF] shadow-[0_1px_3px_rgba(48,71,68,0.08),0_1px_2px_rgba(48,71,68,0.04)]'

/** Anillo de foco para elementos interactivos sobre superficie clara. */
export const focusable = focusRing
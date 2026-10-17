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
  forest: '#31494A',
  /** Verde KoEduko (koala) — rellenos, acentos, acciones. */
  brand: '#62DD6B',
  /** Verde muy claro — fondo de página y zonas suaves. */
  mist: '#F6FAF2',
  /** Blanco cálido — superficie de tarjetas. */
  cream: '#FFFEFD',
  /** Gris natural — bordes, metadatos, texto deshabilitado. */
  stone: '#ABB1AB',
}

/* -------------------------------------------------------------------------- */
/* Colores semánticos (clases Tailwind literales)                             */
/* -------------------------------------------------------------------------- */

export const colors = {
  /** Texto principal sobre fondo claro. */
  ink: 'text-[#31494A]',
  inkStrong: 'text-[#22302F]',
  inkMuted: 'text-[#5C6A69]',
  inkSubtle: 'text-[#7C8A88]',

  /** Superficies. */
  surface: 'bg-[#FFFEFD]',
  surfaceSunken: 'bg-[#F6FAF2]',
  surfaceRaised: 'bg-white',

  /** Marca. */
  brand: 'bg-[#62DD6B]',
  brandHover: 'hover:bg-[#52C95E]',
  brandActive: 'active:bg-[#46B852]',
  brandSoft: 'bg-[#E8F8E4]',
  brandSoftHover: 'hover:bg-[#D9F4D2]',
  brandBorder: 'border-[#B6E9AE]',
  brandText: 'text-[#2F7F3C]',
  brandRing: 'ring-[#62DD6B]',

  /** Neutros. */
  line: 'border-[#E3E7E1]',
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
  xs: 'shadow-[0_1px_2px_rgba(49,73,74,0.06)]',
  sm: 'shadow-[0_1px_3px_rgba(49,73,74,0.08),0_1px_2px_rgba(49,73,74,0.04)]',
  md: 'shadow-[0_4px_14px_rgba(49,73,74,0.10)]',
  lg: 'shadow-[0_12px_32px_rgba(49,73,74,0.14)]',
  ring: 'ring-[3px] ring-[#62DD6B]/35',
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

export const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#62DD6B]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFEFD]'

/* -------------------------------------------------------------------------- */
/* Mapas compuestos (los más usados)                                          */
/* -------------------------------------------------------------------------- */

/** Superficie base de cualquier bloque con relieve. */
export const surfaceCard =
  'rounded-2xl border border-[#E3E7E1] bg-[#FFFEFD] shadow-[0_1px_3px_rgba(49,73,74,0.08),0_1px_2px_rgba(49,73,74,0.04)]'

/** Anillo de foco para elementos interactivos sobre superficie clara. */
export const focusable = focusRing
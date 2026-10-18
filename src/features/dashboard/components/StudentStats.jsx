/**
 * StudentStats — tarjetas de cifra del estudiante.
 *
 * Réplica responsive de las métricas ilustradas del panel docente, sin
 * ilustración: en gamificación la cifra manda y cuatro tarjetas caben en una
 * cuadrícula de dos columnas en móvil (una sola tarjeta de 32rem obligaría a
 * deslizar y escondería tres datos).
 */
import Icon from '@/components/ui/Icon'

const surfaces = [
  'bg-gradient-to-br from-[#F0FFF1] to-[#FFFFFF] border-[#D7EDD6]',
  'bg-gradient-to-br from-[#EFF7FF] to-[#FFFFFF] border-[#D8E8F8]',
  'bg-gradient-to-br from-[#FFF9E8] to-[#FFFFFF] border-[#F0E4B9]',
  'bg-gradient-to-br from-[#FDF2F7] to-[#FFFFFF] border-[#F3DCE8]',
]

const iconSurfaces = [
  'bg-[#E9F8EA] text-[#2A7A35]',
  'bg-[#E8F0FE] text-[#12459B]',
  'bg-[#FDF5E4] text-[#8A6410]',
  'bg-[#FCEDED] text-[#9B2C2C]',
]

export default function StudentStats({ stats = [] }) {
  return (
    <section aria-label="Tu resumen de progreso" className="min-w-0">
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <li key={stat.label} className="min-w-0">
            <article
              aria-label={`${stat.label}: ${stat.value}`}
              className={[
                'group relative flex h-full flex-col justify-between gap-3 overflow-hidden rounded-3xl border p-3.5 shadow-[0_6px_18px_rgba(48,71,68,0.08)] sm:p-4',
                'transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(48,71,68,0.14)] motion-reduce:transform-none motion-reduce:transition-none',
                surfaces[index % surfaces.length],
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className="absolute -right-6 -top-8 h-20 w-20 rounded-full bg-white/70 blur-2xl"
              />
              <div className="relative flex items-start justify-between gap-2">
                <span
                  className={[
                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 motion-reduce:transform-none sm:h-10 sm:w-10',
                    iconSurfaces[index % iconSurfaces.length],
                  ].join(' ')}
                >
                  <Icon name={stat.icon} className="h-5 w-5" />
                </span>
                {stat.tag && (
                  <span className="max-w-[60%] truncate rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5A6B6A] ring-1 ring-inset ring-[#E6EAE3]">
                    {stat.tag}
                  </span>
                )}
              </div>

              <div className="relative">
                <output
                  aria-label={stat.label}
                  className="block text-2xl font-extrabold leading-none tabular-nums text-[#263D48] sm:text-3xl"
                >
                  {stat.value}
                </output>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[#304744] sm:text-xs">
                  {stat.label}
                </p>
                {stat.hint && <p className="mt-1 text-[11px] leading-snug text-[#5A6B6A] sm:text-xs">{stat.hint}</p>}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

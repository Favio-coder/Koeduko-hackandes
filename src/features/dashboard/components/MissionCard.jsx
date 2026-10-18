/**
 * MissionCard — tarjeta ilustrada de misión para el panel del estudiante.
 *
 * Gemela del `QuickAction` del panel docente: misma retícula, misma carga
 * diferida y el mismo fallback a icono si la ilustración no llega. Lo que
 * cambia es el envoltorio de juego: recompensa en XT, barra de avance y sello
 * de completada.
 *
 * Accesibilidad: la imagen es decorativa (`alt` vacío) y el enlace lleva
 * `aria-label`; la barra de avance es decorativa porque el `aria-label` del
 * enlace ya anuncia el estado de la misión.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/ui/Icon'
import { LoadingAnimation } from '@/components/ui/States'

export default function MissionCard({
  to,
  label,
  hint,
  img,
  icon = 'sparkles',
  reward = 0,
  progress = 0,
  done = false,
  plain = false,
}) {
  const [imageLoading, setImageLoading] = useState(!plain)
  const [imageError, setImageError] = useState(false)
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)

  const media = plain ? (
    <span className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-[#E9F8EA] via-[#F6FFF6] to-[#E6F4FF]">
      <span
        aria-hidden="true"
        className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-[#B7E8B5]/45 blur-2xl"
      />
      <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#2A7A35] shadow-[0_8px_20px_rgba(48,71,68,0.12)] transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transform-none">
        <Icon name={icon} className="h-8 w-8" />
      </span>
    </span>
  ) : (
    <div className="relative aspect-[1.94/1] w-full overflow-hidden bg-[#F8FAF6]">
      {imageLoading && !imageError && (
        <LoadingAnimation className="absolute inset-0 m-auto h-20 w-20" />
      )}
      {imageError ? (
        <div
          role="img"
          aria-label={`${label}: ilustración no disponible`}
          className="flex h-full flex-col items-center justify-center gap-2 text-[#7D8C8A]"
        >
          <Icon name={icon} className="h-8 w-8" />
          <span className="text-xs font-medium">Ilustración no disponible</span>
        </div>
      ) : (
        <img
          src={img}
          alt=""
          width={622}
          height={320}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true)
            setImageLoading(false)
          }}
          className="block h-full w-full scale-[1.04] object-cover transition-transform duration-300 ease-out group-hover:scale-[1.07] motion-reduce:transform-none motion-reduce:transition-none"
        />
      )}
    </div>
  )

  return (
    <Link
      to={to}
      aria-label={done ? `${label}. Completada` : label}
      className={[
        'group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-white',
        done ? 'border-[#B7E8B5] shadow-[0_8px_24px_rgba(48,71,68,0.12)]' : 'border-[#E6EAE3]',
        'transition-[box-shadow,border-color,transform] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none',
        'hover:-translate-y-1 hover:border-[#B7E8B5] hover:shadow-[0_14px_36px_rgba(48,71,68,0.16)]',
        'active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/55 focus-visible:ring-offset-2',
      ].join(' ')}
    >
      {done && (
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-[#2A7A35] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_4px_10px_rgba(42,122,53,0.28)]">
          <Icon name="check" className="h-3 w-3" />
          Lista
        </span>
      )}

      {media}

      <div className="flex flex-1 flex-col gap-3 border-t border-[#E6EAE3] px-3.5 py-3.5 sm:px-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={[
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-[background-color,color,transform] duration-200 group-hover:scale-105 group-active:scale-95 motion-reduce:transform-none',
              done ? 'bg-[#E9F8EA] text-[#2A7A35]' : 'bg-[#F3F7F2] text-[#304744]',
            ].join(' ')}
          >
            <Icon name={icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-extrabold leading-snug text-[#304744]">
              {label}
              <Icon
                name="chevronRight"
                className="h-4 w-4 shrink-0 text-[#7D8C8A] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
              />
            </p>
            <p className="mt-1 text-xs leading-snug text-[#5A6B6A] sm:text-[13px]">{hint}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF6DC] px-2 py-1 text-[11px] font-bold text-[#8A6410] ring-1 ring-inset ring-[#F0DBAB]"
          >
            <Icon name="bolt" className="h-3 w-3" />+{reward} XT
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#EAEEE7]">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-[#4CDB59] to-[#2FBF6B] transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#5A6B6A]">{pct}%</span>
        </div>
      </div>
    </Link>
  )
}

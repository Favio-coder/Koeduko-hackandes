/**
 * StudentHero — cabecera del panel del estudiante: nivel, XT y rango.
 *
 * Traduce el dato duro (XP acumulada) en la conversación del juego: nivel, rango
 * y cuántos puntos faltan para el siguiente. El aro de progreso y la barra
 * comparten el mismo porcentaje, así que se leen igual en móvil y en escritorio.
 */
import { Link } from 'react-router-dom'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import ProgressRing from '@/components/ui/ProgressRing'

const rankSurfaces = {
  neutral: 'bg-white/85 text-[#304744] ring-[#E6EAE3]',
  brand: 'bg-[#E9F8EA] text-[#2A7A35] ring-[#B7E8B5]',
  info: 'bg-[#E8F0FE] text-[#12459B] ring-[#BBD1F7]',
  warning: 'bg-[#FDF5E4] text-[#8A6410] ring-[#F0DBAB]',
  danger: 'bg-[#FCEDED] text-[#9B2C2C] ring-[#F0BEBE]',
  forest: 'bg-[#304744] text-white ring-[#304744]',
}

export default function StudentHero({ profile, progress, streak = 0, nextMissionTo = '/assessments' }) {
  const firstName = (profile?.displayName || 'estudiante').split(' ')[0]
  const pct = Math.round(progress.progress * 100)
  const missing = Math.max(0, progress.xpForNextLevel - progress.xpIntoLevel)
  const surface = rankSurfaces[progress.rank.tone] ?? rankSurfaces.neutral

  return (
    <header className="relative isolate overflow-hidden rounded-[1.75rem] border border-[#CFE9D1] bg-gradient-to-br from-[#E5FBE7] via-[#F6FFF6] to-[#E6F4FF] p-4 shadow-[0_10px_28px_rgba(48,71,68,0.10)] sm:p-6">
      <div aria-hidden="true" className="absolute -right-10 -top-14 -z-10 h-44 w-44 rounded-full bg-[#B7E8B5]/55 blur-3xl sm:h-64 sm:w-64" />
      <div aria-hidden="true" className="absolute -bottom-16 right-24 -z-10 h-36 w-36 rounded-full bg-[#BBDDE3]/55 blur-3xl" />
      <div aria-hidden="true" className="absolute left-1/3 top-1/2 -z-10 h-28 w-28 rounded-full bg-[#4CDB59]/20 blur-3xl" />

      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <div className="relative shrink-0">
          <Avatar
            name={profile?.displayName || 'Estudiante'}
            size="lg"
            showStatus
            className="rounded-2xl bg-white p-1 shadow-md ring-2 ring-white sm:rounded-3xl"
          />
          <span
            className="absolute -bottom-2 -left-2 inline-flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-full border-2 border-white bg-[#2A7A35] px-1.5 text-xs font-extrabold tabular-nums text-white shadow-[0_4px_10px_rgba(42,122,53,0.32)]"
            title={`Nivel ${progress.level}`}
          >
            <span className="sr-only">Nivel </span>
            {progress.level}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/75 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#2A7A35] shadow-sm sm:text-xs">
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            Panel estudiante
          </span>
          <h2 className="mt-2 break-words text-xl font-extrabold leading-tight tracking-tight text-[#304744] sm:text-3xl">
            ¡Hola, {firstName}!
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#526865] sm:text-sm">
            Tu aventura de hoy: completa las misiones, gana XT y sube de nivel.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className={['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ring-1 ring-inset', surface].join(' ')}>
              <Icon name="trophy" className="h-3.5 w-3.5" />
              {progress.rank.name}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-bold text-[#8A6410] shadow-sm ring-1 ring-inset ring-[#F0DBAB]">
              <Icon name="flame" className="h-3.5 w-3.5" />
              {streak} {streak === 1 ? 'día seguidos' : 'días seguidos'}
            </span>
          </div>
        </div>

        <div aria-hidden="true" className="hidden shrink-0 items-center justify-center rounded-full border-4 border-white/80 bg-white/60 p-2 shadow-sm sm:flex">
          <img
            src="/logo/koeduko-512.png"
            alt=""
            width="512"
            height="512"
            className="h-16 w-16 object-contain lg:h-20 lg:w-20"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/70 p-3 backdrop-blur-sm sm:mt-5 sm:flex-row sm:items-center sm:gap-5 sm:p-4">
        <ProgressRing
          size="md"
          value={progress.progress}
          label={`Progreso hacia el nivel ${progress.level + 1}`}
          valueLabel={`${pct}%`}
          caption="al nivel"
          className="mx-auto sm:mx-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-extrabold text-[#304744]">
              {`Nivel ${progress.level}`}
              <span className="ml-2 text-xs font-semibold text-[#5A6B6A]">
                {`${progress.xpIntoLevel} / ${progress.xpForNextLevel} XT`}
              </span>
            </p>
            <p className="text-xs font-semibold text-[#2A7A35]">
              Te faltan {missing} XT para el nivel {progress.level + 1}
            </p>
          </div>

          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#EAEEE7] ring-1 ring-inset ring-[#E1E9DE]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4CDB59] via-[#3FC94D] to-[#2FBF6B] transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to={nextMissionTo}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#2A7A35] px-4 py-2 text-xs font-bold text-white shadow-[0_4px_12px_rgba(42,122,53,0.24)] transition-colors hover:bg-[#22632C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7A35] focus-visible:ring-offset-2 motion-reduce:transition-none sm:text-sm"
            >
              Seguir con mi misión
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE5DC] bg-white px-3 py-2 text-xs font-bold tabular-nums text-[#304744]">
              <Icon name="bolt" className="h-4 w-4 text-[#E8B33C]" />
              {progress.xp} XT en total
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

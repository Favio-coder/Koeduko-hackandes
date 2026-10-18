/**
 * BadgeShelf — vitrina de insignias del estudiante.
 *
 * Las ganadas se muestran a color; las que faltan, atenuadas con su pista de
 * progreso, para que el objetivo se vea alcanzable en lugar de ser un aviso.
 */
import { Card } from '@/components/ui'
import Icon from '@/components/ui/Icon'

export default function BadgeShelf({ badges = [] }) {
  const earned = badges.filter((badge) => badge.earned).length

  return (
    <Card
      title="Insignias"
      description="Logros que desbloqueas conforme avanzas en el curso."
      actions={
        <span
          aria-label={`Insignias ganadas: ${earned} de ${badges.length}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#E9F8EA] px-2.5 py-1 text-xs font-bold tabular-nums text-[#2A7A35]"
        >
          <Icon name="trophy" className="h-3.5 w-3.5" />
          {earned} / {badges.length}
        </span>
      }
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {badges.map((badge) => {
          const pct = Math.round((badge.progress ?? (badge.earned ? 1 : 0)) * 100)
          return (
            <li key={badge.id}>
              <div
                className={[
                  'group relative flex h-full flex-col items-center gap-2 rounded-2xl border px-2.5 py-3.5 text-center transition-[box-shadow,transform] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none',
                  badge.earned
                    ? 'border-[#B7E8B5] bg-gradient-to-b from-[#F2FFF3] to-white shadow-[0_6px_18px_rgba(48,71,68,0.10)] hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(48,71,68,0.16)]'
                    : 'border-dashed border-[#DCE5DC] bg-[#FAFBF9]',
                ].join(' ')}
              >
                <span
                  className={[
                    'relative inline-flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none',
                    badge.earned
                      ? 'bg-gradient-to-br from-[#4CDB59] to-[#2FBF6B] text-white shadow-[0_6px_14px_rgba(76,219,89,0.36)]'
                      : 'bg-[#EAEEE7] text-[#ABB1AB]',
                  ].join(' ')}
                >
                  <Icon name={badge.earned ? badge.icon : 'lock'} className="h-6 w-6" />
                  {badge.earned && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#E8B33C]"
                    />
                  )}
                </span>

                <p
                  className={[
                    'text-xs font-extrabold leading-tight',
                    badge.earned ? 'text-[#304744]' : 'text-[#7D8C8A]',
                  ].join(' ')}
                >
                  {badge.label}
                </p>

                {!badge.earned ? (
                  <>
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-[#EAEEE7]">
                      <span
                        className="block h-full rounded-full bg-[#C9D5C9] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="text-[10px] leading-tight text-[#7D8C8A]">{badge.hint}</span>
                  </>
                ) : (
                  <span className="text-[10px] leading-tight text-[#5A6B6A]">{badge.description}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

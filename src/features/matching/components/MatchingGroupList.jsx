import { Avatar, Icon } from '@/components/ui'
import { focusRing } from '@/components/ui/tokens'
import { DIMENSION_LABELS, MIN_HELPER_SCORE } from '../data/matchingConfig'

/** Agrupa el listado en parejas y tríos con la paleta de marca del dashboard. */
export default function MatchingGroupList({ groups, filter = 'all' }) {
  return (
    <ol className="grid items-start gap-4 md:grid-cols-2" aria-label="Grupos de estudiantes">
      {groups.map((group, index) => {
        if (filter === 'pairs' && group.size !== 2) return null
        if (filter === 'trios' && group.size !== 3) return null
        return (
          <li
            key={group.id}
            className="overflow-hidden rounded-2xl border border-[#E6EAE3] bg-white shadow-[0_1px_3px_rgba(48,71,68,0.08),0_1px_2px_rgba(48,71,68,0.04)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EAE3] bg-[#F8FAF6] px-5 py-3.5">
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#304744] text-xs font-bold text-white"
                >
                  {index + 1}
                </span>
                <h3 className="text-sm font-bold tracking-tight text-[#304744]">Grupo {index + 1}</h3>
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  group.size === 3 ? 'bg-[#FFF1D6] text-[#8A5A08]' : 'bg-[#E9F8EA] text-[#2A7A35]'
                }`}
              >
                {group.size === 3 ? 'Trío' : 'Pareja'}
              </span>
            </div>

            <div className="p-5">
              <ul className="space-y-2" aria-label={`Integrantes del grupo ${index + 1}`}>
                {group.members.map((member) => (
                  <li
                    key={member.studentId}
                    className="flex items-center gap-3 rounded-xl border border-[#E6EAE3] bg-[#F8FAF6] p-3 transition-colors hover:border-[#B7E8B5]"
                  >
                    <Avatar name={member.displayName} size="sm" />
                    <span className="min-w-0 break-words text-sm font-semibold text-[#304744]">
                      {member.displayName}
                    </span>
                  </li>
                ))}
              </ul>

              <details className="mt-4 rounded-xl border border-[#E6EAE3] bg-[#F8FAF6] px-4 py-2.5 text-xs leading-relaxed text-[#5A6B6A]">
                <summary
                  className={`flex cursor-pointer items-center justify-between gap-2 py-1 text-sm font-semibold text-[#304744] ${focusRing}`}
                >
                  Ver motivo del agrupamiento
                  <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-[#7D8C8A]" />
                </summary>
                <div className="mt-3 space-y-3 border-t border-[#E6EAE3] pt-3">
                  <div className="flex flex-wrap gap-2">
                    {group.focusSkillIds.map((id) => (
                      <span
                        key={id}
                        className="rounded-lg bg-[#E9F8EA] px-2 py-1 font-semibold text-[#2A7A35]"
                      >
                        {DIMENSION_LABELS[id] ?? id}
                      </span>
                    ))}
                  </div>
                  <p>{group.explanation}</p>
                  <p className="text-[#7D8C8A]">
                    Apoyos con {Math.round(MIN_HELPER_SCORE * 100)}% o más y diferencias de puntaje
                    no menores que el 25%.
                  </p>
                </div>
              </details>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

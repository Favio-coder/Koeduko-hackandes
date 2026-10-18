/**
 * SkillBoard — mapa de competencias del estudiante.
 *
 * Cada destreza se lee como una barra con su nivel en palabras (Aprendiz /
 * Explorador / Experto / Maestro), no solo como un porcentaje. Ordenar de mayor
 * a menor deja arriba lo que ya dominas y abajo el reto de hoy.
 */
import { Card } from '@/components/ui'
import Icon from '@/components/ui/Icon'
import { skillLevel, skillLevelSurface } from '@/features/dashboard/lib/gamification'

export default function SkillBoard({ skills = [], strongest, weakest, hasProfile }) {
  return (
    <Card
      title="Mis competencias"
      description={
        hasProfile
          ? 'Tu dominio por destreza, ordenado de mayor a menor.'
          : 'Todavía no tienes un diagnóstico publicado: completa el curso para ver tu mapa.'
      }
      actions={
        hasProfile ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E9F8EA] px-2.5 py-1 text-xs font-semibold text-[#2A7A35]">
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            {skills.length} competencias
          </span>
        ) : null
      }
    >
      {!hasProfile ? (
        <div className="rounded-2xl border-2 border-dashed border-[#ABB1AB]/45 bg-[#F8FAF6] px-5 py-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E9F8EA] text-[#2A7A35]">
            <Icon name="target" className="h-6 w-6" />
          </span>
          <p className="text-sm font-bold text-[#304744]">Tu mapa aparece con el primer diagnóstico</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#5A6B6A]">
            Resuelve la evaluación del curso y KoEduko calcula tu dominio en las seis destrezas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {skills.map((skill) => {
            const level = skillLevel(skill.value)
            return (
              <div key={skill.id} className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#304744]">
                    <span className="truncate">{skill.label}</span>
                    {strongest?.id === skill.id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F8EA] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2A7A35] ring-1 ring-inset ring-[#B7E8B5]">
                        <Icon name="star" className="h-3 w-3" />
                        Tu mejor
                      </span>
                    )}
                    {weakest?.id === skill.id && skill.value < 0.75 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF5E4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8A6410] ring-1 ring-inset ring-[#F0DBAB]">
                        <Icon name="flame" className="h-3 w-3" />
                        Reto
                      </span>
                    )}
                  </p>
                  <span
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
                      skillLevelSurface[level.tone],
                    ].join(' ')}
                  >
                    {level.name}
                    <span className="tabular-nums opacity-80">{skill.pct}%</span>
                  </span>
                </div>
                <div
                  className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#EAEEE7]"
                  role="progressbar"
                  aria-label={skill.label}
                  aria-valuenow={skill.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={[
                      'h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out motion-reduce:transition-none',
                      level.bar,
                    ].join(' ')}
                    style={{ width: `${skill.pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

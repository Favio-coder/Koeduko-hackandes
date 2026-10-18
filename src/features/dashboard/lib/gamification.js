/**
 * gamification — reglas de progreso del panel del estudiante.
 *
 * Todo es puro y derivable de los datos que ya existen: no guarda estado ni
 * inventa resultados. Un estudiante sin diagnóstico simplemente tiene cero
 * competencias y ninguna insignia ganada, en vez de un número ficticio.
 *
 * La XT se reparte así (todo listo para revisar en `tests`):
 * - dominio por competencia: `round(mastery * 100)` (máx. 600 con 6 destrezas);
 * - cada evaluación calificada: `round(nota/20 * 100)`;
 * - cada sesión ya realizada: 40.
 *
 * El nivel sube cada `XP_POR_NIVEL` puntos, de forma acumulativa.
 */
import { MATH_SKILLS } from '@/shared/constants/contracts'

/** Puntos necesarios para subir de nivel. */
export const XP_POR_NIVEL = 300

/** Puntos que otorga una sesión ya realizada. */
export const XP_POR_SESION = 40

/** Rangos por nivel. El primero que alcanza el nivel vigente es el que se muestra. */
export const RANKS = Object.freeze([
  { name: 'Explorador', minLevel: 1, tone: 'neutral' },
  { name: 'Aprendiz', minLevel: 3, tone: 'brand' },
  { name: 'Resolutor', minLevel: 5, tone: 'info' },
  { name: 'Experto', minLevel: 7, tone: 'warning' },
  { name: 'Maestro', minLevel: 10, tone: 'danger' },
  { name: 'Guardián del conocimiento', minLevel: 14, tone: 'forest' },
])

const clamp01 = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0
}

const safeArray = (value) => (Array.isArray(value) ? value : [])

/**
 * Nivel y avance dentro del nivel actual.
 * @param {number} xp puntos acumulados.
 * @returns {{level:number, xp:number, xpIntoLevel:number, xpForNextLevel:number, progress:number}}
 */
export function levelFromXp(xp) {
  const total = Number.isFinite(xp) ? Math.max(0, Math.round(xp)) : 0
  const level = Math.floor(total / XP_POR_NIVEL) + 1
  const xpIntoLevel = total % XP_POR_NIVEL
  return {
    level,
    xp: total,
    xpIntoLevel,
    xpForNextLevel: XP_POR_NIVEL,
    progress: xpIntoLevel / XP_POR_NIVEL,
  }
}

/** Nombre del rango correspondiente a un nivel. */
export function rankForLevel(level) {
  const value = Number.isFinite(level) ? level : 1
  return [...RANKS].reverse().find((rank) => value >= rank.minLevel) ?? RANKS[0]
}

/**
 * Competencias del estudiante como lista ordenada (de mayor a menor dominio).
 * @param {Record<string, number>} skills
 * @returns {Array<{id:string,label:string,value:number,pct:number,strong:boolean}>}
 */
export function skillList(skills = {}) {
  return MATH_SKILLS.map((skill) => {
    const value = clamp01(skills?.[skill.id])
    return {
      id: skill.id,
      label: skill.label,
      description: skill.description,
      value,
      pct: Math.round(value * 100),
      strong: value >= 0.75,
    }
  }).sort((a, b) => b.value - a.value)
}

/** Promedio de dominio de las 6 destrezas evaluadas. */
export function masteryAverage(skills = {}) {
  const values = MATH_SKILLS.map((skill) => clamp01(skills?.[skill.id]))
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

/** Superficies (clases Tailwind literales) de cada nivel de destreza. */
export const skillLevelSurface = Object.freeze({
  forest: 'bg-[#E9F8EA] text-[#2A7A35] ring-[#B7E8B5]',
  info: 'bg-[#E7F3F5] text-[#215B66] ring-[#BBDDE3]',
  warning: 'bg-[#FDF5E4] text-[#8A6410] ring-[#F0DBAB]',
  neutral: 'bg-[#F3F7F2] text-[#5A6B6A] ring-[#E6EAE3]',
})

/** Nombre y color del nivel de una destreza según su dominio (0–1). */
export function skillLevel(value) {
  if (value >= 0.8) return { name: 'Maestro', tone: 'forest', bar: 'from-[#4CDB59] to-[#2FBF6B]' }
  if (value >= 0.6) return { name: 'Experto', tone: 'info', bar: 'from-[#5FC9C9] to-[#2F9AA6]' }
  if (value >= 0.35) return { name: 'Explorador', tone: 'warning', bar: 'from-[#E8B33C] to-[#E0932B]' }
  return { name: 'Aprendiz', tone: 'neutral', bar: 'from-[#C9D5C9] to-[#9DB0A4]' }
}

/**
 * Resumen de progreso del estudiante a partir de datos reales.
 *
 * @param {object} input
 * @param {Record<string, number>} [input.skills]   `knowledgeProfiles/{uid}.skills`
 * @param {Array} [input.records]   historial de calificaciones (`action: 'grades'`)
 * @param {Array} [input.sessions]  salas del estudiante
 * @param {Array} [input.assessments] evaluaciones asignadas (para las misiones)
 */
export function studentProgress({ skills, records = [], sessions = [], assessments = [] } = {}) {
  const skillsList = skillList(skills)
  const hasProfile = skillsList.some((skill) => skill.value > 0)

  const skillXp = skillsList.reduce((total, skill) => total + Math.round(skill.value * 100), 0)
  const graded = safeArray(records).filter((record) => Number.isFinite(record?.score20))
  const gradeXp = graded.reduce((total, record) => total + Math.round((record.score20 / 20) * 100), 0)
  const bestScore20 = graded.reduce(
    (best, record) => Math.max(best, record.score20),
    0,
  )
  const attended = safeArray(sessions).filter((session) => session?.status === 'completed')
  const sessionXp = attended.length * XP_POR_SESION
  const level = levelFromXp(skillXp + gradeXp + sessionXp)

  const pending = safeArray(assessments).filter(
    (assessment) => !graded.some((record) => record.assessmentId === assessment?.id),
  )

  return {
    skills: skillsList,
    hasProfile,
    xp: level.xp,
    level: level.level,
    xpIntoLevel: level.xpIntoLevel,
    xpForNextLevel: level.xpForNextLevel,
    progress: level.progress,
    rank: rankForLevel(level.level),
    skillXp,
    gradeXp,
    sessionXp,
    gradedCount: graded.length,
    bestScore20,
    averageMastery: masteryAverage(skills),
    strongest: skillsList[0] ?? null,
    weakest: skillsList[skillsList.length - 1] ?? null,
    attendedCount: attended.length,
    totalSessions: safeArray(sessions).length,
    pendingCount: pending.length,
  }
}

/**
 * Insignias del estudiante. Cada una trae su condición ya evaluada, para que la
 * vista solo tenga que pintar el estado (ganada / en progreso).
 */
export function studentBadges({ skills = {}, records = [], sessions = [] } = {}) {
  const progress = studentProgress({ skills, records, sessions })
  const values = progress.skills.map((skill) => skill.value)
  const done = values.filter((value) => value >= 0.75).length
  const attended = progress.attendedCount

  const badges = [
    {
      id: 'primer-paso',
      label: 'Primer paso',
      description: 'Completaste tu diagnóstico inicial.',
      icon: 'rocket',
      earned: progress.hasProfile,
      hint: 'Completa el diagnóstico para desbloquearla.',
    },
    {
      id: 'equilibrio',
      label: 'Equilibrado',
      description: 'Todas tus destrezas por encima del 60 %.',
      icon: 'target',
      earned: values.length > 0 && values.every((value) => value >= 0.6),
      hint: 'Refuerza las destrezas que están por debajo del 60 %.',
    },
    {
      id: 'constancia',
      label: 'Constancia',
      description: 'Asististe a una sesión con tu pareja.',
      icon: 'flame',
      earned: attended >= 1,
      hint: 'Únete a una sala para encender la racha.',
    },
    {
      id: 'especialista',
      label: 'Especialista',
      description: 'Dominas al menos 3 destrezas por encima del 75 %.',
      icon: 'bolt',
      earned: done >= 3,
      hint: `Te faltan ${Math.max(0, 3 - done)} destrezas experts.`,
    },
    {
      id: 'matematico-real',
      label: 'Matemático real',
      description: 'Una de tus notas llega o supera 19/20.',
      icon: 'medal',
      earned: progress.bestScore20 >= 19,
      hint: 'Resuelve tu próxima evaluación con todo.',
    },
    {
      id: 'maestro',
      label: 'Maestro',
      description: 'Dominas las 6 destrezas por encima del 80 %.',
      icon: 'trophy',
      earned: values.length > 0 && values.every((value) => value >= 0.8),
      hint: 'Sigue practicando para cerrar el ciclo completo.',
    },
  ]

  return badges.map((badge) => ({ ...badge, progress: badgeProgress(badge.id, progress) }))
}

/** Avance 0–1 de una insignia, para pintar a medio camino. */
function badgeProgress(id, progress) {
  switch (id) {
    case 'primer-paso':
      return progress.hasProfile ? 1 : 0
    case 'equilibrio': {
      if (!progress.skills.length) return 0
      const average = progress.skills.reduce((total, s) => total + Math.min(1, s.value / 0.6), 0)
      return average / progress.skills.length
    }
    case 'constancia':
      return progress.attendedCount > 0 ? 1 : 0
    case 'especialista': {
      const done = progress.skills.filter((skill) => skill.value >= 0.75).length
      return done / 3
    }
    case 'matematico-real':
      return Math.min(1, progress.bestScore20 / 19)
    case 'maestro': {
      if (!progress.skills.length) return 0
      return progress.skills.reduce((total, s) => total + Math.min(1, s.value / 0.8), 0) / progress.skills.length
    }
    default:
      return 0
  }
}

/**
 * Misiones: los accesos rápidos del panel, con avance y recompensa.
 *
 * Las dos primeras llevan la ilustración de `public/botonesestudiante/`, igual
 * que el panel docente usa las suyas de `public/botones/`.
 */
export function studentMissions({ progress, assessments = [], sessions = [] } = {}) {
  const pending = progress?.pendingCount ?? 0
  const total = safeArray(assessments).length
  const live = safeArray(sessions).filter(
    (session) => session?.status === 'live' || session?.status === 'scheduled',
  ).length

  return [
    {
      id: 'diagnostico',
      to: '/assessments',
      label: 'Realizar diagnóstico',
      hint: pending
        ? `Te faltan ${pending} ${pending === 1 ? 'evaluación' : 'evaluaciones'} por resolver.`
        : 'Todo al día. Repasa tus resultados y mejora tu nota.',
      img: '/botonesestudiante/Realizadiagnostica-card.png',
      icon: 'clipboard',
      reward: 120,
      progress: total ? clamp01((total - pending) / total) : progress?.hasProfile ? 1 : 0,
      done: pending === 0 && progress?.hasProfile,
    },
    {
      id: 'salas',
      to: '/sessions',
      label: 'Gestionar mis salas',
      hint: live
        ? `Tienes ${live} ${live === 1 ? 'sala activa' : 'salas activas'} para unirte.`
        : 'Entra a la sala con tu pareja y practica en vivo.',
      img: '/botonesestudiante/gestionarsalas-card.png',
      icon: 'video',
      reward: 80,
      progress: clamp01(progress?.attendedCount / Math.max(1, safeArray(sessions).length)),
      done: progress?.attendedCount > 0,
    },
    {
      id: 'debilidad',
      to: '/assessments',
      label: 'Entrena tu destreza más débil',
      hint: progress?.weakest?.value
        ? `${progress.weakest.label} es tu reto de hoy (${progress.weakest.pct} %).`
        : 'Completa el diagnóstico para conocer tu punto de partida.',
      icon: 'target',
      reward: 150,
      progress: clamp01(progress?.weakest?.value ?? 0),
      done: (progress?.weakest?.value ?? 0) >= 0.75,
      plain: true,
    },
    {
      id: 'resultados',
      to: '/assessments',
      label: 'Revisa tus resultados',
      hint: progress?.gradedCount
        ? `${progress.gradedCount} ${progress.gradedCount === 1 ? 'evaluación calificada' : 'evaluaciones calificadas'}. Tu mejor nota: ${progress.bestScore20}/20.`
        : 'Todavía no tienes notas: resuelve tu primera evaluación.',
      icon: 'chart',
      reward: 60,
      progress: clamp01(progress?.gradedCount / 3),
      done: progress?.gradedCount >= 3,
      plain: true,
    },
  ]
}

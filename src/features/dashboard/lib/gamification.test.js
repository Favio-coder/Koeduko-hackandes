/**
 * Reglas de gamificación del panel del estudiante.
 *
 * Se prueban como funciones puras: el objetivo es que el nivel, el rango y las
 * insignias dependan solo de los datos reales, sin aleatoriedad ni fechas del
 * reloj (la racha se calcula en la vista y sí depende del día).
 */
import { describe, expect, it } from 'vitest'
import {
  RANKS,
  XP_POR_NIVEL,
  levelFromXp,
  rankForLevel,
  skillLevel,
  skillList,
  studentBadges,
  studentMissions,
  studentProgress,
} from '@/features/dashboard/lib/gamification'
import { DEMO_STUDENTS } from '@/shared/lib/demoData'

describe('levelFromXp', () => {
  it('empieza en nivel 1 y sube cada XP_POR_NIVEL puntos', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, progress: 0 })
    expect(levelFromXp(XP_POR_NIVEL - 1)).toMatchObject({ level: 1, xpIntoLevel: XP_POR_NIVEL - 1 })
    expect(levelFromXp(XP_POR_NIVEL)).toMatchObject({ level: 2, xpIntoLevel: 0 })
    expect(levelFromXp(XP_POR_NIVEL * 2 + 150).progress).toBeCloseTo(0.5)
  })

  it('tolera valores inválidos o negativos', () => {
    expect(levelFromXp(Number.NaN).level).toBe(1)
    expect(levelFromXp(-50).level).toBe(1)
  })
})

describe('rankForLevel', () => {
  it('devuelve el rango más alto alcanzado', () => {
    expect(rankForLevel(1).name).toBe(RANKS[0].name)
    expect(rankForLevel(4).name).toBe(RANKS[1].name)
    expect(rankForLevel(99).name).toBe(RANKS[RANKS.length - 1].name)
  })
})

describe('skillList', () => {
  it('devuelve las 6 destrezas ordenadas de mayor a menor y con porcentaje', () => {
    const list = skillList(DEMO_STUDENTS[0].skills)
    expect(list).toHaveLength(6)
    expect(list[0].value).toBeGreaterThanOrEqual(list[5].value)
    expect(list[0].label).toBe('Adicion')
    expect(list.every((skill) => skill.pct >= 0 && skill.pct <= 100)).toBe(true)
  })

  it('recorta valores fuera de rango y tolera datos ausentes', () => {
    expect(skillList({ addition: 5 })[0].pct).toBe(100)
    expect(skillList(undefined).every((skill) => skill.pct === 0)).toBe(true)
  })

  it('traduce el dominio a un nivel con nombre', () => {
    expect(skillLevel(0.9).name).toBe('Maestro')
    expect(skillLevel(0.7).name).toBe('Experto')
    expect(skillLevel(0.1).name).toBe('Aprendiz')
  })
})

describe('studentProgress', () => {
  it('suma dominio, notas y sesiones para obtener el XP y el nivel', () => {
    const progress = studentProgress({
      skills: DEMO_STUDENTS[0].skills,
      records: [{ assessmentId: 'a1', score20: 18 }],
      sessions: [{ status: 'completed' }],
      assessments: [{ id: 'a1' }, { id: 'a2' }],
    })
    /* 92+78+55+30+20+40 = 315 de competencias, 90 de la nota, 40 de la sesión. */
    expect(progress.xp).toBe(445)
    expect(progress.level).toBe(2)
    expect(progress.gradedCount).toBe(1)
    expect(progress.bestScore20).toBe(18)
    expect(progress.pendingCount).toBe(1)
    expect(progress.attendedCount).toBe(1)
    expect(progress.strongest.label).toBe('Adicion')
    expect(progress.weakest.label).toBe('Fracciones')
  })

  it('no inventa progreso cuando no hay datos', () => {
    const progress = studentProgress()
    expect(progress.hasProfile).toBe(false)
    expect(progress.xp).toBe(0)
    expect(progress.level).toBe(1)
    expect(progress.skills).toHaveLength(6)
    expect(progress.skills.every((skill) => skill.pct === 0)).toBe(true)
  })
})

describe('studentBadges', () => {
  it('otorga «Primer paso» con diagnóstico y ninguna insignia sin datos', () => {
    expect(studentBadges()[0].earned).toBe(false)
    const withProfile = studentBadges({ skills: DEMO_STUDENTS[0].skills })
    expect(withProfile[0].earned).toBe(true)
    expect(withProfile.filter((badge) => badge.earned)).toHaveLength(1)
  })

  it('desbloquea «Constancia» al asistir a una sesión', () => {
    const badges = studentBadges({ skills: {}, sessions: [{ status: 'completed' }] })
    const streak = badges.find((badge) => badge.id === 'constancia')
    expect(streak.earned).toBe(true)
  })

  it('«Especialista» exige 3 destrezas por encima del 75 %', () => {
    const skills = { addition: 0.9, subtraction: 0.8, multiplication: 0.8, division: 0.1, fraction: 0.1, estimation: 0.1 }
    const badge = studentBadges({ skills }).find((item) => item.id === 'especialista')
    expect(badge.earned).toBe(true)
    const partial = studentBadges({ skills: { addition: 0.9, subtraction: 0.8 } }).find(
      (item) => item.id === 'especialista',
    )
    expect(partial.earned).toBe(false)
    expect(partial.progress).toBeCloseTo(2 / 3)
  })

  it('todas las insignias exponen progreso entre 0 y 1', () => {
    studentBadges({ skills: DEMO_STUDENTS[0].skills }).forEach((badge) => {
      expect(badge.progress).toBeGreaterThanOrEqual(0)
      expect(badge.progress).toBeLessThanOrEqual(1)
    })
  })
})

describe('studentMissions', () => {
  const progress = studentProgress({ skills: DEMO_STUDENTS[0].skills })

  it('las dos primeras misiones usan las ilustraciones de botonesestudiante', () => {
    const missions = studentMissions({ progress })
    expect(missions[0].img).toBe('/botonesestudiante/Realizadiagnostica-card.png')
    expect(missions[1].img).toBe('/botonesestudiante/gestionarsalas-card.png')
    expect(missions[0].to).toBe('/assessments')
    expect(missions[1].to).toBe('/sessions')
  })

  it('marca la misión de diagnóstico como cumplida sin evaluaciones pendientes', () => {
    const missions = studentMissions({ progress, assessments: [] })
    expect(missions[0].done).toBe(true)
    expect(missions[0].progress).toBe(1)
  })

  it('las misiones sin ilustración se marcan como planas', () => {
    const missions = studentMissions({ progress })
    expect(missions.slice(2).every((mission) => mission.plain === true)).toBe(true)
  })

  it('siempre ofrece recompensa y una ruta válida', () => {
    studentMissions({ progress }).forEach((mission) => {
      expect(mission.reward).toBeGreaterThan(0)
      expect(mission.to.startsWith('/')).toBe(true)
      expect(mission.progress).toBeGreaterThanOrEqual(0)
      expect(mission.progress).toBeLessThanOrEqual(1)
    })
  })
})

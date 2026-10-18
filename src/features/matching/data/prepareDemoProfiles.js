import { DEMO_STUDENTS, toKnowledgeProfiles } from '@/shared/lib/demoData'
import { DEFAULT_SEED, DIMENSION_IDS, MAX_DEMO_STUDENTS, getLearningRoute } from './matchingConfig'

/**
 * Adapta la única fuente demo compartida. Para probar 40 se replican los cinco
 * perfiles sin cambiar sus valores. No se inventan resultados ni nuevas variables.
 */
export function prepareDemoProfiles(studentCount = DEMO_STUDENTS.length, scenario = DEFAULT_SEED) {
  if (!Number.isInteger(studentCount) || studentCount < 0 || studentCount > MAX_DEMO_STUDENTS) {
    throw new Error(`La demo admite de 0 a ${MAX_DEMO_STUDENTS} estudiantes.`)
  }
  if (!Number.isInteger(scenario) || scenario < 0 || scenario > 0xFFFFFFFF) throw new Error('El escenario no es válido.')
  if (!DEMO_STUDENTS.length && studentCount) throw new Error('La fuente compartida no contiene perfiles demo.')
  // Validar antes de usar el adaptador compartido, que sustituye ausencias por cero.
  if (DEMO_STUDENTS.some((student) => DIMENSION_IDS.some((id) => {
    const value = student.skills?.[id]
    return typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1
  }))) {
    throw new Error('La fuente compartida tiene datos demo inválidos.')
  }
  const baseProfiles = toKnowledgeProfiles(DEMO_STUDENTS)
  return Array.from({ length: studentCount }, (_, index) => {
    const template = baseProfiles[(index + scenario) % baseProfiles.length]
    const replica = Math.floor(index / baseProfiles.length) + 1
    const skills = { ...template.skills }
    return {
      ...template,
      studentId: replica === 1 ? template.studentId : `${template.studentId}-replica-${replica}`,
      displayName: replica === 1 ? template.displayName : `${template.displayName} · réplica ${replica}`,
      skills,
      templateStudentId: template.studentId,
      simulated: true,
      source: 'shared/lib/demoData.js',
      route: getLearningRoute(skills),
    }
  })
}

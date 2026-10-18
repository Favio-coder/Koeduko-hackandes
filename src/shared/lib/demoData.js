/**
 * Datos ficticios para la hackathon. NO son resultados calculados.
 * Se usan cuando un modulo aun no esta implementado (modo demo).
 */
import { MATH_SKILLS } from '@/shared/constants/contracts'

export const DEMO_CLASSROOM_ID = 'classroom-demo-5a'

export const DEMO_STUDENTS = [
  { id: 'student-001', displayName: 'Ana Torres', grade: '5to', skills: { addition: 0.92, subtraction: 0.78, multiplication: 0.55, division: 0.3, fraction: 0.2, estimation: 0.4 } },
  { id: 'student-002', displayName: 'Luis Rojas', grade: '5to', skills: { addition: 0.45, subtraction: 0.5, multiplication: 0.85, division: 0.7, fraction: 0.6, estimation: 0.55 } },
  { id: 'student-003', displayName: 'Mia Quispe', grade: '5to', skills: { addition: 0.88, subtraction: 0.9, multiplication: 0.35, division: 0.25, fraction: 0.15, estimation: 0.5 } },
  { id: 'student-004', displayName: 'Diego Huaman', grade: '5to', skills: { addition: 0.4, subtraction: 0.35, multiplication: 0.4, division: 0.45, fraction: 0.75, estimation: 0.65 } },
  { id: 'student-005', displayName: 'Sofia Vega', grade: '5to', skills: { addition: 0.7, subtraction: 0.6, multiplication: 0.65, division: 0.5, fraction: 0.4, estimation: 0.75 } },
  { id: 'student-006', displayName: 'Richard Asturimac', grade: '5to', skills: { addition: 0.2, subtraction: 0.1, multiplication: 0.30, division: 0.5, fraction: 0.4, estimation: 0.25 } },
  { id: 'student-007', displayName: 'Jelibeth Ramirez', grade: '5to', skills: { addition: 0.9, subtraction: 0.5, multiplication: 0.80, division: 0.8, fraction: 0.8, estimation: 0.8 } },
  { id: 'student-008', displayName: 'Carlos Mendoza', grade: '5to', skills: { addition: 0.1, subtraction: 0.1, multiplication: 0.1, division: 0.1, fraction: 0.1, estimation: 0.1 } },
]

export function toKnowledgeProfiles(students = DEMO_STUDENTS) {
  return students.map((s) => ({
    studentId: s.id,
    displayName: s.displayName,
    skills: Object.fromEntries(MATH_SKILLS.map((sk) => [sk.id, s.skills[sk.id] ?? 0])),
  }))
}
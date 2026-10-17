/**
 * navConfig — definición declarativa de la navegación de KoEduko.
 *
 * Única fuente de verdad para sidebar, navbar móvil y vistas previas.
 * El layout filtra por rol: los estudiantes nunca ven ítems de rol docente.
 *
 * `roles: null`  → visible para todos los usuarios autenticados.
 */
import { USER_ROLES } from '@/shared/constants/contracts'

const S = USER_ROLES.STUDENT
const T = USER_ROLES.TEACHER

export const navSections = [
  {
    title: 'Inicio',
    items: [{ label: 'Dashboard', to: '/dashboard', icon: 'home', roles: null }],
  },
  {
    title: 'Enseñanza',
    items: [
      { label: 'Diagnóstico', to: '/assessments', icon: 'clipboard', roles: [T] },
      { label: 'Emparejamiento', to: '/matching', icon: 'users', roles: [T] },
      { label: 'Resultados', to: '/matching/results', icon: 'chart', roles: [T] },
    ],
  },
  {
    title: 'Aprendizaje',
    items: [
      { label: 'Sesiones', to: '/sessions', icon: 'calendar', roles: [S, T] },
      { label: 'Tutor IA', to: '/sessions/demo-session-1/tutor', icon: 'sparkles', roles: [S, T] },
    ],
  },
]

/**
 * @param {string|null} role  `USER_ROLES.TEACHER` | `USER_ROLES.STUDENT` | null
 * @returns {Array<{title: string, items: Array}>} secciones sin ítems vacíos.
 */
export function sectionsForRole(role) {
  if (!role) return navSections.filter((s) => s.items.some((i) => !i.roles))
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0)
}

/** Versión plana para la barra de navegación superior. */
export function itemsForRole(role) {
  return sectionsForRole(role).flatMap((s) => s.items)
}
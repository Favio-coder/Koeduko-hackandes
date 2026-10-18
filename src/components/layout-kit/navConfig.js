/**
 * navConfig — fuente única de verdad de la navegación de KoEduko.
 *
 * Secciones: Principal · Curso · Estudiantes · Emparejamiento · Salas.
 * Incluye también las rutas secundarias que ya existían (Resultados, Sesión
 * activa, Tutor IA) para no perder ninguna funcionalidad.
 *
 * El filtrado por rol se aplica en el sidebar, en la navbar y en la vista
 * previa: un estudiante nunca ve entradas de docente.
 */
import { USER_ROLES } from '@/shared/constants/contracts'

const T = USER_ROLES.TEACHER
const S = USER_ROLES.STUDENT

/** `roles: null` → visible para cualquier usuario autenticado. */
export const SIDEBAR_ITEMS = [
  {
    to: '/dashboard',
    label: 'Principal',
    icon: 'home',
    roles: null,
    /**
     * `/dashboard` es un índice que redirige por rol a `/dashboard/teacher` o
     * `/dashboard/student`. Por eso declara sus subrutas: al pulsar «Principal»
     * el usuario aterriza en el panel del rol y el indicador debe quedarse en
     * «Principal», no saltar a otro ítem.
     */
    matches: ['/dashboard', '/dashboard/teacher', '/dashboard/student'],
  },
  { to: '/assessments', label: 'Curso', icon: 'book', roles: null },
  { to: '/students', label: 'Estudiantes', icon: 'users', roles: [T] },
  { to: '/matching', label: 'Emparejamiento', icon: 'sparkles', roles: [T] },
  { to: '/matching/results', label: 'Resultados', icon: 'chart', roles: [T], nested: true },
  { to: '/sessions', label: 'Salas', icon: 'video', roles: [S, T] },
  { to: '/sessions/demo-session-1', label: 'Sesión activa', icon: 'calendar', roles: [S, T], nested: true },
  {
    to: '/sessions/demo-session-1/tutor',
    label: 'Tutor IA',
    icon: 'koala',
    roles: [S, T],
    nested: true,
  },
]

/**
 * @param {string|null} role `USER_ROLES.TEACHER` | `USER_ROLES.STUDENT` | null
 * @returns {Array} ítems visibles para el rol, en el orden declarado arriba.
 */
export function itemsForRole(role) {
  if (!role) return SIDEBAR_ITEMS.filter((i) => !i.roles)
  return SIDEBAR_ITEMS.filter((item) => !item.roles || item.roles.includes(role))
}

/** Versión plana (solo nivel superior) para la navbar. */
export function primaryItemsForRole(role) {
  return itemsForRole(role).filter((item) => !item.nested)
}
/** Títulos legibles por ruta, para la navbar. */
const SECTION_TITLES = [
  { to: '/dashboard', label: 'Principal' },
  { to: '/assessments', label: 'Curso' },
  { to: '/students', label: 'Estudiantes' },
  { to: '/dashboard/teacher', label: 'Panel docente' },
  { to: '/matching', label: 'Emparejamiento' },
  { to: '/matching/results', label: 'Resultados de emparejamiento' },
  { to: '/sessions', label: 'Salas' },
  { to: '/sessions/demo-session-1', label: 'Sesión activa' },
  { to: '/sessions/demo-session-1/tutor', label: 'Tutor IA' },
]

/* Coincidencia por prefijo, de la ruta más específica a la más general. */
const ORDERED_TITLES = [...SECTION_TITLES].sort((a, b) => b.to.length - a.to.length)

/**
 * @param {string} pathname ruta actual de react-router.
 * @returns {string} título de la sección.
 */
export function sectionTitleFor(pathname = '') {
  return ORDERED_TITLES.find((s) => pathname.startsWith(s.to))?.label ?? 'KoEduko'
}

/**
 * Resuelve qué ítem del menú debe verse activo para una ruta dada.
 *
 * Antes se delegaba en el `isActive` de `NavLink`, que compara por prefijo y
 * dejaba dos opciones encendidas a la vez (`/dashboard` encendía «Principal» y
 * «Estudiantes» en `/dashboard/teacher`). Ahora hay **un único responsable**:
 *
 * 1. Coincidencia exacta (respeta `matches` cuando el ítem la declara).
 * 2. Si no hay exacta, la coincidencia por prefijo más específica.
 *
 * Se usa el mismo resolvedor en `Navbar` y en `Sidebar`, así el indicador
 * siempre coincide entre las dos barras.
 *
 * @param {string} pathname ruta actual de react-router.
 * @param {Array} [items] ítems visibles para el rol (por defecto, todos).
 * @returns {string|null} `to` del ítem activo, o `null`.
 */
export function activeItemTo(pathname = '', items = SIDEBAR_ITEMS) {
  const claims = (item) =>
    item.matches?.includes(pathname) || pathname === item.to || pathname.startsWith(`${item.to}/`)

  const candidates = items.filter(claims)
  if (!candidates.length) return null

  const exact = candidates.filter((item) => item.matches?.includes(pathname) || pathname === item.to)
  if (exact.length === 1) return exact[0].to

  // Sin coincidencia exacta gana la coincidencia por prefijo más específica.
  return candidates.sort((a, b) => b.to.length - a.to.length)[0].to
}

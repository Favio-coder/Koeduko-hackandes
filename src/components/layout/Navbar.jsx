/**
 * Navbar — barra superior.
 *
 * Conserva: título de la sección, usuario autenticado, avatar, rol y logout.
 * Mejora: alineación, jerarquía tipográfica, menú de usuario accesible y
 *adaptación móvil (en pantallas chicas la navegación vive en el sidebar).
 *
 * Props opcionales para poder renderizarla fuera del contexto real (vista
 * previa del design system). Por defecto lee todo de `AuthContext`.
 */
import Icon from '@/components/ui/Icon'

/** Control compacto del drawer; la navegación completa vive en el sidebar. */
export default function Navbar({ onMenuClick, drawerOpen = false }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[#E6EAE3] bg-white/95 px-3 backdrop-blur-md lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Abrir menú de navegación"
        aria-expanded={drawerOpen}
        aria-controls={drawerOpen ? 'app-sidebar-drawer' : undefined}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#304744] transition-colors duration-150 hover:bg-[#F8FAF6] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>
    </header>
  )
}
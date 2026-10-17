/**
 * AppNavbar — barra superior responsive.
 *
 * Contiene: marca, buscador opcional, campana, avatar con menú y el disparador
 * del menú lateral en móvil. El contenido visible depende del breakpoint; en
 * `md` o menos, los enlaces de navegación pasan al drawer lateral.
 *
 * @param {object} props
 * @param {string} [props.displayName]
 * @param {string} [props.email]
 * @param {string} [props.role]
 * @param {string} [props.photoURL]
 * @param {() => void} [props.onToggleSidebar]
 * @param {() => void} [props.onLogout]
 * @param {React.ReactNode} [props.search]
 * @param {React.ReactNode} [props.actions]
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Brand from './Brand'

const roleLabel = { teacher: 'Docente', student: 'Estudiante' }

export default function AppNavbar({
  displayName = '',
  email = '',
  role = null,
  photoURL,
  onToggleSidebar,
  onLogout,
  search,
  actions,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const name = displayName || email || 'Usuario'

  return (
    <header className="sticky top-0 z-30 border-b border-[#E3E7E1] bg-[#FFFEFD]/90 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Abrir menú de navegación"
            aria-expanded={false}
            onClick={onToggleSidebar}
            className="h-10 w-10 shrink-0 px-0 lg:hidden"
          >
            <Icon name="menu" className="h-5 w-5" />
          </Button>
        )}

        <Link
          to="/dashboard"
          className="rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#62DD6B]/45"
        >
          <Brand size="sm" showName className="lg:hidden" />
          <Brand size="md" showName className="hidden lg:inline-flex" />
        </Link>

        {search && <div className="ml-2 hidden min-w-0 flex-1 md:block">{search}</div>}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {actions}

          <Button
            variant="ghost"
            size="sm"
            aria-label="Notificaciones"
            className="relative h-10 w-10 px-0"
          >
            <Icon name="bell" className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#62DD6B] ring-2 ring-[#FFFEFD]" />
          </Button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={[
                'flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors duration-150',
                'hover:bg-[#F6FAF2] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#62DD6B]/45',
              ].join(' ')}
            >
              <Avatar name={name} src={photoURL} size="sm" alt={`Foto de ${name}`} />
              <span className="hidden text-left sm:block">
                <span className="block max-w-40 truncate text-sm font-semibold text-[#31494A]">
                  {name}
                </span>
                <span className="block text-[11px] font-medium text-[#5C6A69]">
                  {roleLabel[role] ?? 'Sin rol'}
                </span>
              </span>
              <Icon name="chevronDown" className="hidden h-4 w-4 text-[#7C8A88] sm:block" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-[#E3E7E1] bg-[#FFFEFD] shadow-[0_12px_32px_rgba(49,73,74,0.16)]"
              >
                <div className="border-b border-[#E3E7E1] bg-[#F6FAF2] px-4 py-3">
                  <p className="truncate text-sm font-bold text-[#31494A]">{name}</p>
                  {email && <p className="truncate text-xs text-[#5C6A69]">{email}</p>}
                  <div className="mt-2">
                    <Badge tone={role === 'teacher' ? 'brand' : 'info'} size="sm">
                      {roleLabel[role] ?? 'Sin rol'}
                    </Badge>
                  </div>
                </div>
                <div className="p-1.5">
                  <Link
                    to="/dashboard"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[#31494A] transition-colors duration-150 hover:bg-[#F6FAF2]"
                  >
                    <Icon name="home" className="h-4 w-4 text-[#7C8A88]" />
                    Mi panel
                  </Link>
                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[#31494A] transition-colors duration-150 hover:bg-[#F6FAF2]"
                  >
                    <Icon name="settings" className="h-4 w-4 text-[#7C8A88]" />
                    Configuración
                  </Link>
                </div>
                {onLogout && (
                  <div className="border-t border-[#E3E7E1] p-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#9B2C2C] transition-colors duration-150 hover:bg-[#FCEDED]"
                    >
                      <Icon name="logout" className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
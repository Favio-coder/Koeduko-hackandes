/**
 * Sidebar — navegación principal sobre fondo verde bosque.
 *
 * Conserva TODAS las rutas existentes (dashboard, diagnóstico, emparejamiento,
 * resultados, sesiones, sesión activa y tutor IA) agrupadas en las cinco
 * secciones acordadas: Principal · Curso · Estudiantes · Emparejamiento · Salas.
 * Solo cambia la presentación.
 *
 * Accesibilidad: `nav` con etiqueta, `NavLink` con estado activo anunciado,
 * foco visible en cada opción y soporte para navegación por teclado.
 */
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { itemsForRole } from '@/components/layout-kit/navConfig'
import Icon from '@/components/ui/Icon'
import Logo from '@/components/ui/Logo'

function itemClasses({ isActive }) {
  return [
    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
    'transition-[background-color,color,transform] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/60',
    isActive
      ? 'bg-white/15 text-white'
      : 'text-white/70 hover:bg-white/10 hover:text-white',
  ].join(' ')
}

function Item({ item, onNavigate }) {
  return (
    <NavLink to={item.to} className={itemClasses} onClick={onNavigate} end={item.to === '/dashboard'}>
      {({ isActive }) => (
        <>
          {/* Indicador visual de ruta activa */}
          <span
            aria-hidden="true"
            className={[
              'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#4CDB59] transition-opacity duration-150',
              isActive ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          />
          <Icon name={item.icon} className="h-5 w-5 shrink-0" />
          <span className={['truncate', item.nested && 'pl-1 text-[13px]'].join(' ')}>
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ onNavigate, role: roleProp }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const items = itemsForRole(roleProp ?? auth?.role)

  const handleLogout = async () => {
    await auth?.logout?.()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full flex-col bg-[#304744]">
      {/* Marca */}
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <Logo variant="mark" size="md" alt="KoEduko" onDark />
        <span className="ml-2.5 text-base font-bold tracking-tight text-white">
          Ko<span className="text-[#4CDB59]">Eduko</span>
        </span>
      </div>

      {/* Navegación */}
      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <Item item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Pie institucional */}
      <div className="shrink-0 border-t border-white/10 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Aprendizaje entre pares
        </p>
        <p className="mt-1 text-xs text-white/50">Emparejamiento por complementariedad</p>
        {auth?.logout && (
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/60"
          >
            <Icon name="logout" className="h-4 w-4" />
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  )
}

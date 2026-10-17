/**
 * AppSidebar — navegación lateral por secciones, con grupos desplegables
 * opcionales y soporte para collage (filete) en móvil.
 *
 * No depende del layout: recibe la lista de secciones ya filtrada por rol, así
 * que sirve igual dentro del shell de escritorio y dentro del drawer móvil.
 *
 * @param {object} props
 * @param {Array} [props.sections]
 * @param {'lg'|'full'} [props.onNavigate] callback al pulsar un enlace (cierra el drawer).
 */
import { NavLink } from 'react-router-dom'
import Icon from '@/components/ui/Icon'

function itemClasses({ isActive }) {
  return [
    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
    'transition-[background-color,color,transform] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#62DD6B]/45',
    isActive
      ? 'bg-[#E8F8E4] text-[#2F7F3C] shadow-[inset_0_0_0_1px_#B6E9AE]'
      : 'text-[#5C6A69] hover:bg-[#F6FAF2] hover:text-[#31494A]',
  ].join(' ')
}

function Section({ section, onNavigate }) {
  return (
    <div className="mb-6">
      <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ABB1AB]">
        {section.title}
      </p>
      <ul className="space-y-1">
        {section.items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} className={itemClasses} onClick={onNavigate}>
              {({ isActive }) => (
                <>
                  <Icon
                    name={item.icon ?? 'home'}
                    className={[
                      'h-5 w-5 shrink-0 transition-colors duration-150',
                      isActive ? 'text-[#2F7F3C]' : 'text-[#7C8A88] group-hover:text-[#31494A]',
                    ].join(' ')}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * @param {object} props
 * @param {Array} [props.sections] secciones del menú.
 * @param {string} [props.footer] contenido fijo al pie (ayuda, versión).
 * @param {() => void} [props.onNavigate]
 */
export default function AppSidebar({ sections = [], footer, onNavigate }) {
  return (
    <nav aria-label="Navegación principal" className="flex h-full flex-col overflow-y-auto px-3 py-5">
      {sections.map((section) => (
        <Section key={section.title} section={section} onNavigate={onNavigate} />
      ))}
      {footer && <div className="mt-auto px-1 pt-4">{footer}</div>}
    </nav>
  )
}
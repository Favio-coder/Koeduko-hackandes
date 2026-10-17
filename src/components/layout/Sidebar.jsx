import { NavLink } from 'react-router-dom'

const sections = [
  {
    title: 'Inicio',
    items: [{ to: '/dashboard', label: 'Dashboard' }],
  },
  {
    title: 'Ensenanza',
    items: [
      { to: '/assessments', label: 'Diagnostico' },
      { to: '/matching', label: 'Emparejamiento' },
      { to: '/matching/results', label: 'Resultados' },
    ],
  },
  {
    title: 'Aprendizaje',
    items: [
      { to: '/sessions', label: 'Sesiones' },
      { to: '/sessions/demo-session-1', label: 'Sesion activa' },
      { to: '/sessions/demo-session-1/tutor', label: 'Tutor IA' },
    ],
  },
]

export default function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-slate-50 p-4 lg:block">
      {sections.map((section) => (
        <div key={section.title} className="mb-5">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {section.title}
          </p>
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded-md px-2 py-1.5 text-sm ${
                      isActive
                        ? 'bg-indigo-100 font-medium text-indigo-800'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  )
}
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/assessments', label: 'Diagnostico' },
  { to: '/matching', label: 'Emparejamiento' },
  { to: '/sessions', label: 'Sesiones' },
]

export default function Navbar() {
  const { user, profile, role, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="text-lg font-bold text-indigo-700">
          KoEduko
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm text-slate-600">
            {profile?.displayName || user?.email}
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs uppercase text-slate-500">
              {(role=="teacher" ? 'Profesor' : 'Alumno' )|| 'sin rol'}
            </span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Salir
          </button>
        </div>

        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm md:hidden"
        >
          Menu
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-200 px-4 py-2 md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {link.label}
            </NavLink>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button type="button" onClick={handleLogout} className="text-sm text-indigo-700">
              Salir
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}
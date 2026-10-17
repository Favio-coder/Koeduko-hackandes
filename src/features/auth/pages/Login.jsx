import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'

export default function Login() {
  const { login, isAuthenticated, error } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || '/dashboard'} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate(location.state?.from || '/dashboard', { replace: true })
    } catch {
      setFormError('Credenciales invalidas. Verifica tu correo y contrasena.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-indigo-700">KoEduko</h1>
        <p className="mt-1 text-sm text-slate-500">Acceso a la plataforma educativa</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Correo electronico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contrasena
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {(formError || error) && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError || error.message}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Ingresando...' : 'Iniciar sesion'}
          </Button>
        </form>

        <div className="mt-6 flex justify-between text-sm">
          <Link to="/register" className="text-indigo-700 hover:underline">
            Crear cuenta
          </Link>
          <Link to="/forgot-password" className="text-slate-600 hover:underline">
            Olvide mi contrasena
          </Link>
        </div>
      </div>
    </div>
  )
}
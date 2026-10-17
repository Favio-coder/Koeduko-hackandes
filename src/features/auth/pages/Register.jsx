import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'

export default function Register() {
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    if (form.password !== form.confirm) {
      setError('Las contrasenas no coinciden.')
      return
    }
    setSubmitting(true)
    try {
      await register({ email: form.email, password: form.password, displayName: form.displayName })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(
        err.code === 'auth/email-already-in-use'
          ? 'Ese correo ya esta registrado.'
          : 'No se pudo crear la cuenta. Intenta nuevamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-indigo-700">Crear cuenta</h1>
        <p className="mt-1 text-sm text-slate-500">
          Las cuentas nuevas se registran con rol estudiante. La promocion a docente la realiza un
          administrador.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {[
            { id: 'displayName', label: 'Nombre completo', type: 'text', autoComplete: 'name' },
            { id: 'email', label: 'Correo electronico', type: 'email', autoComplete: 'email' },
            { id: 'password', label: 'Contrasena', type: 'password', autoComplete: 'new-password' },
            { id: 'confirm', label: 'Confirmar contrasena', type: 'password', autoComplete: 'new-password' },
          ].map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className="block text-sm font-medium text-slate-700">
                {field.label}
              </label>
              <input
                id={field.id}
                type={field.type}
                required
                autoComplete={field.autoComplete}
                value={form[field.id]}
                onChange={update(field.id)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          ))}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Creando cuenta...' : 'Registrarme'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="text-indigo-700 hover:underline">
            Iniciar sesion
          </Link>
        </p>
      </div>
    </div>
  )
}
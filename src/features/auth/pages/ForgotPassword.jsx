import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch {
      setError('No se pudo enviar el correo. Verifica la direccion e intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-indigo-700">Recuperar contrasena</h1>

        {sent ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            Si el correo esta registrado, enviamos un enlace para restablecer la contrasena.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Correo electronico
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Enviando...' : 'Enviar enlace'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-sm text-slate-600">
          <Link to="/login" className="text-indigo-700 hover:underline">
            Volver al inicio de sesion
          </Link>
        </p>
      </div>
    </div>
  )
}
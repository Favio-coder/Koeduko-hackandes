import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import Alert from '@/components/ui/Alert'
import AuthLayout from '@/components/layout/AuthLayout'
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
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Accede a tu aula de aprendizaje colaborativo."
      footer={
        <>
          <Link
            to="/register"
            className="font-semibold text-[#2A7A35] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
          >
            Crear cuenta
          </Link>
          <span className="mx-2 text-[#ABB1AB]">·</span>
          <Link
            to="/forgot-password"
            className="underline-offset-4 hover:text-[#304744] hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
          >
            Olvidé mi contraseña
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        <Input
          label="Correo electrónico"
          type="email"
          id="email"
          autoComplete="email"
          required
          icon="users"
          placeholder="tú@coeduko.dev"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          label="Contraseña"
          type="password"
          id="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          labelRight={
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-[#2A7A35] underline-offset-4 hover:underline"
            >
              ¿La olvidaste?
            </Link>
          }
        />

        {(formError || error) && (
          <Alert tone="error" compact>
            {formError || error.message}
          </Alert>
        )}

        <Button type="submit" loading={submitting} fullWidth size="lg">
          {submitting ? 'Ingresando...' : 'Iniciar sesión'}
        </Button>
      </form>
    </AuthLayout>
  )
}
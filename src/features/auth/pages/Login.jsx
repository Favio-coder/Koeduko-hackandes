import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import Alert from '@/components/ui/Alert'
import AuthLayout from '@/components/layout/AuthLayout'
import { useAuth } from '@/contexts/AuthContext'
import DemoAccess from '../components/DemoAccess'
import { DEMO_TEACHER } from '../demoAccount'

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

  const signIn = async (credentials) => {
    setFormError(null)
    setSubmitting(true)
    try {
      await login(credentials)
      navigate(location.state?.from || '/dashboard', { replace: true })
    } catch {
      setFormError('Credenciales invalidas. Verifica tu correo y contrasena.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await signIn({ email, password })
  }

  /* El acceso de la demo rellena los campos (para que se vea la cuenta) y
     entra de una vez, como si el docente la hubiera escrito. */
  const handleTeacherDemo = async () => {
    setEmail(DEMO_TEACHER.email)
    setPassword(DEMO_TEACHER.password)
    await signIn(DEMO_TEACHER)
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

      <DemoAccess onTeacherDemo={handleTeacherDemo} busy={submitting} />
    </AuthLayout>
  )
}
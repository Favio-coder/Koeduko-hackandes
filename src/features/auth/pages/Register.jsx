import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import AuthLayout from '@/components/layout/AuthLayout'
import { useAuth } from '@/contexts/AuthContext'
import { joinDefaultCourse } from '@/features/assessments/services/courseEnrollmentService'

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
      /* Cuenta nueva = estudiante: el servidor la mete sola en el curso de
         matemática para que vea evaluaciones desde el primer ingreso. Si el
         API no responde, la cuenta sigue creada y se avisa al entrar. */
      const enrolled = await joinDefaultCourse()
      navigate('/dashboard', {
        replace: true,
        state: enrolled?.joined?.length ? { course: enrolled.joined[0].name } : undefined,
      })
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
    <AuthLayout
      title="Crear cuenta"
      subtitle="Las cuentas nuevas se registran con rol estudiante y se asignan solas al curso de matemática. La promoción a docente la realiza un administrador."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#2A7A35] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
          >
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { id: 'displayName', label: 'Nombre completo', type: 'text', autoComplete: 'name' },
          { id: 'email', label: 'Correo electrónico', type: 'email', autoComplete: 'email' },
          { id: 'password', label: 'Contraseña', type: 'password', autoComplete: 'new-password' },
          {
            id: 'confirm',
            label: 'Confirmar contraseña',
            type: 'password',
            autoComplete: 'new-password',
          },
        ].map((field) => (
          <Input
            key={field.id}
            id={field.id}
            label={field.label}
            type={field.type}
            required
            autoComplete={field.autoComplete}
            value={form[field.id]}
            onChange={update(field.id)}
          />
        ))}

        {error && (
          <Alert tone="error" compact>
            {error}
          </Alert>
        )}

        <Button type="submit" loading={submitting} fullWidth size="lg">
          {submitting ? 'Creando cuenta...' : 'Registrarme'}
        </Button>
      </form>
    </AuthLayout>
  )
}

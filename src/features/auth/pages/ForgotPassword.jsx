import { useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import AuthLayout from '@/components/layout/AuthLayout'
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
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Te enviamos un enlace para restablecer tu contraseña."
      footer={
        <Link
          to="/login"
          className="font-semibold text-[#2A7A35] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/45"
        >
          Volver al inicio de sesión
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success" title="Revisa tu correo">
          Si el correo está registrado, enviamos un enlace para restablecer la contraseña.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Correo electrónico"
            type="email"
            id="email"
            required
            icon="users"
            placeholder="tú@coeduko.dev"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && (
            <Alert tone="error" compact>
              {error}
            </Alert>
          )}

          <Button type="submit" loading={submitting} fullWidth size="lg">
            {submitting ? 'Enviando...' : 'Enviar enlace'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
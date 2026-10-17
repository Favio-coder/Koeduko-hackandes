import { Navigate, useLocation } from 'react-router-dom'
import { LoadingState } from '@/components/ui/States'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Protege rutas privadas. `allowedRoles` opcional: si se define, el usuario
 * debe tener ese rol; en caso contrario se redirige a su dashboard.
 * La autoridad real se valida en Firestore Security Rules, no aqui.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState label="Verificando sesion..." />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />
  return children
}
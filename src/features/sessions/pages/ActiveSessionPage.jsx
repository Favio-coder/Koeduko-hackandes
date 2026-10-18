import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useActiveSession } from '../hooks/useActiveSession'

/**
 * "Sesion activa" del menu: resuelve la sesion real del usuario (la que esta en vivo; si no, la mas reciente) y
 * muestra `render(sessionId)` SIN cambiar la URL, asi el menu sigue marcando este item. Si no hay ninguna,
 * lo dice y lleva a las salas en vez de dejar una pagina vacia.
 *
 * El router la compone con la pagina que corresponda (el detalle de la sesion o el tutor), de modo que ninguna
 * feature importa a otra.
 *
 * @param {{ render: (sessionId: string) => import('react').ReactNode }} props
 */
export default function ActiveSessionPage({ render }) {
  const { user, isTeacher } = useAuth()
  const { loading, error, sessionId, retry } = useActiveSession(user?.uid, isTeacher)

  if (loading) return <LoadingState label="Buscando tu sesión..." />
  if (error) return <ErrorState title="No se pudo buscar tu sesión" error={error} onRetry={retry} />
  if (!sessionId) {
    return (
      <EmptyState
        title="Todavía no hay una sesión activa"
        description={isTeacher ? 'Cuando crees una sala para una pareja, aparecerá aquí.' : 'Cuando tu docente te asigne una sala, aparecerá aquí.'}
        action={
          <Button to="/sessions" variant="secondary">
            Ver salas
          </Button>
        }
      />
    )
  }
  return render(sessionId)
}

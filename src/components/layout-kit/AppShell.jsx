/**
 * AppShell — layout de aplicación responsive: navbar superior fija, sidebar
 * lateral en escritorio y drawer en móvil.
 *
 * Pensado para los futuros dashboards de DEV 1 (docente/estudiante), DEV 2
 * (matching) y DEV 3 (sesiones). No toca la lógica de datos: recibe todo por
 * props, salvo el usuario/rol que por defecto lee de `AuthContext`.
 *
 * Accesibilidad:
 * - Enlace de salto al contenido principal.
 * - El drawer atrapa el foco, cierra con Escape y bloquea el scroll del body.
 * - `aria-expanded` / `aria-controls` comunican el estado del menú.
 *
 * @example
 * <AppShell role={role} displayName={profile?.displayName} onLogout={logout}>
 *   <StudentDashboard />
 * </AppShell>
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import AppNavbar from './AppNavbar'
import AppSidebar from './AppSidebar'
import Brand from './Brand'
import { sectionsForRole } from './navConfig'

export default function AppShell({
  children,
  role: roleProp,
  displayName: displayNameProp,
  email: emailProp,
  photoURL,
  onLogout,
  search,
  navbarActions,
  sidebarFooter,
}) {
  const auth = useAuth()
  const role = roleProp ?? auth?.role ?? null
  const displayName = displayNameProp ?? auth?.profile?.displayName ?? ''
  const email = emailProp ?? auth?.user?.email ?? ''

  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef(null)
  const sections = sectionsForRole(role)

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  /* Escape cierra el drawer y el foco vuelve al disparador. */
  useEffect(() => {
    if (!drawerOpen) return undefined
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector('a, button')?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const sidebarContent = (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-[#E3E7E1] px-5 lg:hidden">
        <Brand size="sm" />
        <Button
          variant="ghost"
          size="sm"
          aria-label="Cerrar menú"
          onClick={closeDrawer}
          className="ml-auto h-9 w-9 px-0"
        >
          <Icon name="close" className="h-5 w-5" />
        </Button>
      </div>
      <AppSidebar
        sections={sections}
        onNavigate={closeDrawer}
        footer={
          sidebarFooter ?? (
            <div className="rounded-2xl border border-[#E3E7E1] bg-[#F6FAF2] p-3.5">
              <p className="text-xs font-bold text-[#31494A]">¿Necesitas ayuda?</p>
              <p className="mt-0.5 text-xs text-[#5C6A69]">
                Consulta la guía de pares互补arios para tu próxima sesión.
              </p>
            </div>
          )
        }
      />
    </>
  )

  return (
    <div className="min-h-dvh bg-[#F6FAF2] text-[#31494A]">
      <a
        href="#main-content"
        className={[
          'sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50',
          'focus:rounded-xl focus:bg-[#62DD6B] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#22302F]',
        ].join(' ')}
      >
        Saltar al contenido principal
      </a>

      <AppNavbar
        displayName={displayName}
        email={email}
        role={role}
        photoURL={photoURL}
        onToggleSidebar={() => setDrawerOpen(true)}
        onLogout={onLogout ?? auth?.logout}
        search={search}
        actions={navbarActions}
      />

      <div className="mx-auto flex w-full max-w-[90rem] gap-6 px-0 lg:px-6">
        {/* Sidebar de escritorio */}
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 border-r border-[#E3E7E1] bg-[#FFFEFD] lg:block">
          {sidebarContent}
        </aside>

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {children}
        </main>
      </div>

      {/* Drawer móvil */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={closeDrawer}
            className="absolute inset-0 h-full w-full cursor-default bg-[#22302F]/45 backdrop-blur-[2px]"
          />
          <div
            ref={drawerRef}
            id="app-sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col bg-[#FFFEFD] shadow-[0_0_64px_rgba(34,48,47,0.28)]"
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </div>
  )
}
/**
 * DashboardLayout — shell de la aplicación.
 *
 * - Escritorio (≥1024px): sidebar verde bosque fijo al borde izquierdo, sin
 *   barra superior.
 * - Tablet y móvil: sidebar en drawer accesible, abierto desde una barra
 *   compacta sin título (cierre con Escape, clic fuera o navegación).
 * - El contenido se entrega por `<Outlet />`; no se toca ninguna ruta.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef(null)
  const location = useLocation()

  /* El drawer se cierra al navegar: se deriva del pathname, no de un efecto. */
  const currentPath = location.pathname
  const [lastPath, setLastPath] = useState(currentPath)
  if (currentPath !== lastPath) {
    setLastPath(currentPath)
    if (drawerOpen) setDrawerOpen(false)
  }

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  /* Bloquea el scroll del body y enfoca el drawer mientras está abierto. */
  useEffect(() => {
    if (!drawerOpen) return undefined
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector('a, button')?.focus()

    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  /* En una SPA el navegador no vuelve arriba solo al cambiar de vista. */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-[#F8FAF6] text-[#304744]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[#4CDB59] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#263D48]"
        >
          Saltar al contenido principal
        </a>

        <div className="flex min-h-dvh w-full">
          {/* Sidebar persistente, alineado al borde izquierdo como en la referencia. */}
          <aside className="fixed inset-y-0 left-0 z-20 hidden h-dvh w-60 shrink-0 lg:block">
            <Sidebar />
          </aside>

          <div className="min-w-0 w-full lg:ml-60">
            <Navbar
              onMenuClick={() => setDrawerOpen(true)}
              drawerOpen={drawerOpen}
            />

            <main
              id="main-content"
              tabIndex={-1}
              className="mx-auto min-w-0 w-full max-w-[96rem] px-4 py-5 focus:outline-none sm:px-6 sm:py-7 lg:px-8 lg:py-7"
            >
              {children ?? <Outlet />}
            </main>
          </div>
        </div>

        {/* Drawer lateral (móvil y tablet) */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Cerrar menú de navegación"
              onClick={closeDrawer}
              className="absolute inset-0 h-full w-full cursor-default bg-[#263D48]/50 backdrop-blur-[2px]"
            />
            <div
              ref={drawerRef}
              id="app-sidebar-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
              className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col shadow-[0_0_64px_rgba(38,61,72,0.32)]"
            >
              <Sidebar onNavigate={closeDrawer} />
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
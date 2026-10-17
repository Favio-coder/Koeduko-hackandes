/**
 * AuthLayout — marco visual compartido por Login, Register y ForgotPassword.
 *
 * Solo presentación: no toca `useAuth`, ni las redirecciones, ni los envíos de
 * formulario. Envuelve el contenido de cada pantalla.
 *
 * Responsive: en escritorio se divide en dos columnas (marca + formulario);
 * en móvil se apila y la marca se compacta para no empujar el formulario.
 */
import Logo from '@/components/ui/Logo'
import { ToastProvider } from '@/components/ui/Toast'
import Icon from '@/components/ui/Icon'

const HIGHLIGHTS = [
  { icon: 'users', text: 'Parejas por conocimientos complementarios' },
  { icon: 'calendar', text: 'Salas con enlace de videollamada' },
  { icon: 'koala', text: 'Tutor IA con pistas progresivas' },
]

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <ToastProvider>
    <div className="flex min-h-dvh flex-col bg-[#F8FAF6] lg:flex-row">
      {/* Panel de marca */}
      <aside className="relative overflow-hidden bg-[#304744] px-5 py-6 text-white sm:px-8 lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:py-10">
        {/* Decoración sutil (no satinada, solo profundidad) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#4CDB59]/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-[#4CDB59]/10"
        />

        <div className="relative flex items-center gap-3">
          <Logo variant="mark" size="md" onDark />
          <span className="text-lg font-bold tracking-tight text-white">
            Ko<span className="text-[#4CDB59]">Eduko</span>
          </span>
        </div>

        {/* Propuesta de valor: solo en pantallas grandes */}
        <div className="relative mt-8 hidden lg:mt-0 lg:block">
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Aprende de quien
            <br />
            ya lo sabe.
          </h2>
          <ul className="mt-7 space-y-3.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#4CDB59]">
                  <Icon name={h.icon} className="h-5 w-5" />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-8 hidden text-xs text-white/40 lg:block">
          Plataforma educativa de aprendizaje colaborativo.
        </p>
      </aside>

      {/* Formulario */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-[#E6EAE3] bg-white p-6 shadow-[0_1px_3px_rgba(48,71,68,0.08),0_12px_32px_rgba(48,71,68,0.06)] sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-[#304744]">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-[#5A6B6A]">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <div className="mt-5 text-center text-sm text-[#5A6B6A]">{footer}</div>}
        </div>
      </main>
    </div>
    </ToastProvider>
  )
}
/**
 * DesignSystemPage — vista previa independiente del sistema de diseño.
 *
 * Muestra todos los componentes, variantes y estados con datos simulados.
 * No consume Firebase, ni `AuthContext`, ni el router de la aplicación (salvo
 * los enlaces internos), por lo que puede montarse en cualquier ruta sin
 * afectar la lógica del producto.
 *
 * Montaje sugerido (NAVEGACIÓN — requiere autorización):
 *   en `src/app/router.jsx`:
 *     const DesignSystemPage = lazy(() => import('@/pages/design-system/DesignSystemPage'))
 *     // dentro de <Routes>, fuera de ProtectedRoute:
 *     <Route path="/design-system" element={<DesignSystemPage />} />
 */
import { useState } from 'react'
import Alert from '@/components/ui/Alert'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Card'
import { Checkbox, Input, RadioGroup, Select, Textarea } from '@/components/ui/Field'
import Icon from '@/components/ui/Icon'
import Logo from '@/components/ui/Logo'
import { iconNames } from '@/components/ui/iconNames'
import ConfirmDialog, { default as Modal } from '@/components/ui/Modal'
import { Breadcrumbs, PageBody, PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState, Skeleton, SkeletonRow, Spinner } from '@/components/ui/States'
import Tooltip from '@/components/ui/Tooltip'
import { ToastProvider } from '@/components/ui/Toast'
import useToast from '@/components/ui/useToast'
import {
  paletteSamples,
  students,
  sessions,
  competenceLevels,
  competencies,
  formValues,
  selectOptions,
  icons,
} from './designSystemData'

/* -------------------------------------------------------------------------- */
/* Helpers de demo                                                            */
/* -------------------------------------------------------------------------- */

/* Clases literales por token: sin estilos inline para que Tailwind las genere. */
const swatchClasses = {
  forest: 'bg-[#304744]',
  brand: 'bg-[#4CDB59]',
  mint: 'bg-[#E9F8EA]',
  canvas: 'bg-[#F8FAF6]',
  white: 'bg-[#FFFFFF]',
  ink: 'bg-[#263D48]',
  stone: 'bg-[#ABB1AB]',
}

function Swatch({ name, hex, usage, token }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6EAE3] bg-[#FFFFFF]">
      <div
        className={`h-20 w-full border-b border-[#E6EAE3] ${swatchClasses[token]}`}
        aria-hidden="true"
      />
      <div className="space-y-0.5 p-3">
        <p className="text-sm font-bold text-[#304744]">{name}</p>
        <p className="font-mono text-xs text-[#5A6B6A]">{hex}</p>
        <p className="text-xs text-[#7D8C8A]">{usage}</p>
        <p className="pt-1 font-mono text-[10px] uppercase text-[#2A7A35]">{token}</p>
      </div>
    </div>
  )
}

/** Disparadores de toast para la sección de feedback. */
function ToastButtons() {
  const toast = useToast()
  return (
    <Card title="Toasts" description="Aparecen abajo a la derecha y se cierran solos a los ~4s.">
      <div className="flex flex-wrap gap-2">
        <Button variant="subtle" size="sm" onClick={() => toast.success('Emparejamiento guardado.')}>
          Éxito
        </Button>
        <Button variant="subtle" size="sm" onClick={() => toast.info('Datos actualizados hace un momento.')}>
          Información
        </Button>
        <Button variant="subtle" size="sm" onClick={() => toast.warning('Quedan 3 estudiantes sin diagnóstico.')}>
          Advertencia
        </Button>
        <Button variant="dangerSoft" size="sm" onClick={() => toast.error('No se pudo sincronizar con Firestore.')}>
          Error
        </Button>
      </div>
      <p className="mt-3 text-xs text-[#7D8C8A]">
        Uso: <code className="font-mono">const toast = useToast()</code> →{' '}
        <code className="font-mono">toast.success(&quot;…&quot;)</code>. Requiere{' '}
        <code className="font-mono">&lt;ToastProvider&gt;</code> en el árbol.
      </p>
    </Card>
  )
}

function Section({ id, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-tight text-[#304744]">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-[#5A6B6A]">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Playground() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checked, setChecked] = useState(true)
  const [grade, setGrade] = useState('9')
  const [hasError, setHasError] = useState(false)
  const [busyField, setBusyField] = useState(false)
  const toast = useToast()

  const runFakeSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success('Sesión guardada correctamente.')
    }, 1200)
  }

  const runFakeLoad = () => {
    setBusyField(true)
    setHasError(false)
    setTimeout(() => setBusyField(false), 1400)
  }

  const runFakeError = () => {
    setHasError(true)
    setTimeout(() => setHasError(false), 1400)
  }

  return (
    <div className="space-y-4">
      <Card
        title="Acciones"
        description="Interacción simulada: los botones no llaman a ningún servicio."
        actions={<Badge tone="brand" dot>Demo</Badge>}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runFakeSave} loading={saving} icon="check">
              Guardar
            </Button>
            <Button variant="secondary" onClick={() => toast.info('Acción secundaria simulada.')}>
              Secondary
            </Button>
            <Button variant="subtle" onClick={() => toast.warning('Sesión sinonyms: revisa las fechas.')}>
              Subtítulo
            </Button>
            <Button variant="ghost" onClick={() => toast.info('Acción terciaria.')}>
              Ghost
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)} icon="trash">
              Eliminar
            </Button>
            <Button variant="dangerSoft" onClick={() => setConfirmOpen(true)}>
              dangerSoft
            </Button>
            <Button disabled>Deshabilitado</Button>
            <Button icon="plus" iconPosition="left">
              Con icono
            </Button>
            <Button variant="secondary" icon="arrowRight" iconPosition="right">
              Con icono derecha
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">sm</Button>
            <Button size="md">md</Button>
            <Button size="lg">lg</Button>
            <Button variant="subtle" fullWidth className="max-w-xs">
              fullWidth
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button to="/design-system" variant="secondary" icon="link">
              Como Link
            </Button>
            <Button variant="ghost" loading>
              Cargando
            </Button>
            <Button onClick={() => setModalOpen(true)} icon="external">
              Abrir modal
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setLoading((v) => !v)
                toast.info(loading ? 'Se canceló la carga.' : 'Cargando datos…')
              }}
              icon="refresh"
            >
              {loading ? 'Cancelar carga' : 'Simular carga'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Formularios" description="Estados por defecto, con error, con carga y deshabilitado.">
        <div className="grid gap-5 md:grid-cols-2">
          <Input
            label="Nombre completo"
            placeholder="Ana Torres"
            icon="users"
            hint="Tal como aparece en el certificado."
            labelRight={<button type="button" className="text-xs font-semibold text-[#2A7A35]">Ayuda</button>}
          />
          <Input
            label="Correo institucional"
            type="email"
            defaultValue={formValues.email}
            icon="link"
            error={hasError ? 'Este correo ya está registrado.' : undefined}
            hint="Recibirás aquí las invitaciones a sesionar."
            onChange={() => hasError && setHasError(false)}
          />
          <Select label="Grado" value={grade} onChange={(e) => setGrade(e.target.value)} options={selectOptions} required />
          <Input
            label="Buscando en vivo"
            loading={busyField}
            defaultValue="Álgebra"
            hint="Simula una consulta remota."
            onFocus={runFakeLoad}
          />
          <Input label="Campo deshabilitado" disabled defaultValue="No editable" />
          <Input
            label="Con error y sin pista"
            error="Este valor es obligatorio."
          />
          <Textarea
            label="Objetivo de la sesión"
            rows={3}
            defaultValue={formValues.topic}
            hint="Máx. 200 caracteres."
          />
          <div className="space-y-4 md:col-span-2">
            <Checkbox
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              label="Quiero recibir sugerencias del Tutor IA"
              description="Un correo por semana, sin publicidad."
            />
            <Checkbox disabled label="Opción deshabilitada" description="Requiere verificación docente." />
            <RadioGroup
              label="Modalidad de la sesión"
              name="demo-modality"
              value="meet"
              onChange={() => {}}
              options={[
                { value: 'meet', label: 'Google Meet', hint: 'Se genera el enlace al confirmar' },
                { value: 'presencial', label: 'Presencial' },
                { value: 'chat', label: 'Solo chat con Tutor IA' },
              ]}
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button loading={saving} onClick={runFakeSave}>
            Guardar cambios
          </Button>
          <Button variant="secondary" onClick={runFakeError}>
            Forzar error
          </Button>
          <Button variant="ghost" onClick={() => toast.success('Listo.')}>
            Limpiar
          </Button>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Crear sesión de emparejamiento"
        description="KoEduko generará un enlace de Meet para la pareja complementaria."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => { setModalOpen(false); toast.success('Sesión creada.') }}>
              Crear sesión
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="info" title="Sugerencia">
            Los mejores pares se forman cuando la diferencia de nivel es de 1 a 2 etapas.
          </Alert>
          <Input label="Tema" defaultValue={formValues.topic} />
          <Textarea label="Objetivo" rows={3} defaultValue="Practicar factorización y Roots." />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          toast.success('Elemento eliminado (simulado).')
        }}
        title="¿Eliminar esta sesión?"
        description="La sesión del 12 oct dejará de estar visible para ambos participantes."
        confirmLabel="Sí, eliminar"
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Página                                                                      */
/* -------------------------------------------------------------------------- */

function Content() {
  const [section, setSection] = useState('colores')

  const demoSections = [
    { id: 'colores', title: 'Colores' },
    { id: 'tipografia', title: 'Tipografía' },
    { id: 'botones', title: 'Botones' },
    { id: 'tarjetas', title: 'Tarjetas y progreso' },
    { id: 'badges', title: 'Badges y avatares' },
    { id: 'formularios', title: 'Formularios' },
    { id: 'estados', title: 'Estados' },
    { id: 'feedback', title: 'Alertas y toasts' },
    { id: 'modales', title: 'Modales' },
    { id: 'iconos', title: 'Iconos' },
    { id: 'logo', title: 'Logo' },
    { id: 'layout', title: 'Layout y responsive' },
  ]

  return (
    <>
      <PageBody>
        <Breadcrumbs
          items={[
            { label: 'KoEduko', to: '/design-system' },
            { label: 'Sistema de diseño' },
          ]}
        />
        <PageHeader
          eyebrow="Design system · v1"
          title="KoEduko UI"
          description="Todas las primitivas de la plataforma en una página: variantes, estados y comportamiento responsive. Todos los datos son simulados y no tocan Firebase ni el matching."
          badge={<Badge tone="brand" dot>Sin dependencias nuevas</Badge>}
          actions={
            <>
              <Button variant="ghost" icon="refresh" onClick={() => window.location.reload()}>
                Reiniciar
              </Button>
            </>
          }
        />

        <nav aria-label="Secciones del sistema" className="mb-8">
          <div className="flex flex-wrap gap-2">
            {demoSections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={section === s.id ? 'true' : undefined}
                onClick={() => setSection(s.id)}
                className={[
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/40',
                  section === s.id
                    ? 'bg-[#304744] text-white'
                    : 'bg-[#E9F8EA] text-[#2A7A35] hover:bg-[#DDF3DD]',
                ].join(' ')}
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-12">
          {/* ---------------------------------------------------------- */}
          <Section
            id="colores"
            title="Colores"
            description="Cinco colores de marca. El verde principal se usa como relleno de acción, nunca como texto sobre blanco (no alcanza el contraste AA)."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {paletteSamples.map((s) => (
                <Swatch key={s.token} {...s} />
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Card title="Contraste" description="Verificado contra WCAG 2.1 AA.">
                <ul className="space-y-2 text-sm text-[#5A6B6A]">
                  <li className="flex items-center justify-between">
                    <span>Verde bosque sobre blanco</span>
                    <Badge tone="success">AA 8.9:1</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Texto de acción sobre verde</span>
                    <Badge tone="success">AA 7.4:1</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Verde principal sobre blanco</span>
                    <Badge tone="warning">Solo decorativo</Badge>
                  </li>
                </ul>
              </Card>
              <Card title="Fondos" description="Dos niveles de superficie.">
                <div className="space-y-2">
                  <div className="rounded-xl border border-[#E6EAE3] bg-[#F8FAF6] p-4 text-sm text-[#304744]">
                    Verde muy claro · fondo de página
                  </div>
                  <div className="rounded-xl border border-[#E6EAE3] bg-[#FFFFFF] p-4 text-sm text-[#304744]">
                    Blanco cálido · tarjetas
                  </div>
                  <div className="rounded-xl border border-[#E6EAE3] bg-[#E9F8EA] p-4 text-sm text-[#2A7A35]">
                    Verde suave · acento y éxito
                  </div>
                </div>
              </Card>
              <Card title="Semánticos" description="Para estados que no son de marca.">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="danger">Error</Badge>
                  <Badge tone="warning">Advertencia</Badge>
                  <Badge tone="info">Información</Badge>
                  <Badge tone="neutral">Neutral</Badge>
                  <Badge tone="outline">Contorno</Badge>
                </div>
              </Card>
            </div>
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section
            id="tipografia"
            title="Tipografía"
            description="Escala tipográfica. Los títulos usan la pila Nunito (con fallback de sistema) y el texto corriente usa la pila sans por defecto."
          >
            <Card>
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A7A35]">
                  overline · Etiqueta de sección
                </p>
                <p className="text-3xl font-bold tracking-tight text-[#304744] sm:text-4xl">
                  Display · Emparejamiento por complementariedad
                </p>
                <h2 className="text-xl font-bold tracking-tight text-[#304744] sm:text-2xl">
                  Título de vista
                </h2>
                <p className="text-base font-semibold text-[#304744] sm:text-lg">Subtítulo</p>
                <p className="text-sm leading-relaxed text-[#5A6B6A]">
                  Cuerpo de texto: 14/1.6. La medida máxima recomendada es de 65 caracteres;
                  en tarjetas mantenemos el ancho con <code className="rounded bg-[#F8FAF6] px-1.5 py-0.5 font-mono text-xs">max-w-2xl</code>.
                </p>
                <p className="text-xs text-[#7D8C8A]">
                  Texto auxiliar · 12px · metadatos, fechas y unidades
                </p>
                <p className="font-mono text-sm text-[#5A6B6A]">Mono · identificadores y código</p>
              </div>
            </Card>
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section id="botones" title="Botones" description="Interacciones simuladas, sin efectos secundarios.">
            <Playground />
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section id="tarjetas" title="Tarjetas y progreso" description="Cuatro variantes de superficie.">
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="Tarjeta estándar" description="Superficie principal con sombra suave.">
                <p className="text-sm text-[#5A6B6A]">
                  Por defecto lleva borde tenue, esquinas amplias y elevación mínima.
                </p>
              </Card>
              <Card variant="flat" title="Tarjeta plana" description="Para listas densas o tablas.">
                <p className="text-sm text-[#5A6B6A]">Sin sombra: el borde hace el trabajo.</p>
              </Card>
              <Card variant="accent" title="Tarjeta de acento" description="Zonas de énfasis o estado positivo.">
                <p className="text-sm text-[#2A7A35]">Ideal para sugerir el siguiente paso.</p>
              </Card>
              <Card variant="sunken" title="Tarjeta hundida" description="Datos, código o contenido secundario.">
                <p className="text-sm text-[#5A6B6A]">Contraste suave frente a la tarjeta normal.</p>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card
                title="Competencias (datos simulados)"
                description="Barras de acceso con rol de accesibilidad progressbar."
              >
                <div className="space-y-3.5">
                  {competenceLevels.map((c) => (
                    <ProgressBar key={c.label} label={c.label} value={c.value} />
                  ))}
                </div>
              </Card>
              <Card title="Tonos de progreso" description="Se eligen por semántica, no por decoración.">
                <div className="space-y-3.5">
                  <ProgressBar tone="brand" label="Dominado" value={0.9} />
                  <ProgressBar tone="info" label="En progreso" value={0.55} />
                  <ProgressBar tone="warning" label="En riesgo" value={0.3} />
                  <ProgressBar tone="danger" label="Crítico" value={0.12} />
                </div>
              </Card>
            </div>

            <Card
              className="mt-4"
              interactive
              title="Tarjeta interactiva"
              description="Se eleva al hacer hover. Úsala cuando toda la superficie sea un enlace."
            >
              <p className="text-sm text-[#5A6B6A]">
                Pasa el cursor por encima para ver la elevación y el borde de marca.
              </p>
            </Card>
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section id="badges" title="Badges y avatares" description="Roles, estados e identidad.">
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="Badges">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">Docente</Badge>
                  <Badge tone="info">Estudiante</Badge>
                  <Badge tone="forest">Admin</Badge>
                  <Badge tone="success">Confirmada</Badge>
                  <Badge tone="warning">Pendiente</Badge>
                  <Badge tone="danger">Cancelada</Badge>
                  <Badge tone="neutral">Borrador</Badge>
                  <Badge tone="outline">Archivada</Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge tone="brand" dot>En vivo</Badge>
                  <Badge tone="success" icon="check">Verificada</Badge>
                  <Badge tone="info" icon="video" size="sm">Meet</Badge>
                  <Badge tone="neutral" size="sm">sm</Badge>
                </div>
                <p className="mt-4 text-xs text-[#7D8C8A]">
                  Los tonos <code className="font-mono">slate / indigo / green / amber / red</code> del diseño
                  anterior siguen funcionando como alias.
                </p>
              </Card>
              <Card title="Avatares">
                <div className="flex flex-wrap items-center gap-4">
                  {students.map((s, i) => (
                    <div key={s.name} className="flex flex-col items-center gap-1.5">
                      <Avatar name={s.name} size={i === 0 ? 'lg' : 'md'} showStatus={i < 2} />
                      <span className="text-xs text-[#5A6B6A]">{s.name.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {['xs', 'sm', 'md', 'lg', 'xl'].map((s) => (
                    <div key={s} className="flex flex-col items-center gap-1">
                      <Avatar name="Sofía Herrera" size={s} />
                      <span className="text-[10px] text-[#7D8C8A]">{s}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section
            id="formularios"
            title="Formularios"
            description="Etiqueta, pista, error y carga. Se muestran arriba, en la tarjeta de Playground."
          >
            <Alert tone="info" title="Dónde viven los formularios">
              En <code className="font-mono">@/components/ui/Field</code>. El label se asocia por
              id automáticamente y el error se anuncia con rol <code className="font-mono">alert</code>.
            </Alert>
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section id="estados" title="Estados" description="Carga, error y vacío. Se usan dentro de cualquier vista.">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Carga">
                <LoadingState label="Calculando compatibilidad…" compact inline />
              </Card>
              <Card title="Carga compacta">
                <LoadingState label="Guardando" compact inline />
              </Card>
              <Card title="Spinner suelto">
                <div className="flex items-center gap-4 py-6">
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                </div>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ErrorState
                error="No se pudo alcanzar Firestore. Revisa tu conexión e inténtalo de nuevo."
                onRetry={() => window.alert('Reintento simulado')}
              />
              <ErrorState error={new Error('Timeout en la consulta de aceptaciones')} compact />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <EmptyState
                icon="users"
                title="Aún no hay parejas"
                description="Cuando completes el diagnóstico de dos o más estudiantes, aquí aparecerán las parejas sugeridas."
                action={<Button icon="sparkles">Generar propuestas</Button>}
              />
              <EmptyState
                compact
                icon="calendar"
                title="Sin sesiones próximas"
                description="Abre el emparejamiento para crear la primera sesión."
              />
            </div>

            <Card
              className="mt-4"
              title="Skeletons"
              description="Para listas: mantienen la altura y evitan saltos de layout."
            >
              <div className="space-y-4">
                <SkeletonRow />
                <SkeletonRow />
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-24" rounded="lg" />
                  <Skeleton className="h-10 w-32" rounded="lg" />
                </div>
              </div>
            </Card>
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section id="feedback" title="Alertas y toasts" description="Confirmaciones y errores no bloqueantes.">
            <div className="space-y-3">
              <Alert tone="success" title="Emparejamiento actualizado">
                Se recalcularon 6 parejas con los nuevos diagnósticos.
              </Alert>
              <Alert tone="warning" title="Falta un diagnóstico">
                Tres estudiantes todavía no han respondido el cuestionario.
              </Alert>
              <Alert tone="error" title="No se pudo crear la sesión">
                El enlace de Meet no es válido. Vuelve a generarlo.
              </Alert>
              <Alert tone="info" compact>
                Datos simulados: la vista previa no ejecuta ninguna operación real.
              </Alert>
            </div>

            <ToastButtons />
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section
            id="modales"
            title="Modales"
            description="Foco atrapado, cierre con Escape, scroll bloqueado y devolución del foco."
          >
            <Alert tone="info" title="Abrilos desde la sección de botones">
              El botón «Abrir modal» y el de eliminar abren estos diálogos con datos simulados.
            </Alert>
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section id="iconos" title="Iconos" description={`${icons.length} iconos SVG inline, sin dependencias.`}>
            <Card>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                {icons.map((name) => (
                  <Tooltip key={name} content={name}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-[#E6EAE3] bg-[#FFFFFF] p-2.5 text-[#304744] transition-colors duration-150 hover:border-[#4CDB59] hover:bg-[#E9F8EA] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4CDB59]/40"
                    >
                      <Icon name={name} className="h-5 w-5" />
                      <span className="w-full truncate text-[10px] text-[#7D8C8A]">{name}</span>
                    </button>
                  </Tooltip>
                ))}
              </div>
              <p className="mt-4 text-xs text-[#7D8C8A]">
                Lista oficial: <code className="font-mono">{iconNames.length}</code> nombres exportados
                como <code className="font-mono">iconNames</code>.
              </p>
            </Card>
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section
            id="logo"
            title="Logo y marca"
            description="Recursos oficiales de public/logo, siempre con object-contain y dimensiones declaradas."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Card title="Completo" description="Koala + tipografía, para navbar y login.">
                <div className="flex min-h-28 items-center justify-center rounded-2xl bg-[#F8FAF6] p-4">
                  <Logo variant="full" size="xl" />
                </div>
              </Card>
              <Card title="Símbolo" description="Solo la cabeza del koala, para sidebar.">
                <div className="flex min-h-28 items-center justify-center gap-5 rounded-2xl bg-[#304744] p-4">
                  <Logo variant="mark" size="xl" onDark />
                  <Logo variant="mark" size="md" onDark />
                  <Logo variant="mark" size="sm" onDark />
                </div>
              </Card>
              <Card title="Sobre blanco" description="Marco para fondos claros.">
                <div className="flex min-h-28 items-center justify-center rounded-2xl bg-white p-4">
                  <Logo variant="full" size="lg" />
                </div>
              </Card>
            </div>
          </Section>

          {/* ---------------------------------------------------------- */}
          <Section
            id="layout"
            title="Layout y responsive"
            description="Estructura de aplicación, tablas y grillas."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Sesiones (datos simulados)" description="Lista de ejemplo con badges de estado.">
                <ul className="divide-y divide-[#E6EAE3]">
                  {sessions.map((s) => (
                    <li key={s.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Avatar name={s.title} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#304744]">{s.title}</p>
                        <p className="text-xs text-[#7D8C8A]">{s.date}</p>
                      </div>
                      <Badge
                        tone={
                          s.status === 'completed'
                            ? 'success'
                            : s.status === 'scheduled'
                              ? 'info'
                              : 'neutral'
                        }
                      >
                        {s.status === 'completed'
                          ? 'Realizada'
                          : s.status === 'scheduled'
                            ? 'Programada'
                            : 'Cancelada'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Pares sugeridos (datos simulados)" description="Puntaje de complementariedad.">
                <ul className="space-y-3">
                  {competencies.map((c) => (
                    <li key={c.name} className="flex items-center gap-3">
                      <Avatar name={c.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#304744]">{c.name}</p>
                        <p className="text-xs text-[#7D8C8A]">{c.role}</p>
                      </div>
                      <Badge tone={c.tone}>{c.complement}%</Badge>
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" icon="users" className="mt-4">
                  Ver todas las parejas
                </Button>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Card variant="sunken" padding="sm" className="text-center">
                <p className="text-2xl font-bold text-[#304744]">24</p>
                <p className="text-xs text-[#5A6B6A]">Estudiantes</p>
              </Card>
              <Card variant="sunken" padding="sm" className="text-center">
                <p className="text-2xl font-bold text-[#304744]">12</p>
                <p className="text-xs text-[#5A6B6A]">Parejas</p>
              </Card>
              <Card variant="sunken" padding="sm" className="text-center">
                <p className="text-2xl font-bold text-[#304744]">37</p>
                <p className="text-xs text-[#5A6B6A]">Sesiones</p>
              </Card>
              <Card variant="sunken" padding="sm" className="text-center">
                <p className="text-2xl font-bold text-[#2A7A35]">89%</p>
                <p className="text-xs text-[#5A6B6A]">Compatibilidad media</p>
              </Card>
            </div>

            <Alert
              className="mt-4"
              tone="info"
              title="Responsive"
              description="La grilla se prueba a 375px, 768px y 1280px. Redimensiona la ventana: el shell de la página ya está activo."
            />
          </Section>
        </div>
      </PageBody>
    </>
  )
}

export default function DesignSystemPage() {
  return (
    <ToastProvider>
      <Content />
    </ToastProvider>
  )
}
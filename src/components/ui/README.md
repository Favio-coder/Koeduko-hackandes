# KoEduko UI — Sistema de diseño

Primitivas de interfaz de KoEduko: accesibles, responsive y sin dependencias nuevas.
Todo el estilo es **Tailwind CSS v4 con utilidades literales** — no hay CSS
personalizado ni `tailwind.config.js`; los tokens viven en JS.

---

## 1. Importación

Siempre desde el barrel, nunca por ruta interna:

```jsx
import { Button, Card, Badge, Input, Modal, EmptyState } from '@/components/ui'
import { AppShell } from '@/components/layout-kit'
```

## 2. Tokens

`src/components/ui/tokens.js`

| Token | Hex | Uso |
| --- | --- | --- |
| `forest` | `#304744` | Sidebar, títulos, superficies oscuras |
| `brand` | `#4CDB59` | Acción primaria, acentos, ruta activa |
| `mint` | `#E9F8EA` | Fondos suaves, badges, estados positivos |
| `canvas` | `#F8FAF6` | Fondo de página |
| `white` | `#FFFFFF` | Superficie de tarjetas |
| `ink` | `#263D48` | Texto de máxima legibilidad |
| `stone` | `#ABB1AB` | Bordes, metadatos, texto deshabilitado |

Los valores salen de los propios logos (`public/logo/`): muestreados, predominan
`#304040`–`#305050` (bosque) y `#60E070` (verde brillante).

> **Contraste:** `#4CDB59` **no** alcanza AA como texto sobre blanco. Úsalo siempre
> como fondo (con texto `#263D48`) o como detalle decorativo. El texto va en
> `forest` / `#5A6B6A`.

### Logo

`Logo` reutiliza los recursos oficiales, sin generar nuevos logos:

```jsx
<Logo variant="full" size="md" />        // koala + tipografía (navbar, login)
<Logo variant="mark" size="md" onDark /> // símbolo, para sidebar verde bosque
```

Usa `object-contain` + `width/height` declarados. El PNG original pesa 1.6 MB,
por lo que se referencian derivados reducidos de la **misma imagen**
(`koeduko-128.png` 19 KB, `koeduko-512.png` 146 KB); los originales quedan
intactos.

El archivo además exporta mapas de clases ya compuestas (`colors`, `text`,
`radius`, `shadow`, `motion`, `focusRing`, `surfaceCard`) para quien necesite
construir un componente propio sin reinventar valores.

### Por qué los tokens están en JS

Tailwind v4 lee `@theme` desde CSS, pero el proyecto no tiene CSS propio. Como el
escáner de Tailwind solo detecta clases **escritas literalmente**, el sistema usa
utilidades arbitrarias completas (`bg-[#4CDB59]`) guardadas en mapas. **Regla para
quien agregue clases:** nunca interpolar (`bg-[${c}]` no se generará); escribir la
clase entera o añadirla al mapa de tokens.

## 3. Componentes

### Botón — `Button`

```jsx
<Button onClick={guardar} icon="check">Guardar</Button>
<Button variant="secondary" to="/sessions">Ver sesiones</Button>
<Button loading={guardando}>Guardando…</Button>
```

- Variantes: `primary` · `secondary` · `ghost` · `subtle` · `danger` · `dangerSoft`
- Tamaños: `sm` · `md` · `lg`
- Props: `loading`, `icon`, `iconPosition`, `fullWidth`, `to` (Link), `as`

### Superficies — `Card`, `CardLink`, `Badge`, `ProgressBar`

```jsx
<Card title="Pares" description="Sugerencias del sistema" actions={<Button size="sm">Ver</Button>}>
  …
</Card>

<Badge tone="brand" dot>En vivo</Badge>
<ProgressBar label="Álgebra" value={0.6} tone="info" />
```

- `Card` variantes: `default` · `flat` · `accent` · `sunken`; padding `none|sm|md|lg`
- `Badge` tonos: `brand` `forest` `success` `warning` `danger` `info` `neutral` `outline`
  (alias legacy `slate|indigo|green|amber|red` siguen funcionando)
- `ProgressBar` expone `role="progressbar"` con `aria-valuenow`

### Formularios — `Field.jsx`

```jsx
<Input label="Correo" icon="link" hint="Recibirás aquí las invitaciones." />
<Input label="Correo" error="Este correo ya está registrado." />
<Select label="Grado" options={[{ value: '9', label: 'Noveno' }]} />
<Textarea label="Objetivo" rows={3} />
<Checkbox label="Quiero recibir sugerencias" />
<RadioGroup label="Modalidad" name="m" options={[…]} value={v} onChange={setV} />
```

El `<label>` se asocia por id automáticamente; el error se anuncia con
`role="alert"` y `aria-describedby`.

### Overlays — `Modal`, `ConfirmDialog`

```jsx
<Modal open={open} onClose={cerrar} title="Crear sesión" description="…" footer={<><Button variant="ghost" onClick={cerrar}>Cancelar</Button><Button onClick={crear}>Crear</Button></>}>
  …
</Modal>

<ConfirmDialog open={open} onClose={cerrar} onConfirm={borrar} confirmLabel="Sí, eliminar" />
```

Cierra con `Escape`, bloquea el scroll del body, atrapa el foco y lo devuelve al
elemento de origen.

### Estado — `States.jsx`

```jsx
<LoadingState label="Calculando compatibilidad…" />
<ErrorState error={err} onRetry={reintentar} />
<EmptyState icon="users" title="Aún no hay parejas" action={<Button>Generar</Button>} />
<Spinner /><SkeletonRow />
```

### Feedback — `Alert`, `Toast`

```jsx
<Alert tone="warning" title="Falta un diagnóstico">Tres estudiantes sin responder.</Alert>
```

```jsx
// 1) Monta el provider una vez (en App.jsx, junto a AuthProvider)
<ToastProvider>…</ToastProvider>
// 2) En la vista
const toast = useToast()
toast.success('Sesión guardada.')
```

`useToast` nunca lanza: si falta el provider devuelve no-ops.

### Varios — `Icon`, `Avatar`, `Tooltip`, `PageHeader`, `Breadcrumbs`, `PageBody`

```jsx
<Icon name="koala" />                          // 35 iconos, SVG inline
<Avatar name="Ana Torres" size="lg" showStatus />
<Tooltip content="Puntaje de complementariedad"><button… /></Tooltip>
<PageHeader eyebrow="Docencia" title="Emparejamiento" description="…" actions={<Button/>} />
<Breadcrumbs items={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Matching' }]} />
```

## 4. Layout — `@/components/layout-kit`

```jsx
<AppShell onLogout={logout}>
  <MatchingResultsPage />
</AppShell>
```

- Navbar fija, sidebar en escritorio (`lg`), drawer en móvil con `Escape`.
- Enlace de salto al contenido principal.
- El menú se filtra por rol con `itemsForRole(role)` (`navConfig.js`).
- El shell real está en `@/components/layout` (`DashboardLayout`, `Navbar`,
  `Sidebar`, `AuthLayout`); `layout-kit/navConfig.js` es la fuente única de rutas
  y títulos que consumen sidebar y navbar.

### Rutas de navegación (todas conservadas)

`Principal` `/dashboard` · `Curso` `/assessments` · `Estudiantes`
`/dashboard/teacher` (solo docente) · `Emparejamiento` `/matching` ·
`Resultados` `/matching/results` · `Salas` `/sessions` · `Sesión activa`
`/sessions/demo-session-1` · `Tutor IA` `/sessions/demo-session-1/tutor`.

## 5. Vista previa

`src/pages/design-system/DesignSystemPage.jsx` — 11 secciones con datos 100 %
simulados, sin Firebase ni red. Incluye un toggle para verla dentro del `AppShell`.

**Para exponerla en `/design-system`** (único cambio en archivo compartido, 2 líneas):

```jsx
// src/app/app/router.jsx
const DesignSystemPage = lazy(() => import('@/pages/design-system/DesignSystemPage'))
// dentro de <Routes>, fuera de ProtectedRoute:
<Route path="/design-system" element={<DesignSystemPage />} />
```

Montaje temporal sin tocar el router: en `src/App.jsx`, envolver `<AppRouter />`
dentro de `<MemoryRouter>` no aplica (usa `BrowserRouter`). Lo más limpio sigue
siendo la ruta de arriba, o añadir el import directo en `main.jsx` para una
demo efímera.

## 6. Reglas para quien extienda el sistema

1. Importar desde `@/components/ui`, nunca por ruta interna.
2. Sin dependencias nuevas (los iconos son SVG inline).
3. Clases Tailwind **literales**; nada de interpolación.
4. Todo control interactivo con foco visible (`focus-visible`) y etiquetado.
5. Respetar contraste AA; texto en `forest`, no en `brand`.
6. Probar a 375px, 768px y 1280px antes de dar por terminado algo.
7. Añadir test en `designSystem.test.jsx` si el componente expone contrato público.
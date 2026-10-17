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
| `forest` | `#31494A` | Texto principal, títulos, superficies oscuras |
| `brand` | `#62DD6B` | Relleno de acción primaria, acentos, éxito |
| `mist` | `#F6FAF2` | Fondo de página |
| `cream` | `#FFFEFD` | Superficie de tarjetas |
| `stone` | `#ABB1AB` | Bordes, metadatos, texto deshabilitado |

> **Contraste:** `#62DD6B` **no** alcanza AA como texto sobre blanco. Úsalo siempre
> como fondo (con texto `#22302F`) o como detalle decorativo. El texto va en
> `forest` / `#5C6A69`.

El archivo además exporta mapas de clases ya compuestas (`colors`, `text`,
`radius`, `shadow`, `motion`, `focusRing`, `surfaceCard`) para quien necesite
construir un componente propio sin reinventar valores.

### Por qué los tokens están en JS

Tailwind v4 lee `@theme` desde CSS, pero el proyecto no tiene CSS propio. Como el
escáner de Tailwind solo detecta clases **escritas literalmente**, el sistema usa
utilidades arbitrarias completas (`bg-[#62DD6B]`) guardadas en mapas. **Regla para
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
- El menú se filtra por rol con `sectionsForRole(role)` (`navConfig.js`).
- Por defecto lee usuario/rol de `AuthContext`, pero todo se puede pasar por props.

> `src/components/layout/*` (el layout actual) **no se tocó**: es territorio de DEV 1.
> `layout-kit` convive con él para que cada quien migre cuando quiera.

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
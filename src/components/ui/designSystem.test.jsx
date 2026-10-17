/**
 * Pruebas de humo del sistema de diseño.
 *
 * Verifican contrato de renderizado y accesibilidad básica, sin depender de
 * Firebase ni del router (los componentes que usan `Link` se prueban envueltos
 * en `MemoryRouter`).
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Alert from '@/components/ui/Alert'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Field'
import Icon from '@/components/ui/Icon'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { iconNames } from '@/components/ui/iconNames'
import { palette } from '@/components/ui/tokens'

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('Button', () => {
  it('renderiza como button por defecto con type="button"', () => {
    render(<Button>Guardar</Button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button')
  })

  it('expone aria-busy y no dispara onClick mientras carga', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Guardar</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
  })

  it('renderiza un Link cuando recibe `to`', () => {
    wrap(<Button to="/sessions">Sesiones</Button>)
    expect(screen.getByRole('link', { name: 'Sesiones' })).toHaveAttribute('href', '/sessions')
  })
})

describe('Card / Badge / ProgressBar', () => {
  it('muestra título y descripción', () => {
    render(<Card title="Pares" description="Sugerencias del sistema">contenido</Card>)
    expect(screen.getByRole('heading', { name: 'Pares' })).toBeInTheDocument()
    expect(screen.getByText('Sugerencias del sistema')).toBeInTheDocument()
  })

  it('Badge acepta tonos nuevos y alias legacy', () => {
    const { rerender } = render(<Badge tone="brand">Docente</Badge>)
    expect(screen.getByText('Docente')).toBeInTheDocument()
    rerender(<Badge tone="indigo">Legacy</Badge>)
    expect(screen.getByText('Legacy')).toBeInTheDocument()
  })

  it('ProgressBar recorta valores fuera de rango y expone el ARIA correcto', () => {
    render(<ProgressBar label="Álgebra" value={1.8} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
  })
})

describe('Formularios', () => {
  it('asocia la etiqueta y anuncia el error', () => {
    render(<Input label="Correo" error="Correo inválido" />)
    const input = screen.getByLabelText(/Correo/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Correo inválido')
  })

  it('Select con placeholder deshabilitado', () => {
    render(
      <Select
        label="Grado"
        options={[{ value: '', label: 'Elige…', disabled: true }, { value: '9', label: 'Noveno' }]}
      />,
    )
    expect(screen.getByLabelText('Grado')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Elige…' })).toBeDisabled()
  })
})

describe('Estados', () => {
  it('LoadingState es un status con etiqueta', () => {
    render(<LoadingState label="Cargando sesiones" />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando sesiones')
    expect(screen.getByRole('status')).toHaveClass('fixed', 'inset-0', 'z-[100]')
    expect(screen.getByRole('status')).toHaveClass('bg-[#F8FAF6]/75', 'backdrop-blur-sm')
    expect(document.querySelector('video').parentElement).toHaveClass(
      'h-40',
      'w-40',
      'sm:h-56',
      'sm:w-56',
    )
    expect(document.querySelector('video')).toHaveAttribute('src', '/carga/carga.mp4')
    expect(document.querySelector('video')).toHaveProperty('muted', true)
    expect(screen.getByRole('status').querySelector('.animate-spin')).not.toBeInTheDocument()
  })

  it('permite mostrar la carga dentro del contenido cuando se marca inline', () => {
    render(<LoadingState label="Cargando vista previa" compact inline />)
    expect(screen.getByRole('status')).not.toHaveClass('fixed')
    expect(document.querySelector('video').parentElement).toHaveClass('h-12', 'w-12')
  })

  it('los botones en estado loading usan el video de marca', () => {
    render(<Button loading>Guardando</Button>)
    expect(document.querySelector('video')).toHaveAttribute('src', '/carga/carga.mp4')
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
  })

  it('ErrorState muestra el mensaje del error y el reintento', () => {
    const onRetry = vi.fn()
    render(<ErrorState error={new Error('Firestore no disponible')} onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Firestore no disponible')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('EmptyState muestra título y acción', () => {
    render(<EmptyState title="Sin parejas" action={<Button>Generar</Button>} />)
    expect(screen.getByText('Sin parejas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar' })).toBeInTheDocument()
  })
})

describe('Icon / Avatar / Alert / tokens', () => {
  it('Icon es decorativo por defecto y expone title cuando corresponde', () => {
    const { container, rerender } = render(<Icon name="koala" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    rerender(<Icon name="koala" title="Koala" />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('Icon con nombre inválido no renderiza nada', () => {
    const { container } = render(<Icon name="no-existe" />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('Avatar deriva iniciales a partir del nombre', () => {
    render(<Avatar name="Ana Torres" />)
    expect(screen.getByText('AT')).toBeInTheDocument()
  })

  it('Alert de error usa role="alert" y los avisos usan status', () => {
    const { rerender } = render(<Alert tone="error" title="Falló" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Falló')
    rerender(<Alert tone="success" title="Listo" />)
    expect(screen.getByRole('status')).toHaveTextContent('Listo')
  })

  it('los tokens de marca son los del logo', () => {
    expect(palette).toEqual({
      forest: '#304744',
      brand: '#4CDB59',
      mint: '#E9F8EA',
      canvas: '#F8FAF6',
      white: '#FFFFFF',
      ink: '#263D48',
      stone: '#ABB1AB',
    })
  })

  it('el set de iconos está completo y tiene el koala', () => {
    expect(iconNames).toContain('koala')
    expect(iconNames.length).toBeGreaterThan(25)
  })
})
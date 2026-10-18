import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConnectGoogle from './ConnectGoogle'

describe('ConnectGoogle', () => {
  it('shows "No conectada" and sends the teacher to Google when they connect', async () => {
    const navigate = vi.fn()
    render(<ConnectGoogle fetchStatus={vi.fn().mockResolvedValue(false)} requestUrl={vi.fn().mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth?x=1')} navigate={navigate} />)

    expect(await screen.findByText('No conectada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Conectar Google' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1'))
  })

  it('shows "Conectada" and offers to reconnect', async () => {
    render(<ConnectGoogle fetchStatus={vi.fn().mockResolvedValue(true)} requestUrl={vi.fn()} navigate={vi.fn()} />)
    expect(await screen.findByText('Conectada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a conectar' })).toBeInTheDocument()
  })

  it('renders nothing when the server has no Google configured (or cannot be reached): the manual link keeps working', async () => {
    const fetchStatus = vi.fn().mockRejectedValue(new Error('La conexion con Google no esta configurada en el servidor.'))
    const { container } = render(<ConnectGoogle fetchStatus={fetchStatus} />)
    await waitFor(() => expect(fetchStatus).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the error and lets the teacher retry when the authorization URL cannot be obtained', async () => {
    const requestUrl = vi.fn().mockRejectedValue(new Error('No se pudo conectar con el servidor de sesiones.'))
    render(<ConnectGoogle fetchStatus={vi.fn().mockResolvedValue(false)} requestUrl={requestUrl} navigate={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Google' }))
    expect(await screen.findByText('No se pudo conectar con el servidor de sesiones.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conectar Google' })).not.toBeDisabled()
  })
})

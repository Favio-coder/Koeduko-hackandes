import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RegistroAuxiliar from './RegistroAuxiliar'

const report = {
  estudiantes: [
    { key: 'ana torres', name: 'Ana Torres', capacidades: [{ id: 'traduce', estado: 'con evidencia', evidencias: [] }] },
    { key: 'luis perez', name: 'Luis Pérez', capacidades: [] },
  ],
}

describe('RegistroAuxiliar', () => {
  it('shows the formative note, the bimestre selector (default 1) and the download button', () => {
    render(<RegistroAuxiliar report={report} sessionId="accept-mem-1" download={vi.fn()} />)
    expect(screen.getByText(/Los calificativos los decide el docente antes de registrarlos en el SIAGIE/)).toBeInTheDocument()
    expect(screen.getByLabelText('Bimestre')).toHaveValue('1')
    expect(screen.getByRole('button', { name: 'Descargar registro auxiliar (Excel)' })).toBeInTheDocument()
  })

  it('downloads with NO grades when the teacher chose none', async () => {
    const download = vi.fn().mockResolvedValue('registro-auxiliar-accept-mem-1-bimestre1.xlsx')
    render(<RegistroAuxiliar report={report} sessionId="accept-mem-1" download={download} />)
    fireEvent.click(screen.getByRole('button', { name: 'Descargar registro auxiliar (Excel)' }))
    await waitFor(() => expect(download).toHaveBeenCalledWith({ report, sessionId: 'accept-mem-1', bimestre: 1, grades: {} }))
    expect(await screen.findByText(/registro-auxiliar-accept-mem-1-bimestre1\.xlsx/)).toBeInTheDocument()
  })

  it('sends the chosen bimestre and ONLY the grades the teacher selected', async () => {
    const download = vi.fn().mockResolvedValue('x.xlsx')
    render(<RegistroAuxiliar report={report} sessionId="s1" download={download} />)
    fireEvent.change(screen.getByLabelText('Bimestre'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Traduce de Ana Torres'), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText('Argumenta de Luis Pérez'), { target: { value: 'C' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descargar registro auxiliar (Excel)' }))
    await waitFor(() => expect(download).toHaveBeenCalled())
    expect(download.mock.calls[0][0]).toMatchObject({ bimestre: 3, grades: { 'ana torres': { traduce: 'A' }, 'luis perez': { argumenta: 'C' } } })
  })

  it('shows an error when the file cannot be generated, and renders nothing without students', async () => {
    render(<RegistroAuxiliar report={report} sessionId="s1" download={vi.fn().mockRejectedValue(new Error('x'))} />)
    fireEvent.click(screen.getByRole('button', { name: 'Descargar registro auxiliar (Excel)' }))
    expect(await screen.findByText('No se pudo generar el Excel. Inténtalo de nuevo.')).toBeInTheDocument()

    const { container } = render(<RegistroAuxiliar report={{ estudiantes: [] }} sessionId="s1" />)
    expect(container.querySelectorAll('section, h2').length).toBe(0)
  })
})

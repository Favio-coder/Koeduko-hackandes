import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/memoryNotesService', () => ({ forgetMemoryNote: vi.fn() }))

import MemoryNotes from './MemoryNotes'

const NOTES = [
  { key: 'estudiante a', text: 'Sesión s1, multiplicación: comunicó 75% del tiempo.', status: 'saved', via: 'atomicmemory', forgettable: true },
  { key: 'estudiante b', text: 'Sesión s1, multiplicación: comunicó 25% del tiempo.', status: 'failed', forgettable: false },
]
const NAMES = { 'estudiante a': 'Estudiante A', 'estudiante b': 'Estudiante B' }

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

const renderNotes = (props = {}) => render(<MemoryNotes sessionId="s1" uid="docente-1" notes={NOTES} names={NAMES} canForget {...props} />)
const rowOf = (name) => screen.getByText(name).closest('li')
const confirmForget = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Olvidar' }))

describe('MemoryNotes (teacher report)', () => {
  it('shows each note the tutor will read, with its real status, and offers to forget only the saved ones', () => {
    renderNotes()
    expect(screen.getByText('Lo que recordará el tutor')).toBeInTheDocument()
    expect(within(rowOf('Estudiante A')).getByText('Guardada para el tutor')).toBeInTheDocument()
    expect(within(rowOf('Estudiante A')).getByText(/comunicó 75%/)).toBeInTheDocument()
    expect(within(rowOf('Estudiante B')).getByText('No se guardó')).toBeInTheDocument()
    expect(within(rowOf('Estudiante B')).queryByRole('button', { name: 'Olvidar esta nota' })).toBeNull()
  })

  it('asks for confirmation, sends only the session and the participant, and marks it forgotten when the server confirms', async () => {
    const forget = vi.fn().mockResolvedValue({ status: 'forgotten', key: 'estudiante a', alreadyForgotten: false })
    renderNotes({ forget })
    fireEvent.click(within(rowOf('Estudiante A')).getByRole('button', { name: 'Olvidar esta nota' }))
    expect(forget).not.toHaveBeenCalled()
    await act(async () => confirmForget())
    expect(forget).toHaveBeenCalledWith({ sessionId: 's1', key: 'estudiante a' })
    expect(within(rowOf('Estudiante A')).getByText('Olvidada')).toBeInTheDocument()
    expect(within(rowOf('Estudiante A')).queryByRole('button', { name: 'Olvidar esta nota' })).toBeNull()
  })

  it('keeps the note as saved and says so when forgetting fails', async () => {
    const forget = vi.fn().mockRejectedValue(new Error('No se pudo olvidar la nota: sigue guardada.'))
    renderNotes({ forget })
    fireEvent.click(within(rowOf('Estudiante A')).getByRole('button', { name: 'Olvidar esta nota' }))
    await act(async () => confirmForget())
    expect(within(rowOf('Estudiante A')).getByText('Guardada para el tutor')).toBeInTheDocument()
    expect(within(rowOf('Estudiante A')).getByText(/sigue guardada/)).toBeInTheDocument()
  })

  it('a late answer from the previous account is never applied after switching accounts', async () => {
    const pending = deferred()
    const forget = vi.fn(() => pending.promise)
    const { rerender } = renderNotes({ forget })
    fireEvent.click(within(rowOf('Estudiante A')).getByRole('button', { name: 'Olvidar esta nota' }))
    await act(async () => confirmForget())

    rerender(<MemoryNotes sessionId="s1" uid="docente-2" notes={NOTES} names={NAMES} canForget={false} forget={forget} />)
    await act(async () => pending.resolve({ status: 'forgotten', key: 'estudiante a' }))
    expect(within(rowOf('Estudiante A')).getByText('Guardada para el tutor')).toBeInTheDocument()
    expect(screen.queryByText('Olvidada')).toBeNull()
  })

  it('a note saved in the fallback after the primary did not confirm is not offered for deletion, and says why', () => {
    renderNotes({ notes: [{ ...NOTES[0], via: 'firestore', forgettable: false, forgetUnavailable: 'primary-unconfirmed' }] })
    expect(screen.getByText(/no confirmó el guardado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Olvidar esta nota' })).toBeNull()
  })

  it('the room creator only: another teacher sees the notes but cannot forget them', () => {
    renderNotes({ canForget: false })
    expect(screen.queryByRole('button', { name: 'Olvidar esta nota' })).toBeNull()
  })

  it('shows a note forgotten earlier (from Firestore) as forgotten, and renders nothing without notes', () => {
    const { container, rerender } = renderNotes({ notes: [{ ...NOTES[0], status: 'forgotten', forgettable: false }] })
    expect(screen.getByText('Olvidada')).toBeInTheDocument()
    rerender(<MemoryNotes sessionId="s1" uid="docente-1" notes={undefined} canForget />)
    expect(container).toBeEmptyDOMElement()
  })
})

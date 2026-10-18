import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QuestionEditor from '../components/QuestionEditor'

const question = {
  questionId: 'q-1', prompt: '¿Cuánto es 2 + 3?', type: 'multiple_choice', skillId: 'addition',
  options: ['5', '6', '7', '8'], correctAnswer: 0, maxScore: 1, explanation: '',
}
const props = () => ({ question, index: 0, count: 2, skills: [{ id: 'addition', label: 'Adición' }], onChange: vi.fn(), onMove: vi.fn(), onRemove: vi.fn() })
describe('interacción del editor de preguntas', () => {
  it('pliega los campos sin perder datos y vuelve a abrir una pregunta con errores', async () => {
    const inputs = props()
    const view = render(<QuestionEditor {...inputs} />)
    const details = screen.getByRole('heading', { name: 'Pregunta 1' }).closest('details')
    expect(details.open).toBe(true)
    await act(async () => { details.open = false; fireEvent(details, new Event('toggle')) })
    expect(details.open).toBe(false)
    expect(inputs.onChange).not.toHaveBeenCalled()
    view.rerender(<QuestionEditor {...inputs} errors={{ prompt: 'Revisa el enunciado' }} />)
    expect(details.open).toBe(true)
    expect(screen.getByRole('textbox', { name: /Enunciado/ })).toHaveValue(question.prompt)
  })
  it('mantiene la selección de respuesta y el ajuste al quitar una alternativa', () => {
    const inputs = props()
    render(<QuestionEditor {...inputs} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Alternativa 2 es correcta' }))
    expect(inputs.onChange).toHaveBeenCalledWith({ ...question, correctAnswer: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar alternativa 1' }))
    expect(inputs.onChange).toHaveBeenLastCalledWith({ ...question, options: ['6', '7', '8'], correctAnswer: -1 })
  })
})

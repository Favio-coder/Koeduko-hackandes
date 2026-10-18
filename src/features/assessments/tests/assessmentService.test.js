/**
 * Caché corta del `bootstrap` en el cliente.
 *
 * Es la lectura más pesada del módulo y se repite en cada montaje de página y
 * en cada regreso del editor. Se reutiliza durante 30 s y se invalida al
 * guardar o publicar, que son las únicas acciones del cliente que cambian el
 * listado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = {
  currentUser: { uid: 'teacher-1', getIdToken: vi.fn(async () => 'token') },
}
vi.mock('@/services/firebase', () => ({ auth }))

const { assessmentRequest, invalidateBootstrap, loadBootstrap } = await import(
  '../services/assessmentService'
)

describe('loadBootstrap', () => {
  beforeEach(() => {
    invalidateBootstrap()
    auth.currentUser.getIdToken.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })),
    )
  })

  it('reutiliza la respuesta y fuerza la lectura con refresh', async () => {
    const first = await loadBootstrap()
    const second = await loadBootstrap()
    expect(second).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)

    await loadBootstrap({ refresh: true })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('invalida la caché cuando el docente guarda o publica', async () => {
    const first = await loadBootstrap()
    /* save + bootstrap posterior: el guardado no debe reutilizar la copia vieja. */
    await assessmentRequest('save', { title: 'Borrador' })
    const afterSave = await loadBootstrap()
    expect(afterSave).not.toBe(first)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(auth.currentUser.getIdToken).toHaveBeenCalled()
  })
})
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMatchingProfile } from '../services/assessmentProfileService'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('servicio de perfiles de evaluación para matching', () => {
  it('envía token Auth y parámetros del perfil al endpoint existente', async () => {
    const contract = { schemaVersion: '1.0', status: 'finalized' }
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => contract,
    })
    const getIdToken = vi.fn().mockResolvedValue('test-id-token')
    vi.stubGlobal('fetch', fetch)

    await expect(
      fetchMatchingProfile('assessment 1', 'course/5a', getIdToken),
    ).resolves.toBe(contract)
    expect(fetch).toHaveBeenCalledWith(
      '/api/assessments/matching-profile?assessmentId=assessment+1&courseId=course%2F5a',
      { headers: { Authorization: 'Bearer test-id-token' } },
    )
  })

  it('propaga errores de autorización/estado del endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'La evaluación aún no finaliza.' }),
      }),
    )

    await expect(
      fetchMatchingProfile('assessment-1', 'course-1', async () => 'token'),
    ).rejects.toThrow('La evaluación aún no finaliza.')
  })
})

import { describe, expect, it } from 'vitest'
import { average, clamp, deterministicId, hashString, round } from '@/shared/lib/utils'

describe('shared/lib/utils', () => {
  it('clamp acota valores dentro del rango', () => {
    expect(clamp(1.5)).toBe(1)
    expect(clamp(-2)).toBe(0)
    expect(clamp(0.4)).toBe(0.4)
    expect(clamp(NaN)).toBe(0)
  })

  it('round redondea de forma estable', () => {
    expect(round(0.123456, 2)).toBe(0.12)
  })

  it('average devuelve 0 para listas vacias', () => {
    expect(average([])).toBe(0)
    expect(average([0.2, 0.4])).toBeCloseTo(0.3)
  })

  it('hashString es determinista', () => {
    expect(hashString('student-001')).toBe(hashString('student-001'))
    expect(hashString('a')).not.toBe(hashString('b'))
  })

  it('deterministicId genera ids reproducibles sin caracteres especiales', () => {
    expect(deterministicId('pair', ['student-001', 'student-002'])).toBe('pair-student001student002')
  })
})
import { describe, expect, it } from 'vitest'
import { normalizeName } from './participants.js'

describe('normalizeName', () => {
  it('lowercases, strips accents and collapses spaces', () => {
    expect(normalizeName('  Lúis  Ròjas ')).toBe('luis rojas')
  })

  it('returns an empty string for missing names', () => {
    expect(normalizeName(null)).toBe('')
    expect(normalizeName(undefined)).toBe('')
    expect(normalizeName(42)).toBe('')
  })
})

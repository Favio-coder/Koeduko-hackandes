import { describe, expect, it } from 'vitest'
import { deterministicId } from './ids.js'

describe('deterministicId', () => {
  it('builds a lowercase id from prefix and parts', () => {
    expect(deterministicId('Evt', ['Speech', 'P1', 't1324'])).toBe('evt-speechp1t1324')
  })

  it('is stable for the same input', () => {
    const parts = ['speech_on', 'p7', 't500']
    expect(deterministicId('evt', parts)).toBe(deterministicId('evt', parts))
  })

  it('strips characters that are not alphanumeric', () => {
    expect(deterministicId('evt', ['a/b', 'c d', '1.5'])).toBe('evt-abcd15')
  })

  it('coerces non-string parts', () => {
    expect(deterministicId('evt', [12, 0])).toBe('evt-120')
  })
})

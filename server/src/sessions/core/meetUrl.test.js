import { describe, expect, it } from 'vitest'
import { isValidMeetUrl } from './meetUrl.js'

describe('isValidMeetUrl', () => {
  it.each([
    'https://meet.google.com/abc-defg-hij',
    'https://meet.google.com/abc-defg-hij?authuser=0',
    '  https://meet.google.com/abc-defg-hij  ',
  ])('accepts %s', (url) => {
    expect(isValidMeetUrl(url)).toBe(true)
  })

  it.each([
    'http://meet.google.com/abc-defg-hij',
    'https://meet.google.com.evil.test/abc-defg-hij',
    'https://evil.test/meet.google.com/abc-defg-hij',
    'https://user:pass@meet.google.com/abc-defg-hij',
    'https://meet.google.com/ABC-DEFG-HIJ',
    'https://meet.google.com/abc-defg',
    'https://meet.google.com/abc-defg-hij/extra',
    'https://zoom.us/j/123456789',
    'not a url',
    '',
    null,
    undefined,
    42,
  ])('rejects %s', (url) => {
    expect(isValidMeetUrl(url)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { ALLOWED_HEADERS, ALLOWED_METHODS, DEV_ORIGIN, handleCors, parseAllowedOrigins } from './cors.js'

const FRONT = 'https://koeduko-app.web.app'

function fakeRes() {
  const res = { headers: {}, statusCode: null, ended: false }
  res.setHeader = (name, value) => {
    res.headers[name] = value
  }
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.end = () => {
    res.ended = true
    return res
  }
  return res
}

const call = (method, origin, allowedOrigins = [FRONT]) => {
  const res = fakeRes()
  const result = handleCors({ method, headers: origin === undefined ? {} : { origin } }, res, { allowedOrigins })
  return { res, result }
}

describe('parseAllowedOrigins', () => {
  it('splits a comma list, trims and drops trailing slashes', () => {
    expect(parseAllowedOrigins(' https://a.app , https://b.app/ ,http://localhost:3000')).toEqual(['https://a.app', 'https://b.app', 'http://localhost:3000'])
  })

  it.each([undefined, null, '', '  ,  '])('returns an empty list for %j', (value) => {
    expect(parseAllowedOrigins(value)).toEqual([])
  })

  it('never accepts a wildcard, a path, a non-http scheme or garbage', () => {
    expect(parseAllowedOrigins('*, https://a.app/path, ftp://a.app, javascript:alert(1), not a url, https://ok.app')).toEqual(['https://ok.app'])
  })
})

describe('handleCors', () => {
  it('does nothing for requests without an Origin header (curl, server to server)', () => {
    const { res, result } = call('POST', undefined)
    expect(result).toEqual({ preflight: false })
    expect(res.headers).toEqual({})
  })

  it.each([[FRONT], [DEV_ORIGIN]])('allows the origin %s on a normal request, echoing exactly that origin', (origin) => {
    const { res, result } = call('POST', origin)
    expect(result.preflight).toBe(false)
    expect(res.headers['Access-Control-Allow-Origin']).toBe(origin)
    expect(res.headers.Vary).toBe('Origin')
  })

  it('always allows the Vite dev server, even with an empty list', () => {
    const { res } = call('POST', DEV_ORIGIN, [])
    expect(res.headers['Access-Control-Allow-Origin']).toBe(DEV_ORIGIN)
  })

  it('answers the preflight for an allowed origin with 204 and the allowed methods and headers', () => {
    const { res, result } = call('OPTIONS', FRONT)
    expect(result.preflight).toBe(true)
    expect(res.statusCode).toBe(204)
    expect(res.ended).toBe(true)
    expect(res.headers).toMatchObject({
      'Access-Control-Allow-Origin': FRONT,
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Max-Age': '600',
    })
    expect(ALLOWED_HEADERS).toContain('Authorization')
  })

  it.each([['https://evil.example'], ['http://koeduko-app.web.app'], ['https://koeduko-app.web.app.evil.example'], ['null'], ['*']])(
    'rejects the preflight of the unknown origin %s with 403 and no allow-origin header',
    (origin) => {
      const { res, result } = call('OPTIONS', origin)
      expect(result.preflight).toBe(true)
      expect(res.statusCode).toBe(403)
      expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined()
    },
  )

  it('lets a request from an unknown origin continue but gives it no allow-origin header', () => {
    const { res, result } = call('POST', 'https://evil.example')
    expect(result.preflight).toBe(false)
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined()
    expect(res.headers.Vary).toBe('Origin')
  })

  it('never answers with a wildcard and never reflects a different origin', () => {
    for (const origin of [FRONT, DEV_ORIGIN, 'https://evil.example']) {
      const { res } = call('OPTIONS', origin)
      expect(res.headers['Access-Control-Allow-Origin']).not.toBe('*')
      if (res.headers['Access-Control-Allow-Origin']) expect(res.headers['Access-Control-Allow-Origin']).toBe(origin)
    }
  })
})

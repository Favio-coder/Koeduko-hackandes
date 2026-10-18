import { describe, expect, it } from 'vitest'
import { parseServiceAccount } from './firebaseAdmin.js'
import { ConfigError } from './sessions/errors.js'

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64')
const account = { project_id: 'demo-project', client_email: 'svc@demo.test', private_key: 'FAKE-PRIVATE-KEY-VALUE' }

describe('parseServiceAccount', () => {
  it('decodes a base64 service account', () => {
    expect(parseServiceAccount(encode(account))).toEqual(account)
  })

  it.each([undefined, null, '', '   '])('rejects a missing value (%s)', (value) => {
    expect(() => parseServiceAccount(value)).toThrow(ConfigError)
  })

  it('rejects text that is not base64 JSON', () => {
    expect(() => parseServiceAccount('%%%not-json%%%')).toThrow(ConfigError)
  })

  it('names the missing fields without leaking the content', () => {
    const incomplete = { ...account }
    delete incomplete.private_key
    try {
      parseServiceAccount(encode(incomplete))
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      expect(error.message).toContain('private_key')
      expect(error.message).not.toContain('demo-project')
      expect(error.message).not.toContain('svc@demo.test')
    }
  })

  it('never echoes the private key in any error', () => {
    try {
      parseServiceAccount(encode({ ...account, project_id: '' }))
    } catch (error) {
      expect(error.message).not.toContain('FAKE-PRIVATE-KEY-VALUE')
    }
  })
})

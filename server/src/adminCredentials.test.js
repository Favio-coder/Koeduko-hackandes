import { describe, expect, it } from 'vitest'
import { initAdmin, pickCredential } from './adminCredentials.js'

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64')
const account = { project_id: 'demo', client_email: 'svc@demo.test', private_key: 'FAKE-PRIVATE-KEY' }

describe('pickCredential', () => {
  it('prefers the same variable the server uses', () => {
    expect(pickCredential({ env: { FIREBASE_SERVICE_ACCOUNT_B64: b64(account), GOOGLE_APPLICATION_CREDENTIALS: '/x.json' }, serviceAccountFile: 'f.json' })).toBe('env')
  })

  it('ignores a value that cannot be decoded, like the placeholder `vercel env pull` writes for Secrets', () => {
    expect(pickCredential({ env: { FIREBASE_SERVICE_ACCOUNT_B64: '[SENSITIVE]' } })).toBeNull()
    expect(pickCredential({ env: { FIREBASE_SERVICE_ACCOUNT_B64: '[SENSITIVE]' }, adcFileExists: true })).toBe('adc')
  })

  it('uses Application Default Credentials from the variable or from the gcloud file', () => {
    expect(pickCredential({ env: { GOOGLE_APPLICATION_CREDENTIALS: '/x.json' } })).toBe('adc')
    expect(pickCredential({ env: {}, adcFileExists: true })).toBe('adc')
  })

  it('uses a service-account file only when it is asked for explicitly, as the last resort', () => {
    expect(pickCredential({ env: {}, serviceAccountFile: 'f.json' })).toBe('file')
    expect(pickCredential({ env: {} })).toBeNull()
  })
})

describe('initAdmin', () => {
  it('fails with instructions, and without any sensitive value, when there are no credentials', () => {
    expect(() => initAdmin({ env: { FIREBASE_SERVICE_ACCOUNT_B64: 'secreto-que-no-sirve' } })).toThrow(/No hay credenciales del Admin SDK/)
    try {
      initAdmin({ env: { FIREBASE_SERVICE_ACCOUNT_B64: 'secreto-que-no-sirve' } })
    } catch (error) {
      expect(error.message).not.toContain('secreto-que-no-sirve')
    }
  })
})

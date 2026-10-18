import { afterEach, describe, expect, it, vi } from 'vitest'
import { consoleLogger } from './logger.js'

afterEach(() => vi.restoreAllMocks())

describe('consoleLogger', () => {
  it('writes one JSON line with level, message and the data', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleLogger.info('hola', { sessionId: 's1', n: 2 })
    expect(JSON.parse(spy.mock.calls[0][0])).toEqual({ level: 'info', message: 'hola', sessionId: 's1', n: 2 })
  })

  it('uses stderr for errors and warnings', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleLogger.error('mal', {})
    consoleLogger.warn('ojo', {})
    expect(JSON.parse(error.mock.calls[0][0])).toMatchObject({ level: 'error', message: 'mal' })
    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({ level: 'warn', message: 'ojo' })
  })

  it('never lets the data overwrite the level or the message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleLogger.info('afterLiveEventSaved: intervencion', { message: 'texto del tutor', level: 'debug', text: 'ok' })
    expect(JSON.parse(spy.mock.calls[0][0])).toEqual({ level: 'info', message: 'afterLiveEventSaved: intervencion', text: 'ok' })
  })

  it('works without data', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleLogger.info('solo mensaje')
    expect(JSON.parse(spy.mock.calls[0][0])).toEqual({ level: 'info', message: 'solo mensaje' })
  })
})

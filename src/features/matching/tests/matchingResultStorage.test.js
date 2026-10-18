import { describe, expect, it } from 'vitest'
import { createMatchingResult } from '../services/matchingService'
import { prepareDemoProfiles } from '../data/prepareDemoProfiles'
import { classroomFixture } from './helpers/classroomFixture'
import { MATCHING_RESULT_KEY, readMatchingResult, saveMatchingResult } from '../services/matchingResultStorage'

const storageFor = (raw = null) => ({
  raw,
  getItem(key) { expect(key).toBe(MATCHING_RESULT_KEY); return this.raw },
  setItem(key, value) { expect(key).toBe(MATCHING_RESULT_KEY); this.raw = value },
})

describe('último resultado de la pestaña', () => {
  it('separa resultados reales por docente y verifica curso/evaluación al recuperarlos', () => {
    const memory = new Map()
    const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) }
    const { profile } = classroomFixture()
    const result = createMatchingResult(profile)
    const scope = { ownerId: 'teacher-1', courseId: profile.courseId, assessmentId: profile.assessmentId }
    saveMatchingResult(result, storage, scope)
    expect(readMatchingResult(storage, scope).result).toEqual(result)
    expect(readMatchingResult(storage, { ...scope, ownerId: 'teacher-2' }).result).toBeNull()
    expect(readMatchingResult(storage, { ...scope, courseId: 'other-course' }).result).toBeNull()
    expect(readMatchingResult(storage, { ...scope, assessmentId: 'other-assessment' }).result).toBeNull()
    expect(readMatchingResult(storage).result).toBeNull()
    expect(() => saveMatchingResult(createMatchingResult(prepareDemoProfiles()), storage, scope)).toThrow(/contexto/)
  })
  it('restaura el mismo resultado sin volver a calcularlo', () => {
    const result = createMatchingResult(prepareDemoProfiles())
    const storage = storageFor()
    saveMatchingResult(result, storage)
    expect(readMatchingResult(storage)).toEqual({ result, error: null })
  })
  it('no inventa grupos si no hay una propuesta guardada', () => {
    expect(readMatchingResult(storageFor())).toEqual({ result: null, error: null })
  })
  it.each(['bad-json', 'old-model', 'duplicate-member'])('rechaza un resultado dañado: %s', (kind) => {
    const storage = storageFor()
    saveMatchingResult(createMatchingResult(prepareDemoProfiles()), storage)
    if (kind === 'bad-json') storage.raw = '{'
    else {
      const snapshot = JSON.parse(storage.raw)
      if (kind === 'old-model') snapshot.modelVersion = 'old'
      else snapshot.result.groups[0].members[1].studentId = snapshot.result.groups[0].members[0].studentId
      storage.raw = JSON.stringify(snapshot)
    }
    expect(readMatchingResult(storage)).toEqual({ result: null, error: expect.any(String) })
  })
  it('informa errores de lectura y permite detectar que el guardado falló', () => {
    expect(readMatchingResult({ getItem() { throw new Error('blocked') } }).error).toBeTruthy()
    expect(() => saveMatchingResult(createMatchingResult(prepareDemoProfiles()), { setItem() { throw new Error('quota') } })).toThrow('quota')
  })
})

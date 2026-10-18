import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { prepareDemoProfiles } from '../data/prepareDemoProfiles'
import { normalizeAssessmentResults } from '../services/normalizeAssessmentResults'
import { saveMatchingResult } from '../services/matchingResultStorage'

const NO_RESTRICTIONS = Object.freeze([])

/** Recibe datos automáticamente, pero solo agrupa tras una acción explícita. */
export function useMatchingPreview(input, { assessmentId, forbiddenPairs = NO_RESTRICTIONS } = {}) {
  const received = useMemo(() => {
    try {
      const source = input === undefined ? prepareDemoProfiles() : input
      const profiles = Array.isArray(source) ? source : normalizeAssessmentResults(source).profiles
      const ids = new Set()
      for (const profile of profiles) {
        if (!profile || typeof profile.studentId !== 'string' || !profile.studentId.trim() || ids.has(profile.studentId)) throw new Error('Hay estudiantes sin identificador o duplicados.')
        if (profile.displayName !== undefined && typeof profile.displayName !== 'string') throw new Error('El nombre de estudiante debe ser texto.')
        ids.add(profile.studentId)
      }
      return { source, profiles, error: null }
    } catch (error) {
      return { source: null, profiles: [], error: error.message }
    }
  }, [input])
  const request = useMemo(() => ({ received, assessmentId, forbiddenPairs }), [received, assessmentId, forbiddenPairs])
  const [state, setState] = useState(null)
  const activeWorker = useRef(null)
  const cancel = useCallback(() => {
    const worker = activeWorker.current
    activeWorker.current = null
    worker?.terminate()
  }, [])
  useEffect(() => cancel, [request, cancel])

  const generate = () => {
    if (received.error || received.profiles.length < 2) return
    cancel()
    setState({ request, loading: true, result: null, error: null, storageWarning: null })
    try {
      const worker = new Worker(new URL('../workers/matching.worker.js', import.meta.url), { type: 'module' })
      activeWorker.current = worker
      const complete = (result, error) => {
        if (activeWorker.current !== worker) return
        cancel()
        let storageWarning = null
        if (result?.status === 'optimal') {
          try { saveMatchingResult(result) }
          catch { storageWarning = 'Los grupos están listos, pero no se conservarán al recargar esta pestaña.' }
        }
        setState({ request, loading: false, result, error, storageWarning })
      }
      worker.onmessage = ({ data }) => complete(data.result ?? null, data.error ?? (!data.result ? 'El cálculo no devolvió grupos.' : null))
      worker.onerror = () => complete(null, 'No se pudo calcular el agrupamiento. Vuelve a intentarlo.')
      // Omitir Timestamp del transporte; no es un predictor.
      const profiles = Array.isArray(received.source) ? received.source.map((profile) => ({
        studentId: profile.studentId,
        ...(profile.displayName !== undefined ? { displayName: profile.displayName } : {}),
        ...(profile.assessmentId !== undefined ? { assessmentId: profile.assessmentId } : {}),
        ...(profile.simulated !== undefined ? { simulated: profile.simulated } : {}),
        ...(profile.evidence !== undefined ? { evidence: profile.evidence } : {}),
        skills: profile.skills,
      })) : received.source
      worker.postMessage({ profiles, options: { ...(assessmentId !== undefined ? { assessmentId } : {}), forbiddenPairs } })
    } catch (error) {
      cancel()
      setState({ request, loading: false, result: null, error: error.message || 'No se pudo iniciar el agrupamiento.', storageWarning: null })
    }
  }

  const current = state?.request === request
  return {
    students: received.profiles,
    usingDemo: input === undefined,
    result: current ? state.result : null,
    loading: current ? state.loading : false,
    error: received.error ?? (current ? state.error : null),
    storageWarning: current ? state.storageWarning : null,
    generate,
  }
}

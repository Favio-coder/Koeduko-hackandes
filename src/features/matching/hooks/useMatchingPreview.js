import { useEffect, useState } from 'react'
import { DEMO_STUDENTS, toKnowledgeProfiles } from '@/shared/lib/demoData'

/**
 * Hook de arranque. El desarrollador 2 debe reemplazar la fuente de datos
 * por knowledgeProfiles en Firestore y llamar al algoritmo real.
 */
export function useMatchingPreview() {
  const [state, setState] = useState({ profiles: [], loading: true, error: null })

  useEffect(() => {
    let active = true
    // Simula la carga asincrona del diagnostico.
    const timer = setTimeout(() => {
      if (!active) return
      setState({ profiles: toKnowledgeProfiles(DEMO_STUDENTS), loading: false, error: null })
    }, 0)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  return state
}
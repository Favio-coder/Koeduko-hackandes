import { useCallback, useRef, useState } from 'react'

export function useOperation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const run = useCallback(async task => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try { return await task() } catch (e) { setError(e.message) }
    finally { lock.current = false; setBusy(false) }
  }, [])
  return { busy, error, run }
}

import { useEffect, useState } from 'react'

/** Hora actual en milisegundos, refrescada cada `everyMs` para que "hace 10 s" avance solo. */
export function useNow(everyMs = 10000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])

  return now
}

/**
 * Tooltip — ayuda contextual al hacer hover o al recibir foco.
 *
 * Se implementa con `aria-describedby` (no `title`) para que sea anunciable por
 * lectores de pantalla. Posicionado en cuatro puntos: top, bottom, left, right.
 */
import { useEffect, useId, useRef, useState } from 'react'

const positions = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
}

/**
 * @param {object} props
 * @param {string} props.content
 * @param {'top'|'bottom'|'left'|'right'} [props.position]
 * @param {number} [props.delay] ms de espera antes de mostrar por hover (0 = inmediato).
 * @param {boolean} [props.disabled]
 */
export default function Tooltip({
  content,
  position = 'top',
  delay = 120,
  disabled = false,
  className = '',
  children,
}) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  const timerRef = useRef(null)

  /* Limpieza del temporizador para no dejar timers huérfanos. */
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const show = () => {
    if (disabled) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(true), delay)
  }
  const hide = () => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  /* En teclado no hay hover: se muestra de inmediato. */
  const showNow = () => {
    if (disabled) return
    clearTimeout(timerRef.current)
    setVisible(true)
  }

  return (
    <span
      className={['relative inline-flex', className].filter(Boolean).join(' ')}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={showNow}
      onBlur={hide}
    >
      <span aria-describedby={visible ? id : undefined} className="inline-flex">
        {children}
      </span>
      {visible && (
        <span
          role="tooltip"
          id={id}
          className={[
            'pointer-events-none absolute z-40 w-max max-w-[16rem] rounded-lg px-2.5 py-1.5',
            'bg-[#304744] text-xs font-medium leading-snug text-white',
            'shadow-[0_8px_24px_rgba(48,71,68,0.28)]',
            positions[position] ?? positions.top,
          ].join(' ')}
        >
          {content}
        </span>
      )}
    </span>
  )
}
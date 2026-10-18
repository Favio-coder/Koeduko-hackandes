import { useState } from 'react'
import { Input } from '@/components/ui/Field'

export default function PasswordInput({ labelRight, ...props }) {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const checkCapsLock = (event) => setCapsLock(Boolean(event.getModifierState?.('CapsLock')))

  return (
    <div>
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        onKeyDown={checkCapsLock}
        onKeyUp={checkCapsLock}
        onBlur={() => setCapsLock(false)}
        labelRight={
          <span className="flex flex-wrap items-center justify-end gap-3">
            {labelRight}
            <button
              type="button"
              aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${props.label.toLowerCase()}`}
              aria-pressed={visible}
              aria-controls={props.id}
              onClick={() => setVisible((value) => !value)}
              className="rounded text-xs font-semibold text-[#2A7A35] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {visible ? 'Ocultar' : 'Mostrar'}
            </button>
          </span>
        }
      />
      {capsLock && <p role="status" className="mt-1 text-xs text-[#8A6410]">Bloq Mayús está activado.</p>}
    </div>
  )
}

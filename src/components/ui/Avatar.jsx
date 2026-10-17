/**
 * Avatar — inicial o imagen con degradado de marca y tamaños coherentes.
 *
 * @example <Avatar name="Ana Torres" size="md" />
 * @example <Avatar src={user.photoURL} size="lg" />
 */
import { useState } from 'react'

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

/** Degradados deterministas a partir del nombre: mismo nombre, mismo color. */
const gradients = [
  'bg-[#4CDB59]',
  'bg-[#5FC9C9]',
  'bg-[#8FBF6A]',
  'bg-[#E8B33C]',
  'bg-[#7FA8D8]',
  'bg-[#C58FD8]',
  'bg-[#E08F6A]',
]

function gradientFor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997
  return gradients[hash % gradients.length]
}

/**
 * @param {object} props
 * @param {string} [props.name]
 * @param {string} [props.src] URL de la imagen.
 * @param {string} [props.alt] si se omite se generan desde `name`.
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.size]
 * @param {boolean} [props.showStatus] punto verde de "en línea".
 */
export default function Avatar({ name = '', src, alt, size = 'md', showStatus = false, className = '' }) {
  const [failed, setFailed] = useState(false)
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  const showImage = src && !failed

  return (
    <span className={['relative inline-flex shrink-0', className].filter(Boolean).join(' ')}>
      <span
        className={[
          'inline-flex items-center justify-center overflow-hidden rounded-full font-bold text-white',
          'ring-2 ring-white',
          sizes[size] ?? sizes.md,
          showImage ? 'bg-[#F8FAF6]' : gradientFor(name),
        ].join(' ')}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt ?? name}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden={alt || name ? undefined : 'true'}>{initials || '?'}</span>
        )}
      </span>
      {showStatus && (
        <span
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#4CDB59]"
          title="En línea"
        />
      )}
    </span>
  )
}
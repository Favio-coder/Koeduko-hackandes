/**
 * Brand — logotipo de KoEduko (koala) como componente.
 *
 * @param {object} props
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.showName]
 * @param {'light'|'dark'} [props.tone] `light` para fondos oscuros.
 */
import Icon from '@/components/ui/Icon'

const sizes = {
  sm: { mark: 'h-8 w-8', text: 'text-base', icon: 'h-4 w-4' },
  md: { mark: 'h-10 w-10', text: 'text-lg', icon: 'h-5 w-5' },
  lg: { mark: 'h-14 w-14', text: 'text-2xl', icon: 'h-7 w-7' },
}

export default function Brand({ size = 'md', showName = true, tone = 'light', className = '' }) {
  const s = sizes[size] ?? sizes.md
  return (
    <span className={['inline-flex items-center gap-2.5', className].filter(Boolean).join(' ')}>
      <span
        className={[
          'inline-flex shrink-0 items-center justify-center rounded-2xl',
          s.mark,
          tone === 'light'
            ? 'bg-[#E8F8E4] text-[#2F7F3C] ring-1 ring-[#B6E9AE]'
            : 'bg-[#62DD6B] text-[#22302F]',
        ].join(' ')}
      >
        <Icon name="koala" className={s.icon} />
      </span>
      {showName && (
        <span
          className={[
            s.text,
            'font-bold tracking-tight',
            tone === 'light' ? 'text-[#31494A]' : 'text-white',
          ].join(' ')}
        >
          Ko<span className="text-[#2F7F3C]">Eduko</span>
        </span>
      )}
    </span>
  )
}
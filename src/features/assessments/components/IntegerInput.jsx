import { Input } from '@/components/ui/Field'

/** Admite borrar mientras se edita; la validación del formulario exige el mínimo. */
export default function IntegerInput({ value, onValueChange, max, ...props }) {
  return <Input {...props} type="text" inputMode="numeric" pattern="[0-9]*"
    maxLength={String(max).length} value={value}
    onChange={(event) => {
      const text = event.target.value
      if (!/^\d*$/.test(text) || Number(text) > max) return
      onValueChange(text === '' ? '' : Number(text))
    }} />
}

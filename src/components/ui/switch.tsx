import { Switch as RSwitch } from 'radix-ui'
import { useId } from 'react'

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2.5">
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="relative h-6 w-10 shrink-0 cursor-pointer rounded-full bg-control transition-colors duration-150 data-[state=checked]:bg-ink"
      >
        <RSwitch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-ink shadow transition-transform duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-ground" />
      </RSwitch.Root>
      <label htmlFor={id} className="cursor-pointer text-[13px] leading-tight">
        <span id={`${id}-label`} className="font-medium text-ink">
          {label}
        </span>
        {hint && (
          <span id={`${id}-hint`} className="block text-[12px] text-faint">
            {hint}
          </span>
        )}
      </label>
    </div>
  )
}

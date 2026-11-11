import { ToggleGroup } from 'radix-ui'
import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Accessible name when the label is an icon or abbreviation. */
  aria?: string
  /** Tailwind classes for the selected pill (defaults to a light pill). */
  activeClass?: string
}

/**
 * Single-choice segmented control on Radix ToggleGroup (arrow-key roving
 * focus, aria-pressed). The selected pill slides between options using a
 * shared layoutId, the same technique as kokonutui's smooth tabs.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentOption<T>[]
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const id = useId()
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn('inline-flex rounded-full bg-raised p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <ToggleGroup.Item
            key={o.value}
            value={o.value}
            aria-label={o.aria}
            className={cn(
              'relative isolate inline-flex cursor-pointer items-center justify-center gap-1 rounded-full font-medium transition-colors duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3.5 text-[13px]',
              active ? 'text-ground' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className={cn('absolute inset-0 -z-10 rounded-full', o.activeClass ?? 'bg-ink')}
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            {o.label}
          </ToggleGroup.Item>
        )
      })}
    </ToggleGroup.Root>
  )
}

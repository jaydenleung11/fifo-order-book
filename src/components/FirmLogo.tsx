import { firmOf, logoUrl } from '@/app/firms'
import { cn } from '@/lib/utils'

/**
 * A firm's logo on a small white card (most bank logos are drawn for a
 * light background). Falls back to the plain name for anyone else.
 */
export function FirmLogo({ name, className }: { name: string; className?: string }) {
  const firm = firmOf(name)
  if (!firm) return <span className={cn('truncate', className)}>{name}</span>
  return (
    <span
      className={cn('inline-flex h-4 max-w-full shrink-0 items-center rounded-[4px] bg-white px-1', className)}
      style={{ boxShadow: `inset 3px 0 0 ${firm.color}` }}
      title={firm.name}
    >
      <img src={logoUrl(firm)} alt={firm.name} className="ml-0.5 h-[70%] w-auto max-w-full object-contain" draggable={false} />
    </span>
  )
}

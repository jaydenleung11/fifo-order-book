import type { LogEntry, Priority } from '@/engine/types'
import { PSEUDOCODE, explain, type Program } from '@/app/explain'
import { cn } from '@/lib/utils'

/** The algorithm, with the line the book is running right now lit up. */
export function OpsPanel({ entry, priority }: { entry: LogEntry | null; priority: Priority }) {
  const ex = entry ? explain(entry, entry.book.priority) : null
  const program: Program = ex?.program ?? 'limit'
  // Show the rule the shown event actually ran under; fall back to the toggle.
  const rule = entry?.book.priority ?? priority
  const lines = PSEUDOCODE[program](rule)

  return (
    <section aria-labelledby="ops-title" className="rounded-2xl bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ops-title" className="text-[15px] font-semibold">
          The code
        </h2>
        {ex?.cost && <span className="rounded-full bg-raised px-2 font-mono text-[11.5px] leading-5 text-good">{ex.cost}</span>}
      </div>
      <pre
        className="mt-2.5 overflow-x-auto rounded-xl bg-ground py-2.5 font-mono text-[11.5px] leading-[1.7]"
        aria-label={`Pseudocode for ${program === 'limit' ? 'adding a limit order' : 'a market order'}`}
      >
        {lines.map((l, i) => {
          const on = ex !== null && ex.line === i
          return (
            <div
              key={i}
              className={cn('flex gap-2.5 px-2.5 transition-colors duration-150', on ? 'bg-raised text-ink' : 'text-faint')}
              aria-current={on ? 'step' : undefined}
            >
              <span className={cn('w-3 shrink-0 text-right', on ? 'text-focus' : 'text-control')}>{i + 1}</span>
              <span className="whitespace-pre">{l}</span>
            </div>
          )
        })}
      </pre>
    </section>
  )
}

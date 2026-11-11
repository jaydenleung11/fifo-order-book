import { AnimatePresence, motion } from 'motion/react'
import type { LogEntry, Priority } from '@/engine/types'
import { PSEUDOCODE, explain, type Program } from '@/app/explain'
import { cn } from '@/lib/utils'

export function OpsPanel({ entry, priority }: { entry: LogEntry | null; priority: Priority }) {
  const ex = entry ? explain(entry, entry.book.priority) : null
  const program: Program = ex?.program ?? 'limit'
  // Show the rule the shown event actually ran under; fall back to the toggle.
  const rule = entry?.book.priority ?? priority
  const lines = PSEUDOCODE[program](rule)

  return (
    <section aria-labelledby="ops-title" className="@container rounded-2xl bg-surface p-4">
      <div className="grid gap-x-5 @xl:grid-cols-2 @xl:items-start">
      <div>
      <h2 id="ops-title" className="text-[15px] font-semibold">
        Operations
      </h2>
      <div className="mt-2 min-h-[4.75rem]" aria-live="polite" aria-atomic="true">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={entry?.seq ?? 'idle'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {ex ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[13.5px] font-semibold text-ink">{ex.op}</code>
                  {ex.cost && (
                    <span className="rounded-full bg-raised px-2 font-mono text-[11.5px] leading-5 text-good">
                      {ex.cost}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{ex.say}</p>
              </>
            ) : (
              <p className="text-[13.5px] leading-snug text-muted">
                Add an order or send a market order. Each step the computer takes shows up here.
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      </div>
      <pre
        className="mt-3 overflow-x-auto @xl:mt-0 rounded-xl bg-ground py-2.5 font-mono text-[11.5px] leading-[1.7]"
        aria-label={`Pseudocode for ${program === 'limit' ? 'adding a limit order' : 'a market order'}`}
      >
        {lines.map((l, i) => {
          const on = ex !== null && ex.line === i
          return (
            <div
              key={i}
              className={cn(
                'flex gap-2.5 px-2.5 transition-colors duration-150',
                on ? 'bg-raised text-ink' : 'text-faint',
              )}
              aria-current={on ? 'step' : undefined}
            >
              <span className={cn('w-3 shrink-0 text-right', on ? 'text-focus' : 'text-control')}>{i + 1}</span>
              <span className="whitespace-pre">{l}</span>
            </div>
          )
        })}
      </pre>
      </div>
    </section>
  )
}

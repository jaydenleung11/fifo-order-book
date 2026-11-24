import { motion, useReducedMotion } from 'motion/react'
import { Check, X } from 'lucide-react'
import type { Priority, Trade } from '@/engine/types'
import type { Command } from '@/engine/session'
import { cn } from '@/lib/utils'

interface Fairness {
  command: Extract<Command, { type: 'market' }>
  fifo: Trade[]
  lifo: Trade[]
}

/**
 * The matching rule as a picture you can click. Four orders arrive 1, 2, 3, 4
 * at the same price; the animation shows which one a trade takes.
 */
export function RuleCard({
  priority,
  onChange,
  fairness,
}: {
  priority: Priority
  onChange: (p: Priority) => void
  fairness: Fairness | null
}) {
  return (
    <section aria-labelledby="rule-title" className="rounded-2xl bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="rule-title" className="text-[15px] font-semibold">
          Who trades first?
        </h2>
        <span className="text-[12px] text-faint">same price · arrived 1 → 4</span>
      </div>
      <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Matching rule">
        <RuleRow rule="fifo" on={priority === 'fifo'} onPick={() => onChange('fifo')} />
        <RuleRow rule="lifo" on={priority === 'lifo'} onPick={() => onChange('lifo')} />
      </div>
      {fairness && <Compare data={fairness} />}
    </section>
  )
}

function RuleRow({ rule, on, onPick }: { rule: Priority; on: boolean; onPick: () => void }) {
  const reduce = useReducedMotion()
  const fifo = rule === 'fifo'
  const leaving = fifo ? 1 : 4
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors duration-150',
        on ? (fifo ? 'border-good/70 bg-raised' : 'border-bad/70 bg-raised') : 'border-transparent bg-ground/60 hover:bg-raised',
      )}
    >
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full text-ground',
          fifo ? 'bg-good' : 'bg-bad',
        )}
        aria-hidden
      >
        {fifo ? <Check className="size-3.5" /> : <X className="size-3.5" />}
      </span>
      <span className="w-14 shrink-0">
        <span className="block font-mono text-[14px] font-semibold text-ink">{fifo ? 'FIFO' : 'LIFO'}</span>
        <span className="block text-[11px] leading-tight text-faint">{fifo ? 'queue' : 'stack'}</span>
      </span>

      {/* the picture: trade window on the left, the line of orders to its right */}
      <span className="relative flex flex-1 items-center gap-1.5" aria-hidden>
        <span className="mr-1 h-9 w-1 rounded-full bg-focus/70" />
        {[1, 2, 3, 4].map((n) => {
          const isOut = n === leaving
          return (
            <motion.span
              key={n}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-md font-mono text-[12px] font-semibold',
                isOut ? (fifo ? 'bg-good text-ground' : 'bg-bad text-ground') : 'bg-control text-ink',
              )}
              animate={
                on && !reduce && isOut
                  ? fifo
                    ? { x: [0, 0, -18, -18, 0], opacity: [1, 1, 0, 0, 1] }
                    : { x: [0, 0, -40, -150, -150, 0], y: [0, 0, -18, -18, 0, 0], opacity: [1, 1, 1, 0, 0, 1] }
                  : { x: 0, y: 0, opacity: 1 }
              }
              transition={on && !reduce && isOut ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            >
              {n}
            </motion.span>
          )
        })}
      </span>
      <span className="hidden w-[7.5rem] shrink-0 text-[12px] leading-snug text-muted sm:block">
        {fifo ? '#1 waited longest, trades first' : '#4 just arrived, cuts the line'}
      </span>
    </button>
  )
}

function Compare({ data }: { data: Fairness }) {
  const ids = (t: Trade[]) => t.map((x) => x.makerId)
  const same = ids(data.fifo).join() === ids(data.lifo).join()
  return (
    <div className="mt-3 rounded-xl bg-ground px-3 py-2.5">
      <div className="text-[12px] text-faint">
        Last market {data.command.side} of {data.command.qty}, replayed both ways
      </div>
      <Chain label="FIFO" ids={ids(data.fifo)} tone="good" />
      <Chain label="LIFO" ids={ids(data.lifo)} tone="bad" />
      {same && <div className="mt-1 text-[12px] text-faint">Same result: each price had only one order in line.</div>}
    </div>
  )
}

function Chain({ label, ids, tone }: { label: string; ids: number[]; tone: 'good' | 'bad' }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span className={cn('w-10 font-mono text-[12px] font-semibold', tone === 'good' ? 'text-good' : 'text-bad')}>{label}</span>
      {ids.map((id, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-faint">→</span>}
          <span className="rounded-md bg-raised px-1.5 font-mono text-[12px] text-ink">#{id}</span>
        </span>
      ))}
    </div>
  )
}

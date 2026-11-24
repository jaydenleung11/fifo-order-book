import type { Trade } from '@/engine/types'
import type { Command } from '@/engine/session'
import { clock, cn } from '@/lib/utils'

interface Fairness {
  command: Extract<Command, { type: 'market' }>
  fifo: Trade[]
  lifo: Trade[]
}

function Column({ title, trades, highlight, tone }: { title: string; trades: Trade[]; highlight: number | null; tone: 'good' | 'bad' }) {
  return (
    <div className="min-w-0">
      <div className={cn('mb-1 text-[12.5px] font-semibold', tone === 'good' ? 'text-good' : 'text-bad')}>{title}</div>
      <ol className="tnum space-y-1 text-[12.5px]">
        {trades.map((t, i) => (
          <li
            key={i}
            className={cn('flex justify-between gap-2 rounded px-1.5 py-0.5', t.makerId === highlight ? 'bg-raised text-ink' : 'text-muted')}
          >
            <span className="truncate">
              #{t.makerId} {t.makerTrader}
            </span>
            <span className="shrink-0">
              {t.qty} @ {t.price}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The same market order run under FIFO and under LIFO, side by side. */
export function FairnessCard({ data }: { data: Fairness | null }) {
  if (!data) {
    return (
      <section aria-labelledby="fair-title" className="rounded-2xl bg-surface p-4">
        <h2 id="fair-title" className="text-[15px] font-semibold">
          Same book, other rule
        </h2>
        <p className="mt-1.5 text-[13px] leading-snug text-faint">
          After a market order, this card replays it on a copy of the book under FIFO and LIFO so you can compare who got filled.
        </p>
      </section>
    )
  }
  const { fifo, lifo, command } = data
  const a = fifo[0]
  const b = lifo[0]
  const differ = a && b && a.makerId !== b.makerId
  return (
    <section aria-labelledby="fair-title" className="rounded-2xl bg-surface p-4">
      <h2 id="fair-title" className="text-[15px] font-semibold">
        Same book, other rule
      </h2>
      <p className="mt-0.5 text-[12.5px] text-faint">
        Market {command.side} for {command.qty}, replayed both ways.
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-3">
        <Column title="FIFO (real exchanges)" trades={fifo} highlight={a?.makerId ?? null} tone="good" />
        <Column title="LIFO" trades={lifo} highlight={b?.makerId ?? null} tone="bad" />
      </div>
      <p className="mt-2.5 text-[13px] leading-snug text-muted">
        {differ
          ? `LIFO lets #${b.makerId} (${b.makerTrader}, ${clock(b.makerTime)}) cut ahead of #${a.makerId} (${a.makerTrader}, ${clock(a.makerTime)}), who had waited longer at the same price.`
          : 'Both rules pick the same first order here: only one order was waiting at the best price. Try a level with two or more orders.'}
      </p>
    </section>
  )
}

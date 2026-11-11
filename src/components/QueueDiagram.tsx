import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Pin, X } from 'lucide-react'
import type { BookSnapshot, LogEntry, Order, Priority, Side } from '@/engine/types'
import { focusOf } from './Book'
import type { LaneId } from './three/Book3D'
import { cn } from '@/lib/utils'

/** The linked-list operation behind each kind of step, for one queue. */
function opFor(entry: LogEntry | null, lane: LaneId, priority: Priority): { call: string; code: string } | null {
  const ev = entry?.event
  if (!ev) return null
  const lifo = priority === 'lifo'
  switch (ev.kind) {
    case 'enqueue':
      if (ev.order.side !== lane.side || ev.order.price !== lane.price) return null
      return {
        call: `enqueue(#${ev.order.id})`,
        code: ev.position === 0 ? 'head = tail = node' : 'tail.next = node;  tail = node',
      }
    case 'visit-level':
      if (ev.makerSide !== lane.side || ev.price !== lane.price) return null
      return { call: 'isEmpty() → false', code: 'head != null' }
    case 'peek':
      if (ev.order.side !== lane.side || ev.order.price !== lane.price) return null
      return { call: `${lifo ? 'peekTail' : 'peek'}() → #${ev.order.id}`, code: lifo ? 'return tail' : 'return head' }
    case 'fill': {
      const makerSide: Side = ev.trade.takerSide === 'buy' ? 'sell' : 'buy'
      if (makerSide !== lane.side || ev.trade.price !== lane.price) return null
      return { call: `trade ${ev.trade.qty} with #${ev.trade.makerId}`, code: `${lifo ? 'tail' : 'head'}.qty -= ${ev.trade.qty}` }
    }
    case 'dequeue':
      if (ev.order.side !== lane.side || ev.price !== lane.price) return null
      return ev.end === 'head'
        ? { call: `dequeue() → #${ev.order.id}`, code: 'head = head.next' }
        : { call: `popTail() → #${ev.order.id}`, code: 'tail = tail.prev' }
    case 'level-empty':
      if (ev.makerSide !== lane.side || ev.price !== lane.price) return null
      return { call: 'isEmpty() → true', code: 'head == null' }
    default:
      return null
  }
}

function activeLane(entry: LogEntry | null): LaneId | null {
  const ev = entry?.event
  if (ev?.kind === 'enqueue') return { side: ev.order.side, price: ev.order.price }
  const f = focusOf(entry)
  return f.makerSide && f.price !== null ? { side: f.makerSide, price: f.price } : null
}

export function QueueDiagram({
  book,
  entry,
  pinned,
  onUnpin,
}: {
  book: BookSnapshot
  entry: LogEntry | null
  pinned: LaneId | null
  onUnpin: () => void
}) {
  // Follow the action; remember the last lane so the diagram never goes blank.
  const last = useRef<LaneId>({ side: 'sell', price: book.asks[0].price })
  const live = activeLane(entry)
  if (live) last.current = live
  const lane = pinned ?? last.current
  const level = (lane.side === 'buy' ? book.bids : book.asks).find((l) => l.price === lane.price)
  const orders = level?.orders ?? []
  const priority = entry?.book.priority ?? book.priority
  const op = opFor(entry, lane, priority)
  const focus = focusOf(entry)
  const joined = entry?.event.kind === 'enqueue' ? entry.event.order.id : null
  const name = `${lane.side === 'buy' ? 'bids' : 'asks'}[${lane.price}]`
  const total = orders.reduce((n, o) => n + o.qty, 0)
  const maxQty = Math.max(8, ...orders.map((o) => o.qty))

  return (
    <section aria-labelledby="qd-title" className="rounded-2xl bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="qd-title" className="text-[15px] font-semibold">
          Inside one queue
        </h2>
        <code
          className={cn(
            'rounded-full px-2.5 py-0.5 font-mono text-[12.5px] font-semibold',
            lane.side === 'buy' ? 'bg-bid-soft text-bid-ink' : 'bg-ask-soft text-ask-ink',
          )}
        >
          {name}
        </code>
        <span className="tnum text-[12.5px] text-faint">
          {orders.length} node{orders.length === 1 ? '' : 's'} · {total} shares
        </span>
        {pinned ? (
          <button
            type="button"
            onClick={onUnpin}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-raised px-2.5 py-0.5 text-[12px] text-muted hover:text-ink"
          >
            <Pin className="size-3" aria-hidden /> Pinned <X className="size-3" aria-label="Unpin and follow the action" />
          </button>
        ) : (
          <span className="text-[12px] text-faint">following the action · click a lane to pin</span>
        )}
        <div className="ml-auto min-h-7" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {op && (
              <motion.div
                key={entry?.seq}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2 rounded-full bg-ground py-1 pl-3 pr-1"
              >
                <code className="font-mono text-[12.5px] text-ink">{op.call}</code>
                <code className="rounded-full bg-raised px-2 font-mono text-[11.5px] leading-5 text-focus">{op.code}</code>
                <span className="rounded-full bg-raised px-2 font-mono text-[11px] leading-5 text-good">O(1)</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto pb-1">
        <ol className="flex min-h-[7.5rem] items-end gap-0 pt-6" aria-label={`${name}, head first`}>
          <AnimatePresence initial={false} mode="popLayout">
            {orders.map((o, i) => (
              <Node
                key={o.id}
                order={o}
                isHead={i === 0}
                isTail={i === orders.length - 1}
                state={
                  focus.orderId === o.id ? 'focus' : joined === o.id ? 'joined' : 'idle'
                }
                widthPct={(o.qty / maxQty) * 100}
              />
            ))}
          </AnimatePresence>
          <motion.li layout className="flex shrink-0 items-center self-center pb-1" aria-label="end of list">
            {orders.length > 0 && <Arrow />}
            <span className="rounded-md border border-dashed border-control px-2 py-1 font-mono text-[12px] text-faint">null</span>
          </motion.li>
        </ol>
      </div>
    </section>
  )
}

function Arrow() {
  return (
    <span className="flex w-9 shrink-0 flex-col items-center" aria-hidden>
      <span className="font-mono text-[10px] leading-none text-faint">next</span>
      <svg width="34" height="10" viewBox="0 0 34 10" className="text-control">
        <path d="M0 5h28" stroke="currentColor" strokeWidth="2" />
        <path d="M27 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  )
}

function Node({
  order,
  isHead,
  isTail,
  state,
  widthPct,
}: {
  order: Order
  isHead: boolean
  isTail: boolean
  state: 'idle' | 'focus' | 'joined'
  widthPct: number
}) {
  const bid = order.side === 'buy'
  const pointer = isHead && isTail ? 'head · tail' : isHead ? 'head' : isTail ? 'tail' : null
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 48, y: -24 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: -48, y: -10, transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="flex shrink-0 items-center"
    >
      {!isHead && <Arrow />}
      <div className="relative">
        {pointer && (
          <div className="absolute -top-6 left-1/2 flex -translate-x-1/2 flex-col items-center">
            <span className="whitespace-nowrap rounded-full bg-ink px-2 font-mono text-[10.5px] font-semibold leading-4 text-ground">
              {pointer}
            </span>
            <span className="h-1.5 w-px bg-ink" />
          </div>
        )}
        <div
          className={cn(
            'w-[5.5rem] rounded-xl border-2 bg-raised px-2.5 py-2 transition-[border-color,box-shadow] duration-200',
            state === 'focus'
              ? 'border-focus shadow-[0_0_0_4px_rgb(255_229_138/0.15)]'
              : state === 'joined'
                ? 'border-ink/60'
                : 'border-transparent',
          )}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[13px] font-semibold text-ink">#{order.id}</span>
            <span className="tnum text-[12px] text-muted">{order.qty}</span>
          </div>
          <div className="truncate text-[11.5px] text-faint">{order.trader}</div>
          <div className="mt-1.5 h-1.5 rounded-full bg-ground">
            <motion.div
              className={cn('h-full rounded-full', bid ? 'bg-bid' : 'bg-ask')}
              animate={{ width: `${Math.max(8, widthPct)}%` }}
              transition={{ duration: 0.35 }}
            />
          </div>
        </div>
      </div>
    </motion.li>
  )
}

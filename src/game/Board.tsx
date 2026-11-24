import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, DoorOpen, Hourglass, UserPlus } from 'lucide-react'
import { Trader, type Mood } from './art/Trader'
import type { ActiveMarket, Chip, MatchEvent } from '@/engine/match'
import type { LevelDef, MarketArrival } from '@/engine/levels'
import type { Side } from '@/engine/types'

export type ChipView = Chip & { mood: Mood }
export type Recent = { ev: MatchEvent; key: number }

interface BoardProps {
  def: LevelDef
  bids: ChipView[][]
  asks: ChipView[][]
  active: ActiveMarket | null
  pending: MarketArrival[]
  /** 0..1 of the active order's patience left. */
  patience: number
  /** Side the active order takes from. */
  takeSide: Side | null
  /** Best lane on that side. */
  bestLane: number
  /** Lane the keyboard is on (multi-lane levels). */
  cursor?: number
  recent: Recent[]
  onTap?: (side: Side, lane: number, id: number) => void
  /** An empty board for menus. */
  idle?: boolean
}

export function Board(p: BoardProps) {
  const both = p.def.bids.length > 0 && p.def.asks.length > 0
  return (
    <div
      className={`grid items-stretch gap-2 sm:gap-3 ${
        both ? 'grid-cols-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,190px)_minmax(0,1fr)]' : 'grid-cols-1 sm:grid-cols-[minmax(150px,190px)_minmax(0,1fr)]'
      }`}
    >
      {both && <Panel side="buy" {...p} />}
      <div className={`${both ? 'order-first col-span-2 sm:order-none sm:col-span-1' : 'order-first'}`}>
        <MarketCard {...p} />
      </div>
      <Panel side="sell" {...p} />
    </div>
  )
}

/* ---------------------------------------------------------------- market */

function MarketCard({ active, pending, patience, takeSide, idle, def }: BoardProps) {
  const both = def.bids.length > 0 && def.asks.length > 0
  return (
    <div className="flex h-full flex-row-reverse items-center justify-center gap-3 rounded-[20px] border-[3px] border-ink bg-paper p-2 sm:flex-col sm:gap-2 sm:p-4">
      {/* incoming market orders wait in a queue of their own */}
      <div className="flex min-h-7 w-[88px] flex-wrap items-center gap-1 sm:w-auto sm:flex-nowrap" aria-label={`${pending.length} market orders waiting`}>
        {pending.slice(0, 5).map((m) => (
          <span
            key={m.id}
            className={`grid h-6 min-w-6 place-items-center rounded-md border-2 border-ink px-1 font-sign text-xs ${m.side === 'buy' ? 'bg-bid-soft' : 'bg-ask-soft'}`}
          >
            {m.side === 'buy' ? '▲' : '▼'}
            {m.size}
          </span>
        ))}
        {pending.length > 5 && <span className="font-sign text-sm">+{pending.length - 5}</span>}
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {active && !idle ? (
          <motion.div
            key={active.id}
            initial={{ y: -30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.2 } }}
            className={`flex flex-row items-center gap-2 sm:flex-col sm:gap-1.5 ${patience < 0.25 ? 'hurry' : ''}`}
            aria-live="polite"
            aria-label={`Market ${active.side} order for ${active.size}, ${active.size - active.left} filled`}
          >
            <div className="relative grid size-[72px] shrink-0 place-items-center sm:size-[100px]">
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="44" fill={active.side === 'buy' ? 'var(--bid-soft)' : 'var(--ask-soft)'} stroke="color-mix(in srgb, var(--ink) 15%, transparent)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke={patience < 0.25 ? 'var(--bad)' : 'var(--ink)'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${patience * 276.5} 276.5`}
                />
              </svg>
              <div className="relative flex flex-col items-center leading-none">
                <span className={`text-2xl ${active.side === 'buy' ? 'text-bid' : 'text-ask'}`} aria-hidden="true">
                  {active.side === 'buy' ? '▲' : '▼'}
                </span>
                <span className="font-sign text-[28px] sm:text-[34px]">{active.left}</span>
              </div>
            </div>
            <Pips total={active.size} filled={active.size - active.left} side={active.side} big />
            {/* which way it goes: a buy takes from the asks, a sell from the bids */}
            <span
              className={`flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 font-sign text-base ${
                takeSide === 'sell' ? 'bg-ask-soft' : 'bg-bid-soft'
              }`}
            >
              {takeSide === 'buy' && <ArrowLeft className="size-4" strokeWidth={3} aria-hidden="true" />}
              {active.side === 'buy' ? 'Buy' : 'Sell'}
              {takeSide === 'sell' && (both ? <ArrowRight className="size-4" strokeWidth={3} aria-hidden="true" /> : <ArrowRight className="size-4 rotate-0" strokeWidth={3} aria-hidden="true" />)}
            </span>
          </motion.div>
        ) : (
          <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid size-[72px] place-items-center rounded-full border-[3px] border-dashed border-ink/30 sm:size-[100px]">
            <Hourglass className="size-7 text-ink/40" strokeWidth={2.4} aria-label="Waiting for a market order" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Pips({ total, filled, side, big }: { total: number; filled: number; side: Side; big?: boolean }) {
  return (
    <span className="flex flex-wrap justify-center gap-0.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`${big ? 'size-3' : 'size-1.5'} rounded-[3px] border border-ink ${
            i < filled ? 'bg-ink' : side === 'buy' ? 'bg-bid-soft' : 'bg-ask-soft'
          }`}
        />
      ))}
    </span>
  )
}

/* ----------------------------------------------------------------- lanes */

function Panel({ side, def, bids, asks, takeSide, idle, ...rest }: BoardProps & { side: Side }) {
  const prices = side === 'buy' ? def.bids : def.asks
  const lanes = side === 'buy' ? bids : asks
  const live = !idle && takeSide === side
  const dim = !idle && takeSide !== null && takeSide !== side
  return (
    <section
      aria-label={side === 'buy' ? 'Bids' : 'Asks'}
      className={`rounded-[20px] border-[3px] border-ink p-2 transition-[opacity] sm:p-3 ${side === 'buy' ? 'bg-bid-soft/70' : 'bg-ask-soft/70'} ${
        dim ? 'opacity-55' : 'opacity-100'
      }`}
    >
      <h2 className={`mb-1.5 flex items-center gap-1.5 font-sign text-lg leading-none ${side === 'buy' ? 'justify-end text-bid' : 'text-ask'}`}>
        <span aria-hidden="true">{side === 'buy' ? '▲' : '▼'}</span>
        {side === 'buy' ? 'Bids' : 'Asks'}
      </h2>
      <div className="flex flex-col gap-1.5">
        {prices.map((price, i) => (
          <Lane
            key={price}
            side={side}
            lane={i}
            price={price}
            chips={lanes[i] ?? []}
            live={live}
            multi={prices.length > 1}
            def={def}
            idle={idle}
            {...rest}
          />
        ))}
      </div>
    </section>
  )
}

function chipWidth(width: number, multi: boolean) {
  if (width >= 420) return multi ? 50 : 62
  if (width >= 260) return multi ? 42 : 50
  return 34
}

function Lane({
  side,
  lane,
  price,
  chips,
  live,
  multi,
  def,
  idle,
  bestLane,
  cursor,
  recent,
  onTap,
}: {
  side: Side
  lane: number
  price: number
  chips: ChipView[]
  live: boolean
  multi: boolean
  def: LevelDef
  idle?: boolean
  bestLane: number
  cursor?: number
  recent: Recent[]
  onTap?: (side: Side, lane: number, id: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(400)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const bid = side === 'buy'
  const w = chipWidth(width, multi)
  const h = Math.round(w * 1.42)
  const n = chips.length
  // Room left for chips after the tail marker; chips overlap when the lane is crowded.
  const room = width - 38
  const step = n > 1 ? Math.max(8, Math.min(w + 4, (room - w) / (n - 1))) : w + 4
  const lifo = def.policy === 'lifo'
  const isBest = live && lane === bestLane
  const isCursor = live && multi && cursor === lane
  const mine = recent.filter((r) => 'side' in r.ev && r.ev.side === side && 'lane' in r.ev && r.ev.lane === lane)
  // The chip the rule fills next: head (FIFO) or tail (LIFO).
  const ruleIdx = lifo ? n - 1 : 0

  return (
    <div className={`flex items-stretch gap-1.5 ${bid ? 'flex-row-reverse' : ''}`}>
      {/* the price, at the inner edge where the head is */}
      <div
        className={`relative flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border-2 sm:w-14 ${
          isBest ? 'border-ink bg-gold' : 'border-ink/25 bg-paper/70'
        } ${isCursor ? 'outline-3 outline-offset-1 outline-ink' : ''}`}
      >
        <span className="font-sign text-[clamp(15px,2vw,20px)] leading-none">${price}</span>
        {multi && live && <kbd className="mt-0.5 rounded bg-ink px-1 text-[10px] font-bold text-paper">{lane + 1}</kbd>}
      </div>

      {/* the queue */}
      <div ref={ref} className={`relative flex min-w-0 flex-1 items-end pt-6 ${bid ? 'flex-row-reverse' : ''}`} style={{ minHeight: h + 24 }}>
        <AnimatePresence initial={false} mode="popLayout">
          {chips.map((c, i) => (
            <motion.button
              key={c.id}
              layout="position"
              type="button"
              tabIndex={-1}
              initial={{ x: bid ? -50 : 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ y: -28, opacity: 0, scale: 0.7, transition: { duration: 0.3 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              onClick={() => onTap?.(side, lane, c.id)}
              className={`relative shrink-0 cursor-pointer rounded-xl border-2 border-ink text-left shadow-[0_3px_0_var(--ink)] transition-[box-shadow] hover:shadow-[0_5px_0_var(--ink)] active:shadow-none ${bid ? 'bg-paper' : 'hatch bg-paper'} ${
                !idle && isBest && i === ruleIdx ? 'head-glow-ring' : ''
              }`}
              style={{
                width: w,
                height: h,
                zIndex: 100 - i,
                // the gap toward the head; the head chip itself has none
                [bid ? 'marginRight' : 'marginLeft']: i === 0 ? 0 : step - w,
              }}
              aria-label={`Order ${c.id}, ${c.left} of ${c.size} left, ${c.mood}`}
            >
              <span className="absolute -left-1.5 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 font-sign text-[11px] leading-none text-paper">
                {c.id}
              </span>
              <span className={`absolute right-1 top-0.5 text-[10px] ${bid ? 'text-bid' : 'text-ask'}`} aria-hidden="true">
                {bid ? '▲' : '▼'}
              </span>
              <span className="absolute inset-x-1 top-2 block" style={{ height: h * 0.5 }}>
                <Trader look={c.look} mood={c.mood} />
              </span>
              <span className="absolute inset-x-0 bottom-1 flex flex-col items-center gap-0.5">
                <motion.span key={c.left} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="font-sign text-[15px] leading-none">
                  {c.left}
                </motion.span>
                {c.size > 1 && <Pips total={c.size} filled={c.size - c.left} side={side} />}
              </span>
              {i === 0 && (
                <span
                  className="absolute -top-5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-gold px-1.5 font-mono text-[9.5px] font-semibold leading-4 text-ink"
                  translate="no"
                >
                  <DoorOpen className="size-2.5" strokeWidth={3} aria-hidden="true" />
                  head
                </span>
              )}
            </motion.button>
          ))}
        </AnimatePresence>

        {/* tail marker: new orders join here */}
        <motion.div layout="position" className={`relative z-[150] flex shrink-0 flex-col items-center self-end ${bid ? 'mr-1.5' : 'ml-1.5'}`} aria-hidden="true">
          <span className="grid size-6 place-items-center rounded-full border-2 border-ink bg-paper">
            <UserPlus className="size-3.5" strokeWidth={2.6} />
          </span>
          <span className="font-mono text-[9.5px] font-semibold" translate="no">
            tail
          </span>
          <OpTags items={mine.filter((r) => r.ev.type === 'enqueue' || (r.ev.type === 'fill' && lifo))} align={bid ? 'left' : 'right'} />
        </motion.div>

        <div className={`pointer-events-none absolute top-0 z-[200] ${bid ? 'right-0' : 'left-0'}`}>
          <OpTags items={mine.filter((r) => r.ev.type === 'fill' && !lifo)} align={bid ? 'right' : 'left'} below />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- op tags */

function label(ev: MatchEvent): { text: string; cost: string; tone: 'ok' | 'bad' | 'note' } | null {
  if (ev.type === 'enqueue') return { text: 'enqueue', cost: 'O(1)', tone: 'note' }
  if (ev.type !== 'fill') return null
  if (ev.mistake === 'jump') return { text: 'queue jump', cost: 'O(n)', tone: 'bad' }
  if (ev.mistake === 'price') return { text: 'worse price', cost: '', tone: 'bad' }
  if (ev.op === 'partial') return { text: `partial −${ev.qty}`, cost: '', tone: 'note' }
  if (ev.op === 'pop') return { text: 'pop tail', cost: 'O(1)', tone: 'bad' }
  return { text: 'dequeue', cost: 'O(1)', tone: 'ok' }
}

function OpTags({ items, align, below }: { items: Recent[]; align: 'left' | 'right'; below?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute flex flex-col gap-1 ${align === 'left' ? 'left-0 items-start' : 'right-0 items-end'} ${
        below ? 'top-0' : 'bottom-full mb-1'
      }`}
    >
      {items.slice(-2).map(({ ev, key }) => {
        const l = label(ev)
        if (!l) return null
        const pts = ev.type === 'fill' ? ev.points : 0
        return (
          <div
            key={key}
            translate="no"
            className={`op-tag flex items-center gap-1 whitespace-nowrap rounded-full border-2 px-1.5 font-mono text-[10.5px] leading-[16px] font-semibold shadow-sm ${
              l.tone === 'bad' ? 'border-bad bg-[#ffe3dd] text-bad' : l.tone === 'ok' ? 'border-good bg-[#e2f6e9] text-good' : 'border-ink/30 bg-paper text-ink'
            }`}
          >
            {l.tone === 'bad' && <span aria-hidden="true">✕</span>}
            {l.text}
            {l.cost && <span className="opacity-70">{l.cost}</span>}
            {pts !== 0 && <span className="font-sign text-[12px] font-normal">{pts > 0 ? `+${pts}` : `−${-pts}`}</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- tape */

export function Tape({ fills }: { fills: import('@/engine/match').Fill[] }) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ left: ref.current.scrollWidth })
  }, [fills.length])
  return (
    <div className="flex items-center gap-2 rounded-2xl border-2 border-ink/20 bg-paper/70 px-3 py-2">
      <span className="shrink-0 font-sign text-sm text-ink-soft">Tape</span>
      <ol ref={ref} className="flex min-h-7 flex-1 gap-1 overflow-x-auto" aria-label="Trades, oldest first">
        {fills.map((f, i) => (
          <li
            key={i}
            className={`flex shrink-0 items-center gap-0.5 rounded-md border-2 px-1.5 font-sign text-[13px] leading-6 ${
              f.ok ? (f.side === 'buy' ? 'border-bid/50 bg-bid-soft' : 'hatch border-ask/50 bg-ask-soft') : 'border-bad bg-[#ffe3dd] text-bad'
            }`}
            aria-label={`Order ${f.chip}, ${f.qty} at ${f.price}${f.ok ? '' : ', mistake'}`}
          >
            {!f.ok && <span aria-hidden="true">✕</span>}#{f.chip}
            <span className="text-ink-soft">×{f.qty}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

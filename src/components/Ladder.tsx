import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { BookSnapshot, LevelSnapshot, LogEntry, Order, Side, Trade } from '@/engine/types'
import { units, useInstrument, type Instrument } from '@/app/instruments'
import { firmOf } from '@/app/firms'
import { clock, cn } from '@/lib/utils'
import { FirmLogo } from './FirmLogo'
import { focusOf, type Focus } from './Book'

/**
 * A price ladder (the "DOM" screen traders watch), simplified for teaching.
 * One row per price: asks on top (worst first), bids below. Inside each
 * BID / ASK cell the level's actual FIFO queue is drawn as a strip of
 * segments, one per order, coloured by the firm that sent it. The head sits
 * next to the PRICE column, so the next order to fill is always the one
 * touching the price.
 */

/** How many recent trades feed the HIT column. */
const HIT_WINDOW = 8
/** How many prints the time & sales panel keeps. */
const TAPE_ROWS = 40

const sum = (l: LevelSnapshot) => l.orders.reduce((s, o) => s + o.qty, 0)

/** Taker time: ids and the arrival clock tick together, so the taker id is its time. */
const tradeTime = (t: Trade) => clock(t.takerId)

interface Row {
  side: Side
  level: LevelSnapshot
  total: number
  cum: number
}

interface Hover {
  order: Order
  x: number
  y: number
}

export function Ladder({ book, entry, trades }: { book: BookSnapshot; entry: LogEntry | null; trades: Trade[] }) {
  const inst = useInstrument()
  const reduce = useReducedMotion() ?? false
  const focus = focusOf(entry)
  const [hover, setHover] = useState<Hover | null>(null)

  const { askRows, bidRows, maxTotal, maxCum } = useMemo(() => {
    const build = (side: Side, levels: LevelSnapshot[]) => {
      let run = 0
      return levels.map<Row>((level) => {
        const total = sum(level)
        run += total
        return { side, level, total, cum: run }
      })
    }
    const bids = build('buy', book.bids) // 99 .. 95
    const asks = build('sell', book.asks).reverse() // 105 .. 101, worst on top
    const all = [...asks, ...bids]
    return {
      askRows: asks,
      bidRows: bids,
      maxTotal: Math.max(1, ...all.map((r) => r.total)),
      maxCum: Math.max(1, ...all.map((r) => r.cum)),
    }
  }, [book])

  const { profile, maxProfile, hits } = useMemo(() => {
    const profile = new Map<number, number>()
    for (const t of trades) profile.set(t.price, (profile.get(t.price) ?? 0) + t.qty)
    const hits = new Map<number, { buy: number; sell: number }>()
    for (const t of trades.slice(-HIT_WINDOW)) {
      const h = hits.get(t.price) ?? { buy: 0, sell: 0 }
      h[t.takerSide] += t.qty
      hits.set(t.price, h)
    }
    return { profile, maxProfile: Math.max(1, ...profile.values()), hits }
  }, [trades])

  const bestBid = book.bids.find((l) => l.orders.length)?.price ?? null
  const bestAsk = book.asks.find((l) => l.orders.length)?.price ?? null
  const last = trades.length ? trades[trades.length - 1] : null

  // Drop the tooltip if the hovered order has left the book.
  const hovered = hover && [...book.bids, ...book.asks].some((l) => l.orders.some((o) => o.id === hover.order.id)) ? hover : null

  const rowProps = {
    focus,
    reduce,
    maxTotal,
    maxCum,
    maxProfile,
    profile,
    hits,
    lastPrice: last?.price ?? null,
    onHover: setHover,
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 min-[900px]:flex-row">
      <section className="min-w-0 flex-1 rounded-2xl bg-surface p-3" aria-label="Price ladder">
        <div className="min-w-0 overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full min-w-[520px] table-fixed border-separate border-spacing-0 text-[12.5px]">
            <caption className="mb-2 px-1 text-left">
              <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[15px] font-semibold text-ink">
                  Price ladder <span className="tnum text-[12.5px] font-normal text-muted">{inst.symbol}</span>
                </span>
                <span className="text-[12px] text-faint">
                  Each cell is a queue: <span className="font-semibold text-ink">H</span> head fills first, next to the price;{' '}
                  <span className="font-semibold text-ink">T</span> tail is where new orders join.
                </span>
              </span>
            </caption>
            <colgroup>
              <col className="w-[84px] max-[899px]:hidden" />
              <col className="w-[84px] max-[899px]:hidden" />
              <col />
              <col className="w-[88px]" />
              <col />
              <col className="w-[64px]" />
            </colgroup>
            <thead>
              <tr className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
                <th scope="col" className="px-1.5 pb-1.5 text-left font-semibold max-[899px]:hidden">
                  Profile
                </th>
                <th scope="col" className="px-1.5 pb-1.5 text-right font-semibold max-[899px]:hidden">
                  Depth
                </th>
                <th scope="col" className="px-1.5 pb-1.5 text-right font-semibold text-bid">
                  Bid queue
                </th>
                <th scope="col" className="px-1.5 pb-1.5 text-center font-semibold">
                  Price
                </th>
                <th scope="col" className="px-1.5 pb-1.5 text-left font-semibold text-ask">
                  Ask queue
                </th>
                <th scope="col" className="px-1.5 pb-1.5 text-right font-semibold">
                  Hit
                </th>
              </tr>
            </thead>
            <tbody>
              {askRows.map((r) => (
                <LadderRow key={`a${r.level.price}`} row={r} {...rowProps} />
              ))}
              <tr aria-label="Spread and last trade">
                <td colSpan={6} className="py-1">
                  <div className="tnum flex items-center justify-center gap-4 rounded-md border border-dashed border-control bg-ground/60 px-2 py-1 text-[11.5px] text-muted">
                    <span>
                      spread{' '}
                      <span className="font-semibold text-ink">
                        {bestBid !== null && bestAsk !== null ? inst.spread(bestAsk - bestBid) : '–'}
                      </span>
                    </span>
                    <span>
                      last{' '}
                      <span className={cn('font-semibold', last ? (last.takerSide === 'buy' ? 'text-bid' : 'text-ask') : 'text-ink')}>
                        {last ? inst.px(last.price) : '–'}
                      </span>
                    </span>
                  </div>
                </td>
              </tr>
              {bidRows.map((r) => (
                <LadderRow key={`b${r.level.price}`} row={r} {...rowProps} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <TimeAndSales trades={trades} reduce={reduce} />

      {hovered && <Tooltip hover={hovered} inst={inst} />}
    </div>
  )
}

function LadderRow({
  row,
  focus,
  reduce,
  maxTotal,
  maxCum,
  maxProfile,
  profile,
  hits,
  lastPrice,
  onHover,
}: {
  row: Row
  focus: Focus
  reduce: boolean
  maxTotal: number
  maxCum: number
  maxProfile: number
  profile: Map<number, number>
  hits: Map<number, { buy: number; sell: number }>
  lastPrice: number | null
  onHover: (h: Hover | null) => void
}) {
  const inst = useInstrument()
  const { side, level, total, cum } = row
  const isBid = side === 'buy'
  const price = level.price
  const n = level.orders.length
  const head = level.orders[0]
  const active = focus.makerSide === side && focus.price === price
  const isLast = lastPrice === price
  const traded = profile.get(price) ?? 0
  const hit = hits.get(price)
  const hitQty = hit ? hit.buy + hit.sell : 0
  const hitSide: Side | null = hit ? (hit.buy >= hit.sell ? 'buy' : 'sell') : null
  const flash = focus.flashKey && focus.price === price ? focus.flashKey : null

  const label = `${isBid ? 'Bid' : 'Ask'} ${inst.px(price)}: ${
    n === 0
      ? 'empty'
      : `${n} order${n === 1 ? '' : 's'}, head #${head.id} ${head.trader}, ${units(inst, total)} total`
  }${traded ? `, ${traded} traded here` : ''}`

  const cell = 'h-[30px] border-b border-rule/70 px-1.5 align-middle'
  const queue = (
    <QueueStrip side={side} level={level} total={total} maxTotal={maxTotal} focus={focus} reduce={reduce} onHover={onHover} />
  )

  return (
    <tr aria-label={label} className={cn('transition-colors duration-200', active && 'bg-raised')}>
      {/* PROFILE: volume traded at this price */}
      <td className={cn(cell, 'max-[899px]:hidden')}>
        <div className="relative h-[14px]">
          <div
            className="absolute inset-y-0 left-0 rounded-[2px] bg-control transition-[width] duration-300"
            style={{ width: `${(traded / maxProfile) * 100}%` }}
          />
          {traded > 0 && <span className="tnum relative pl-1 text-[10.5px] leading-[14px] text-ink">{traded}</span>}
        </div>
      </td>

      {/* DEPTH: cumulative resting size out to this price */}
      <td className={cn(cell, 'max-[899px]:hidden')}>
        <div className="relative h-[14px]">
          <div
            className={cn(
              'absolute inset-y-0 right-0 rounded-[2px] transition-[width] duration-300',
              isBid ? 'bg-bid-soft' : 'bg-ask-soft',
            )}
            style={{ width: `${(cum / maxCum) * 100}%` }}
          />
          {cum > 0 && (
            <span className={cn('tnum relative block pr-1 text-right text-[10.5px] leading-[14px]', isBid ? 'text-bid-ink' : 'text-ask-ink')}>
              {cum}
            </span>
          )}
        </div>
      </td>

      {/* BID queue */}
      <td className={cn(cell, isBid && 'bg-bid-soft/45')}>{isBid && queue}</td>

      {/* PRICE */}
      <th
        scope="row"
        className={cn(
          cell,
          'tnum relative text-center text-[13px] font-semibold',
          isBid ? 'text-bid' : 'text-ask',
          active && 'ring-1 ring-inset ring-focus/70',
        )}
      >
        {isLast && (
          <span aria-hidden className="absolute inset-x-1 inset-y-[3px] rounded-[4px] bg-ink/12 ring-1 ring-ink/35" />
        )}
        <span className="relative">{inst.px(price)}</span>
        {isLast && <span className="sr-only"> (last trade)</span>}
      </th>

      {/* ASK queue */}
      <td className={cn(cell, !isBid && 'bg-ask-soft/45')}>{!isBid && queue}</td>

      {/* HIT: recent market volume at this price */}
      <td className={cn(cell, 'relative text-right')}>
        <AnimatePresence>
          {flash && !reduce && (
            <motion.span
              key={flash}
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-white"
              initial={{ opacity: 0.55 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
        {hitQty > 0 && hitSide && (
          <span
            className={cn(
              'tnum relative inline-flex items-center gap-0.5 font-semibold',
              hitSide === 'buy' ? 'text-bid' : 'text-ask',
              flash && 'text-ink',
            )}
          >
            {hitSide === 'buy' ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
            {hitQty}
          </span>
        )}
      </td>
    </tr>
  )
}

/**
 * The level's queue as a strip of segments. DOM order is always head first;
 * bids are laid out right-to-left so the head touches the price column.
 */
function QueueStrip({
  side,
  level,
  total,
  maxTotal,
  focus,
  reduce,
  onHover,
}: {
  side: Side
  level: LevelSnapshot
  total: number
  maxTotal: number
  focus: Focus
  reduce: boolean
  onHover: (h: Hover | null) => void
}) {
  const inst = useInstrument()
  const isBid = side === 'buy'
  const n = level.orders.length
  // Toward the price column: bids sit left of it, asks right of it.
  const toPrice = isBid ? 1 : -1

  return (
    <div className={cn('flex h-[30px] items-center gap-1', isBid && 'flex-row-reverse')}>
      <span aria-hidden className={cn('w-2.5 shrink-0 text-center text-[9.5px] font-semibold', n ? 'text-ink' : 'text-transparent')}>
        H
      </span>
      <ol
        aria-label={`Queue at ${inst.px(level.price)}, head first`}
        className={cn('flex h-[16px] min-w-0 flex-1 items-center gap-[2px] overflow-hidden', isBid && 'flex-row-reverse')}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {level.orders.map((o, i) => {
            const firm = firmOf(o.trader)
            const focused = focus.orderId === o.id
            const joined = focus.joinedId === o.id
            const pct = (o.qty / maxTotal) * 100
            return (
              <motion.li
                key={o.id}
                layout={reduce ? false : 'position'}
                initial={reduce ? false : { opacity: 0, x: -toPrice * 18 }}
                animate={{ opacity: o.qty === 0 ? 0.45 : 1, x: 0, width: `${pct}%` }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: toPrice * 22, transition: { duration: 0.3 } }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 32 }}
                className={cn(
                  'relative h-full min-w-[6px] shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]',
                  i === 0 && 'shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.85)]',
                  joined && 'ring-2 ring-focus/80',
                )}
                style={{ width: `${pct}%`, backgroundColor: firm?.color ?? '#6b7480' }}
                role="img"
                aria-label={`#${o.id} ${o.trader}, ${units(inst, o.qty)}, arrived ${clock(o.time)}${i === 0 ? ', head' : ''}${
                  i === n - 1 && i !== 0 ? ', tail' : ''
                }`}
                onPointerEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  onHover({ order: o, x: r.left + r.width / 2, y: r.top })
                }}
                onPointerLeave={() => onHover(null)}
              >
                {focused && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute -inset-[2px] rounded-[4px] bg-focus/60 ring-2 ring-focus"
                    initial={{ opacity: 0.9 }}
                    animate={reduce ? { opacity: 0.9 } : { opacity: [0.95, 0.35, 0.95] }}
                    transition={reduce ? { duration: 0 } : { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
      <span aria-hidden className={cn('w-2.5 shrink-0 text-center text-[9.5px] font-semibold', n ? 'text-faint' : 'text-transparent')}>
        T
      </span>
      <span
        className={cn(
          'tnum w-7 shrink-0 text-[12px] font-semibold',
          isBid ? 'text-left text-bid' : 'text-right text-ask',
          total === 0 && 'text-faint',
        )}
      >
        {total || '·'}
      </span>
    </div>
  )
}

function Tooltip({ hover, inst }: { hover: Hover; inst: Instrument }) {
  const o = hover.order
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 w-max max-w-[15rem] -translate-x-1/2 -translate-y-full rounded-lg border border-rule bg-raised px-2.5 py-2 text-[12px] shadow-[0_8px_24px_rgb(0_0_0/0.45)]"
      style={{ left: hover.x, top: hover.y - 8 }}
    >
      <FirmLogo name={o.trader} className="h-[18px]" />
      <div className="mt-1 font-semibold text-ink">{o.trader}</div>
      <div className="tnum mt-0.5 text-muted">
        #{o.id} · <span className="text-ink">{units(inst, o.qty)}</span>
        {o.qty !== o.originalQty && <span className="text-faint"> of {o.originalQty}</span>} @ {inst.px(o.price)}
      </div>
      <div className="tnum text-faint">arrived {clock(o.time)}</div>
    </div>
  )
}

function TimeAndSales({ trades, reduce }: { trades: Trade[]; reduce: boolean }) {
  const inst = useInstrument()
  const rows = trades.slice(-TAPE_ROWS).reverse()
  return (
    <section
      aria-labelledby="tns-title"
      className="flex min-w-0 flex-col rounded-2xl bg-surface p-3 min-[900px]:w-[17rem] min-[900px]:shrink-0"
    >
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 id="tns-title" className="text-[15px] font-semibold">
          Time &amp; sales
        </h2>
        <span className="tnum text-[11.5px] text-faint">newest first</span>
      </div>
      <div
        className="tnum grid grid-cols-[3.6rem_1fr_2rem_auto] gap-2 border-b border-rule px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint"
        aria-hidden
      >
        <span>Time</span>
        <span className="text-right">Price</span>
        <span className="text-right">Size</span>
        <span>Maker</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 pt-2 text-[12.5px] text-faint">No prints yet. A market order that fills shows up here.</p>
      ) : (
        <ol className="max-h-[22rem] overflow-y-auto text-[12px] [scrollbar-width:thin]" aria-label="Time and sales, newest first">
          <AnimatePresence initial={false}>
            {rows.map((t) => {
              const buy = t.takerSide === 'buy'
              return (
                <motion.li
                  key={t.id}
                  layout={reduce ? false : 'position'}
                  initial={reduce ? false : { opacity: 0, backgroundColor: 'rgb(255 255 255 / 0.14)' }}
                  animate={{ opacity: 1, backgroundColor: 'rgb(255 255 255 / 0)' }}
                  transition={{ duration: reduce ? 0 : 0.7 }}
                  className="tnum grid h-[26px] grid-cols-[3.6rem_1fr_2rem_auto] items-center gap-2 border-b border-rule/60 px-1"
                  aria-label={`${tradeTime(t)}: market ${buy ? 'buy' : 'sell'} ${units(inst, t.qty)} at ${inst.px(t.price)}, from ${t.makerTrader}`}
                >
                  <span className="text-faint">{tradeTime(t)}</span>
                  <span className={cn('text-right font-semibold', buy ? 'text-bid' : 'text-ask')}>
                    {buy ? '▲' : '▼'} {inst.px(t.price)}
                  </span>
                  <span className="text-right text-ink">{t.qty}</span>
                  <FirmLogo name={t.makerTrader} className="h-[16px] max-w-[4.5rem]" />
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}

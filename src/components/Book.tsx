import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Check, ShoppingBasket, Store, UserRound, X } from 'lucide-react'
import type { BookSnapshot, LevelSnapshot, LogEntry, Order, Priority, Side, Taker } from '@/engine/types'
import type { Prediction, Skin } from '@/app/useController'
import { clock, cn } from '@/lib/utils'
import SplitFlapText from './kokonutui/split-flap-text'

export interface Focus {
  makerSide: Side | null
  price: number | null
  orderId: number | null
  flashKey: string | null
  joinedId: number | null
}

/** Which level / order the current event is about, for highlighting. */
export function focusOf(entry: LogEntry | null): Focus {
  const f: Focus = { makerSide: null, price: null, orderId: null, flashKey: null, joinedId: null }
  if (!entry) return f
  const e = entry.event
  const opposite = (s: Side): Side => (s === 'buy' ? 'sell' : 'buy')
  switch (e.kind) {
    case 'enqueue':
      f.joinedId = e.order.id
      break
    case 'visit-level':
    case 'level-empty':
      f.makerSide = e.makerSide
      f.price = e.price
      break
    case 'peek':
      f.makerSide = e.order.side
      f.price = e.order.price
      f.orderId = e.order.id
      break
    case 'fill':
      f.makerSide = opposite(e.trade.takerSide)
      f.price = e.trade.price
      f.orderId = e.trade.makerId
      f.flashKey = `t${e.trade.id}`
      break
    case 'dequeue':
      f.makerSide = e.order.side
      f.price = e.price
      break
  }
  return f
}

export function Book({
  book,
  entry,
  lastPrice,
  priority,
  skin,
  prediction,
  onGuess,
}: {
  book: BookSnapshot
  entry: LogEntry | null
  lastPrice: number | null
  priority: Priority
  skin: Skin
  prediction: Prediction | null
  onGuess: (id: number) => void
}) {
  const focus = focusOf(entry)
  const taker = entry?.taker ?? null
  const takerArriving = entry?.event.kind === 'market-arrive'
  const bestBid = book.bids.find((l) => l.orders.length)?.price ?? null
  const bestAsk = book.asks.find((l) => l.orders.length)?.price ?? null
  const shared = { focus, taker, priority, skin, prediction, onGuess }

  return (
    <LayoutGroup>
      <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
        <Side side="buy" levels={book.bids} {...shared} />

        <Counter
          bestBid={bestBid}
          bestAsk={bestAsk}
          lastPrice={lastPrice}
          taker={takerArriving ? taker : null}
        />

        <Side side="sell" levels={book.asks} {...shared} />
      </div>
    </LayoutGroup>
  )
}

function Counter({
  bestBid,
  bestAsk,
  lastPrice,
  taker,
}: {
  bestBid: number | null
  bestAsk: number | null
  lastPrice: number | null
  taker: Taker | null
}) {
  return (
    <div
      className="order-2 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl bg-surface px-4 py-2.5 min-[900px]:order-first min-[900px]:col-span-2"
      aria-label="Spread and last trade"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[12.5px] leading-tight text-faint">Last<br />trade</span>
        <SplitFlapText
          text={lastPrice === null ? '---' : String(lastPrice)}
          length={3}
          className="text-[22px] font-semibold"
          tileClassName="bg-raised text-ink"
        />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-[12.5px] leading-tight text-faint">Spread</span>
        <span className="tnum text-[18px] font-semibold">
          {bestBid !== null && bestAsk !== null ? bestAsk - bestBid : '–'}
        </span>
        <span className="tnum text-[12.5px] text-muted">
          best bid {bestBid ?? '–'}, best ask {bestAsk ?? '–'}
        </span>
      </div>
      <div className="flex min-w-[7.5rem] items-center justify-center min-[900px]:min-h-[3.25rem]">
        <AnimatePresence>
          {taker && <TakerToken key="taker" taker={taker} />}
        </AnimatePresence>
      </div>
    </div>
  )
}

function TakerToken({ taker }: { taker: Taker }) {
  const Icon = taker.side === 'buy' ? ArrowUpRight : ArrowDownRight
  return (
    <motion.div
      layoutId="taker"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="flex shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink bg-ground px-2.5 py-1.5 text-center"
      role="status"
      aria-label={`Market ${taker.side} order, ${taker.remaining} of ${taker.qty} left to fill`}
    >
      <span className="flex items-center gap-1 text-[11.5px] font-semibold">
        <Icon className="size-3.5" aria-hidden />
        Market {taker.side}
      </span>
      <span className="tnum text-[12px] text-muted">
        <span className="text-ink">{taker.remaining}</span> left
      </span>
    </motion.div>
  )
}

function Side({
  side,
  levels,
  focus,
  taker,
  priority,
  skin,
  prediction,
  onGuess,
}: {
  side: Side
  levels: LevelSnapshot[]
  focus: Focus
  taker: Taker | null
  priority: Priority
  skin: Skin
  prediction: Prediction | null
  onGuess: (id: number) => void
}) {
  const isBid = side === 'buy'
  const Icon = isBid ? ArrowUpRight : ArrowDownRight
  return (
    <section
      aria-label={isBid ? 'Bids: buyers waiting' : 'Asks: sellers waiting'}
      className={cn('rounded-2xl bg-surface p-3', isBid ? 'order-3' : 'order-1 min-[900px]:order-3')}
    >
      <header className={cn('mb-2 flex items-baseline gap-2 px-1', isBid && 'min-[900px]:flex-row-reverse')}>
        <h2 className={cn('flex items-center gap-1.5 text-[15px] font-semibold', isBid ? 'text-bid' : 'text-ask')}>
          <Icon className="size-4" aria-hidden />
          {isBid ? 'Bids' : 'Asks'}
        </h2>
        <p className="text-[12.5px] text-muted">
          {isBid ? 'buyers waiting, highest price first' : 'sellers waiting, lowest price first'}
        </p>
      </header>
      <div className={cn('flex flex-col gap-1.5', !isBid && 'max-[899px]:flex-col-reverse')}>
        {levels.map((level) => {
          const active = focus.makerSide === side && focus.price === level.price
          return (
            <Lane
              key={level.price}
              side={side}
              level={level}
              active={active}
              focus={focus}
              taker={active ? taker : null}
              priority={priority}
              skin={skin}
              predicting={prediction !== null && prediction.takerSide !== side ? prediction : null}
              onGuess={onGuess}
            />
          )
        })}
      </div>
    </section>
  )
}

function Lane({
  side,
  level,
  active,
  focus,
  taker,
  priority,
  skin,
  predicting,
  onGuess,
}: {
  side: Side
  level: LevelSnapshot
  active: boolean
  focus: Focus
  taker: Taker | null
  priority: Priority
  skin: Skin
  predicting: Prediction | null
  onGuess: (id: number) => void
}) {
  const isBid = side === 'buy'
  const n = level.orders.length
  const head = level.orders[0]
  const nextUp = priority === 'fifo' ? head : level.orders[n - 1]
  const checkout = skin === 'checkout'
  const sideName = isBid ? 'bid' : 'ask'

  return (
    <div
      role="group"
      aria-label={`${isBid ? 'Bid' : 'Ask'} ${level.price}: ${n === 0 ? 'empty' : `${n} order${n === 1 ? '' : 's'}, head #${head.id}`}`}
      className={cn(
        'relative flex h-[74px] items-center gap-2 rounded-xl px-2 transition-colors duration-200',
        isBid ? 'min-[900px]:flex-row-reverse' : '',
        active ? 'bg-raised ring-1 ring-ink/50' : 'bg-ground/40',
      )}
    >
      {/* Price, on the side that faces the spread. */}
      <div className={cn('flex w-11 shrink-0 flex-col', isBid ? 'min-[900px]:items-end' : 'items-start')}>
        {checkout && <Store className="mb-0.5 size-3.5 text-faint" aria-hidden />}
        <span className={cn('tnum text-[17px] font-semibold leading-none', isBid ? 'text-bid' : 'text-ask')}>
          {level.price}
        </span>
        <span className="mt-1 text-[11px] text-faint">{checkout ? 'till' : 'price'}</span>
      </div>

      <AnimatePresence>{taker && <TakerToken key="taker" taker={taker} />}</AnimatePresence>

      <ol
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1.5 pt-3 [scrollbar-width:thin]',
          isBid && 'min-[900px]:flex-row-reverse',
        )}
        aria-label={`Queue at ${level.price}, head first`}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {level.orders.map((o, i) => (
            <Chip
              key={o.id}
              order={o}
              side={side}
              isHead={i === 0}
              isTail={i === n - 1}
              isNext={active && o.id === nextUp?.id}
              lifoNext={priority === 'lifo' && o.id === nextUp?.id && n > 1}
              focused={focus.orderId === o.id}
              joined={focus.joinedId === o.id}
              flashKey={focus.orderId === o.id ? focus.flashKey : null}
              checkout={checkout}
              predicting={predicting}
              onGuess={onGuess}
            />
          ))}
        </AnimatePresence>
        <li
          aria-hidden
          className={cn(
            'flex h-[50px] shrink-0 items-center justify-center rounded-lg border border-dashed border-control px-2 text-center text-[11px] leading-tight text-faint',
            n === 0 ? 'w-auto min-w-28' : 'w-12',
          )}
        >
          {n === 0 ? (checkout ? 'No one in line' : `No ${sideName}s here`) : checkout ? 'join here' : 'tail'}
        </li>
      </ol>
    </div>
  )
}

function Chip({
  order,
  side,
  isHead,
  isTail,
  isNext,
  lifoNext,
  focused,
  joined,
  flashKey,
  checkout,
  predicting,
  onGuess,
}: {
  order: Order
  side: Side
  isHead: boolean
  isTail: boolean
  isNext: boolean
  lifoNext: boolean
  focused: boolean
  joined: boolean
  flashKey: string | null
  checkout: boolean
  predicting: Prediction | null
  onGuess: (id: number) => void
}) {
  const isBid = side === 'buy'
  const width = (checkout ? 76 : 74) + Math.min(order.qty, 20) * 4
  const guessable = predicting !== null && predicting.guess === null
  const guessed = predicting?.guess === order.id
  const reveal = predicting !== null && predicting.guess !== null
  const correct = reveal && predicting.correctId === order.id
  const filled = order.qty === 0
  const label = `Order #${order.id}, ${order.trader}, ${order.qty} ${checkout ? 'items' : 'shares'} at ${order.price}, arrived ${clock(order.time)}${isHead ? ', head of queue' : ''}${isTail && !isHead ? ', tail of queue' : ''}`

  const body = (
    <>
      {/* head / tail tags sit on the lane, above the chip */}
      {(isHead || lifoNext) && (
        <span
          className={cn(
            'absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-[10.5px] font-semibold leading-[17px]',
            lifoNext && !isHead ? 'bg-bad text-ground' : 'bg-ink text-ground',
          )}
        >
          {isHead ? (checkout ? 'at the till' : 'head') : 'LIFO picks'}
        </span>
      )}
      {checkout ? (
        <span className="flex w-full items-center gap-1.5">
          <UserRound className={cn('size-5 shrink-0', isBid ? 'text-bid' : 'text-ask')} aria-hidden />
          <span className="min-w-0 text-left leading-tight">
            <span className="block truncate text-[12.5px] font-semibold text-ink">{order.trader}</span>
            <span className="tnum flex items-center gap-0.5 text-[11px] text-muted">
              <ShoppingBasket className="size-3" aria-hidden />
              {order.qty}
            </span>
          </span>
        </span>
      ) : (
        <span className="flex w-full flex-col leading-none">
          <span className="flex items-baseline justify-between gap-1">
            <span className="tnum truncate text-[11px] text-muted">
              #{order.id} <span className="text-ink/85">{order.trader}</span>
            </span>
            <span className="tnum text-[18px] font-semibold text-ink">{order.qty}</span>
          </span>
          <span className="tnum mt-1 text-left text-[10.5px] text-muted">{clock(order.time)}</span>
        </span>
      )}
      {reveal && (correct || guessed) && (
        <span
          className={cn(
            'absolute -bottom-2 -right-1.5 z-10 grid size-5 place-items-center rounded-full text-ground',
            correct ? 'bg-good' : 'bg-bad',
          )}
        >
          {correct ? <Check className="size-3.5" aria-label="Fills first" /> : <X className="size-3.5" aria-label="Your guess" />}
        </span>
      )}
      <AnimatePresence>
        {flashKey && (
          <motion.span
            key={flashKey}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg bg-white"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </>
  )

  const chipClass = cn(
    'relative flex h-[50px] w-full items-center overflow-visible rounded-lg px-2 text-left',
    isBid ? 'bg-bid-soft border-l-[3px] border-bid' : 'bg-ask-soft hatch-ask-edge pr-3',
    isHead && 'ring-2 ring-ink',
    focused && 'ring-2 ring-white shadow-[0_0_0_5px_rgb(255_255_255/0.12)]',
    isNext && !focused && 'ring-2 ring-white/80',
    joined && 'ring-2 ring-focus/70',
    filled && 'opacity-60',
    guessable && 'cursor-pointer hover:brightness-125',
    reveal && correct && 'ring-2 ring-good',
    reveal && guessed && !correct && 'ring-2 ring-bad',
  )

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, x: isBid ? -28 : 28 }}
      animate={{ opacity: 1, x: 0, width }}
      exit={{ opacity: 0, y: -22, scale: 0.85, transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="relative shrink-0"
      style={{ width }}
    >
      {guessable ? (
        <button type="button" className={chipClass} aria-label={`Guess: ${label}`} onClick={() => onGuess(order.id)}>
          {body}
        </button>
      ) : (
        <div className={chipClass} aria-label={label} role="img">
          {body}
        </div>
      )}
    </motion.li>
  )
}

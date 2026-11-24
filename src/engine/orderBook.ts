import { OrderQueue } from './queue'
import type {
  BookEvent,
  BookSnapshot,
  LevelSnapshot,
  LogEntry,
  Order,
  Priority,
  Side,
  Taker,
  Trade,
} from './types'

export interface BookConfig {
  /** Bid prices, best (highest) first. */
  bidPrices: number[]
  /** Ask prices, best (lowest) first. */
  askPrices: number[]
}

export const DEFAULT_CONFIG: BookConfig = {
  bidPrices: [99, 98, 97, 96, 95],
  askPrices: [101, 102, 103, 104, 105],
}

/**
 * Names on the simulated orders: real firms that trade on real exchanges.
 * The orders are made up; these firms did not place them.
 */
const TRADERS = [
  'Goldman Sachs', 'J.P. Morgan', 'Citadel Securities', 'Morgan Stanley', 'Jane Street', 'Bank of America',
  'Barclays', 'UBS', 'Virtu Financial', 'Citi', 'HSBC', 'Deutsche Bank',
]

export function traderFor(id: number): string {
  return TRADERS[(id - 1) % TRADERS.length]
}

export const MAX_QTY = 99

/**
 * A limit order book for one instrument. Every price level is an
 * OrderQueue, so orders at the same price trade in arrival order.
 *
 * The book is UI-independent: each public method returns the list of
 * events it produced, each paired with a snapshot of the book right after
 * that event. The UI animates by walking through that list.
 */
export class OrderBook {
  readonly config: BookConfig
  private bids = new Map<number, OrderQueue<Order>>()
  private asks = new Map<number, OrderQueue<Order>>()
  private nextId = 1
  private clock = 0
  private nextTradeId = 1
  private seq = 0
  priority: Priority = 'fifo'

  constructor(config: BookConfig = DEFAULT_CONFIG, priority: Priority = 'fifo') {
    this.config = config
    this.priority = priority
    for (const p of config.bidPrices) this.bids.set(p, new OrderQueue())
    for (const p of config.askPrices) this.asks.set(p, new OrderQueue())
  }

  /** Rest a limit order at the TAIL of its price level. O(1). */
  addLimit(side: Side, price: number, qty: number, trader?: string): LogEntry[] {
    assertQty(qty)
    const level = this.levelsFor(side).get(price)
    if (!level) {
      throw new Error(`No ${side === 'buy' ? 'bid' : 'ask'} level at ${price}`)
    }
    const id = this.nextId++
    const order: Order = {
      id,
      side,
      price,
      qty,
      originalQty: qty,
      time: ++this.clock,
      trader: trader ?? traderFor(id),
    }
    level.enqueue(order)
    return [
      this.entry(
        { kind: 'enqueue', order: { ...order }, position: level.size - 1, queueLength: level.size },
        null,
      ),
    ]
  }

  /**
   * Execute a market order against the opposite side.
   * Price priority: visit the best price level first.
   * Time priority: inside a level, trade from the HEAD (FIFO).
   */
  market(side: Side, qty: number, trader?: string): LogEntry[] {
    assertQty(qty)
    const out: LogEntry[] = []
    const id = this.nextId++
    const taker: Taker = {
      id,
      side,
      qty,
      remaining: qty,
      time: ++this.clock,
      trader: trader ?? traderFor(id),
    }
    const snap = () => ({ ...taker })
    const emit = (event: BookEvent) => out.push(this.entry(event, snap()))
    const trades: Trade[] = []

    emit({ kind: 'market-arrive', taker: snap() })

    const makerSide: Side = side === 'buy' ? 'sell' : 'buy'
    const prices = side === 'buy' ? this.config.askPrices : this.config.bidPrices
    const book = this.levelsFor(makerSide)
    const end = this.priority === 'fifo' ? 'head' : 'tail'

    for (const price of prices) {
      if (taker.remaining === 0) break
      const level = book.get(price)!
      if (level.isEmpty()) continue
      emit({ kind: 'visit-level', taker: snap(), makerSide, price, queueLength: level.size })

      while (taker.remaining > 0 && !level.isEmpty()) {
        const maker = (end === 'head' ? level.peek() : level.peekTail())!
        emit({ kind: 'peek', taker: snap(), order: { ...maker }, end })

        const fill = Math.min(taker.remaining, maker.qty)
        maker.qty -= fill
        taker.remaining -= fill
        const trade: Trade = {
          id: this.nextTradeId++,
          price,
          qty: fill,
          makerId: maker.id,
          makerTrader: maker.trader,
          makerTime: maker.time,
          takerId: taker.id,
          takerTrader: taker.trader,
          takerSide: side,
        }
        trades.push(trade)
        emit({ kind: 'fill', taker: snap(), trade, makerRemaining: maker.qty, end })

        if (maker.qty === 0) {
          const removed = (end === 'head' ? level.dequeue() : level.popTail())!
          emit({ kind: 'dequeue', taker: snap(), order: { ...removed }, end, price })
        }
      }
      if (level.isEmpty()) emit({ kind: 'level-empty', taker: snap(), makerSide, price })
    }

    const filled = qty - taker.remaining
    out.push(
      this.entry(
        { kind: 'market-done', taker: snap(), filled, unfilled: taker.remaining, trades },
        null,
      ),
    )
    return out
  }

  snapshot(): BookSnapshot {
    const level = (q: OrderQueue<Order>, price: number): LevelSnapshot => ({
      price,
      orders: q.toArray().map((o) => ({ ...o })),
    })
    return {
      bids: this.config.bidPrices.map((p) => level(this.bids.get(p)!, p)),
      asks: this.config.askPrices.map((p) => level(this.asks.get(p)!, p)),
      priority: this.priority,
    }
  }

  /** Deep copy, including the id/clock counters, so replays match exactly. */
  clone(): OrderBook {
    const b = new OrderBook(this.config, this.priority)
    for (const [p, q] of this.bids) b.bids.set(p, q.map((o) => ({ ...o })))
    for (const [p, q] of this.asks) b.asks.set(p, q.map((o) => ({ ...o })))
    b.nextId = this.nextId
    b.clock = this.clock
    b.nextTradeId = this.nextTradeId
    b.seq = this.seq
    return b
  }

  /** Total resting shares on one side (for validating market orders). */
  depth(side: Side): number {
    let total = 0
    for (const q of this.levelsFor(side).values()) for (const o of q) total += o.qty
    return total
  }

  private levelsFor(side: Side) {
    return side === 'buy' ? this.bids : this.asks
  }

  private entry(event: BookEvent, taker: Taker | null): LogEntry {
    return { seq: ++this.seq, event, book: this.snapshot(), taker }
  }
}

function assertQty(qty: number) {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
    throw new Error(`Size must be a whole number from 1 to ${MAX_QTY}`)
  }
}

/** Run the same market order under FIFO and LIFO on copies of the book. */
export function compareFairness(book: OrderBook, side: Side, qty: number) {
  const run = (priority: Priority) => {
    const copy = book.clone()
    copy.priority = priority
    const log = copy.market(side, qty)
    const done = log[log.length - 1].event
    return done.kind === 'market-done' ? done.trades : []
  }
  return { fifo: run('fifo'), lifo: run('lifo') }
}

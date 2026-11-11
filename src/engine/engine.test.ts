import { describe, expect, it } from 'vitest'
import { OrderQueue } from './queue'
import { OrderBook, compareFairness } from './orderBook'
import {
  createSession,
  currentBook,
  pushCommand,
  resetSession,
  shownTrades,
  stepBack,
  stepForward,
  type Command,
} from './session'
import type { BookEvent, LogEntry } from './types'

const kinds = (log: LogEntry[]) => log.map((e) => e.event.kind)
const trades = (log: LogEntry[]) => {
  const done = log[log.length - 1].event as Extract<BookEvent, { kind: 'market-done' }>
  return done.trades
}

describe('OrderQueue', () => {
  it('dequeues in the order items were enqueued (FIFO)', () => {
    const q = new OrderQueue<string>()
    q.enqueue('a')
    q.enqueue('b')
    q.enqueue('c')
    expect(q.peek()).toBe('a')
    expect(q.peekTail()).toBe('c')
    expect([q.dequeue(), q.dequeue(), q.dequeue()]).toEqual(['a', 'b', 'c'])
    expect(q.dequeue()).toBeUndefined()
    expect(q.isEmpty()).toBe(true)
  })

  it('keeps head and tail consistent through mixed operations', () => {
    const q = new OrderQueue<number>()
    q.enqueue(1)
    expect(q.dequeue()).toBe(1)
    expect(q.peek()).toBeUndefined()
    expect(q.peekTail()).toBeUndefined()
    q.enqueue(2)
    q.enqueue(3)
    expect(q.popTail()).toBe(3)
    expect(q.popTail()).toBe(2)
    expect(q.size).toBe(0)
    q.enqueue(4)
    q.enqueue(5)
    expect(q.toArray()).toEqual([4, 5])
  })

  it('does constant work per enqueue/dequeue (100k ops finish fast)', () => {
    const q = new OrderQueue<number>()
    const t0 = performance.now()
    for (let i = 0; i < 100_000; i++) q.enqueue(i)
    for (let i = 0; i < 100_000; i++) expect(q.dequeue()).toBe(i)
    expect(performance.now() - t0).toBeLessThan(1000)
  })
})

describe('OrderBook limit orders', () => {
  it('enqueues new orders at the tail of their price level', () => {
    const b = new OrderBook()
    b.addLimit('sell', 101, 5)
    const log = b.addLimit('sell', 101, 3)
    const ev = log[0].event
    expect(ev.kind).toBe('enqueue')
    if (ev.kind === 'enqueue') {
      expect(ev.position).toBe(1)
      expect(ev.queueLength).toBe(2)
    }
    expect(b.snapshot().asks[0].orders.map((o) => o.id)).toEqual([1, 2])
  })

  it('rejects unknown price levels and bad sizes', () => {
    const b = new OrderBook()
    expect(() => b.addLimit('buy', 101, 1)).toThrow()
    expect(() => b.addLimit('buy', 99, 0)).toThrow()
    expect(() => b.addLimit('buy', 99, 2.5)).toThrow()
  })
})

describe('OrderBook market orders', () => {
  it('fills the oldest order at the best price first (FIFO)', () => {
    const b = new OrderBook()
    b.addLimit('sell', 101, 5) // #1 arrives first
    b.addLimit('sell', 101, 5) // #2 same price, later
    const log = b.market('buy', 5)
    expect(trades(log).map((t) => t.makerId)).toEqual([1])
    expect(b.snapshot().asks[0].orders.map((o) => o.id)).toEqual([2])
  })

  it('shrinks the head on a partial fill and keeps it at the head', () => {
    const b = new OrderBook()
    b.addLimit('buy', 99, 10) // #1
    b.addLimit('buy', 99, 4) // #2
    const log = b.market('sell', 6)
    expect(kinds(log)).toEqual(['market-arrive', 'visit-level', 'peek', 'fill', 'market-done'])
    const level = b.snapshot().bids[0]
    expect(level.orders.map((o) => [o.id, o.qty])).toEqual([
      [1, 4],
      [2, 4],
    ])
  })

  it('sweeps several levels in price order, emptying each queue head-first', () => {
    const b = new OrderBook()
    b.addLimit('sell', 102, 4) // #1 worse price, arrived first
    b.addLimit('sell', 101, 2) // #2 best price
    b.addLimit('sell', 101, 3) // #3 best price
    b.addLimit('sell', 103, 9) // #4
    const log = b.market('buy', 8)
    const t = trades(log)
    expect(t.map((x) => [x.makerId, x.price, x.qty])).toEqual([
      [2, 101, 2],
      [3, 101, 3],
      [1, 102, 3],
    ])
    expect(kinds(log).filter((k) => k === 'level-empty')).toHaveLength(1)
    const snap = b.snapshot()
    expect(snap.asks[0].orders).toHaveLength(0)
    expect(snap.asks[1].orders.map((o) => o.qty)).toEqual([1])
    expect(snap.asks[2].orders.map((o) => o.qty)).toEqual([9])
  })

  it('gives price priority over time priority across levels', () => {
    const b = new OrderBook()
    b.addLimit('buy', 97, 5) // #1 earliest but worse price
    b.addLimit('buy', 99, 5) // #2 best bid
    const log = b.market('sell', 5)
    expect(trades(log)[0].makerId).toBe(2)
    expect(trades(log)[0].price).toBe(99)
  })

  it('reports the unfilled remainder when the book runs out', () => {
    const b = new OrderBook()
    b.addLimit('sell', 101, 3)
    const log = b.market('buy', 5)
    const done = log[log.length - 1].event
    expect(done).toMatchObject({ kind: 'market-done', filled: 3, unfilled: 2 })
  })

  it('under LIFO takes the newest order first (the fairness contrast)', () => {
    const b = new OrderBook()
    b.addLimit('sell', 101, 5) // #1
    b.addLimit('sell', 101, 5) // #2
    b.addLimit('sell', 101, 5) // #3
    const { fifo, lifo } = compareFairness(b, 'buy', 5)
    expect(fifo.map((t) => t.makerId)).toEqual([1])
    expect(lifo.map((t) => t.makerId)).toEqual([3])
    // compareFairness must not touch the real book
    expect(b.snapshot().asks[0].orders).toHaveLength(3)
  })

  it('attaches a snapshot to every event', () => {
    const b = new OrderBook()
    b.addLimit('sell', 101, 2)
    const log = b.market('buy', 2)
    const fill = log.find((e) => e.event.kind === 'fill')!
    expect(fill.book.asks[0].orders[0].qty).toBe(0) // shrunk, not yet removed
    const deq = log.find((e) => e.event.kind === 'dequeue')!
    expect(deq.book.asks[0].orders).toHaveLength(0)
  })
})

describe('Session (event-log playback)', () => {
  const seed: Command[] = [
    { type: 'limit', side: 'sell', price: 101, qty: 3 },
    { type: 'limit', side: 'sell', price: 101, qty: 3 },
  ]

  it('steps forward and back deterministically', () => {
    let s = createSession(seed)
    s = pushCommand(s, { type: 'market', side: 'buy', qty: 4, priority: 'fifo' })
    expect(s.cursor).toBe(0)
    expect(currentBook(s).asks[0].orders).toHaveLength(2)
    while (s.cursor < s.log.length) s = stepForward(s)
    expect(currentBook(s).asks[0].orders.map((o) => [o.id, o.qty])).toEqual([[2, 2]])
    expect(shownTrades(s).map((t) => t.makerId)).toEqual([1, 2])
    s = stepBack(s)
    s = stepBack(s)
    const again = stepForward(stepForward(s))
    expect(currentBook(again)).toEqual(currentBook({ ...s, cursor: s.log.length }))
  })

  it('reset returns to the seed and replays identically', () => {
    const cmd: Command = { type: 'market', side: 'buy', qty: 4, priority: 'fifo' }
    const a = pushCommand(createSession(seed), cmd)
    const b = pushCommand(resetSession(a), cmd)
    expect(b.log.map((e) => e.event)).toEqual(a.log.map((e) => e.event))
  })

  it('refuses a market order with nothing to trade against', () => {
    expect(() =>
      pushCommand(createSession([]), { type: 'market', side: 'buy', qty: 1, priority: 'fifo' }),
    ).toThrow(/No sellers/)
  })
})

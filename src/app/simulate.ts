import type { Command } from '@/engine/session'
import type { BookSnapshot, Priority, Side } from '@/engine/types'

/** mulberry32: a tiny seeded PRNG, so a simulation run is repeatable. */
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, (seed + 0x6d2b79f5) | 0]
}

class Rng {
  constructor(public seed: number) {}
  next() {
    const [v, s] = nextRandom(this.seed)
    this.seed = s
    return v
  }
  int(lo: number, hi: number) {
    return lo + Math.floor(this.next() * (hi - lo + 1))
  }
  pick<T>(items: T[], weights: number[]) {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r < 0) return items[i]
    }
    return items[items.length - 1]
  }
}

const shares = (book: BookSnapshot, side: Side) =>
  (side === 'buy' ? book.bids : book.asks).reduce((n, l) => n + l.orders.reduce((m, o) => m + o.qty, 0), 0)
const count = (book: BookSnapshot, side: Side) =>
  (side === 'buy' ? book.bids : book.asks).reduce((n, l) => n + l.orders.length, 0)

/** Prices near the spread are busier, like a real book. */
const LEVEL_WEIGHTS = [0.34, 0.26, 0.2, 0.12, 0.08]

/**
 * Invent the next order for the live simulation. Mostly limit orders that
 * queue up, with market orders that eat into whichever side is fuller.
 */
export function nextOrder(book: BookSnapshot, priority: Priority, seed: number): { command: Command; seed: number } {
  const rng = new Rng(seed)
  const bidN = count(book, 'buy')
  const askN = count(book, 'sell')
  const crowded = Math.max(bidN, askN) >= 16
  const wantMarket = rng.next() < (crowded ? 0.55 : 0.3)

  if (wantMarket) {
    // A market buy eats asks; a market sell eats bids. Prefer the fuller side.
    const side: Side = rng.next() < askN / Math.max(1, askN + bidN) ? 'buy' : 'sell'
    const available = shares(book, side === 'buy' ? 'sell' : 'buy')
    if (available >= 3) {
      const qty = Math.min(available, rng.int(2, 11))
      return { command: { type: 'market', side, qty, priority }, seed: rng.seed }
    }
  }
  // Refill the thinner side more often, so neither side stays empty.
  const side: Side = rng.next() < (askN + 1) / (askN + bidN + 2) ? 'buy' : 'sell'
  const levels = side === 'buy' ? book.bids : book.asks
  const level = rng.pick(levels, LEVEL_WEIGHTS)
  if (level.orders.length >= 5) {
    // That line is long: send a market order at it instead of making it longer.
    const qty = Math.min(shares(book, side), rng.int(3, 10))
    return { command: { type: 'market', side: side === 'buy' ? 'sell' : 'buy', qty, priority }, seed: rng.seed }
  }
  return { command: { type: 'limit', side, price: level.price, qty: rng.int(1, 8) }, seed: rng.seed }
}

import { rng } from './rng'
import type { Priority, Side } from './types'

/**
 * The four levels of "Match the Book". Each adds one idea. Prices are
 * whole dollars: bids below 100, asks above it. Lanes are listed best
 * price first (highest bid, lowest ask).
 */
export interface LevelDef {
  id: number
  name: string
  /** The one line of instruction the level gets. */
  hint: string
  bids: number[]
  asks: number[]
  /** Which end of a lane the rule fills first. */
  policy: Priority
  /** Limit orders already resting when the level starts. */
  initial: number
  /** Limit orders that arrive during the level. */
  limits: number
  limitGap: [number, number]
  limitSize: [number, number]
  /** Market orders in the level. */
  markets: number
  marketGap: [number, number]
  marketSize: [number, number]
  /** How long a market order waits to be filled, ms. */
  patienceMs: number
  seed: number
  /** Score for the third star (0: no score star). */
  target: number
  maxMs: number
}

const BOOK3 = {
  bids: [99, 98, 97],
  asks: [101, 102, 103],
  initial: 9,
  limits: 30,
  limitGap: [650, 1150] as [number, number],
  limitSize: [1, 3] as [number, number],
  markets: 14,
  marketGap: [2300, 3300] as [number, number],
  marketSize: [1, 4] as [number, number],
  patienceMs: 9000,
  seed: 303,
  maxMs: 75_000,
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'One lane',
    hint: 'Fill from the head.',
    bids: [],
    asks: [101],
    policy: 'fifo',
    initial: 3,
    limits: 13,
    limitGap: [1500, 2300],
    limitSize: [1, 1],
    markets: 15,
    marketGap: [1700, 2500],
    marketSize: [1, 1],
    patienceMs: 6000,
    seed: 101,
    target: 270,
    maxMs: 60_000,
  },
  {
    id: 2,
    name: 'Partial fills',
    hint: 'Big orders take several taps. A chip stays at the head until it is used up.',
    bids: [],
    asks: [101],
    policy: 'fifo',
    initial: 4,
    limits: 17,
    limitGap: [1300, 2000],
    limitSize: [1, 4],
    markets: 11,
    marketGap: [2600, 3600],
    marketSize: [2, 5],
    patienceMs: 8000,
    seed: 202,
    target: 500,
    maxMs: 60_000,
  },
  {
    id: 3,
    name: 'Price levels',
    hint: 'Best price first, then the head of that lane.',
    policy: 'fifo',
    target: 600,
    ...BOOK3,
  },
  {
    id: 4,
    name: 'FIFO vs LIFO',
    hint: 'The same orders again. Now the newest chip fills first.',
    policy: 'lifo',
    target: 0,
    ...BOOK3,
  },
]

export interface LimitArrival {
  /** Arrival number, 1-based. Shown on the chip. */
  id: number
  at: number
  side: Side
  /** Index into the side's price list. */
  lane: number
  size: number
  /** Which trader sprite to draw. */
  look: number
}

export interface MarketArrival {
  id: number
  at: number
  /** Buy takes from asks; sell takes from bids. */
  side: Side
  size: number
}

export interface Script {
  limits: LimitArrival[]
  markets: MarketArrival[]
}

const between = (r: () => number, [lo, hi]: [number, number]) => lo + Math.floor(r() * (hi - lo + 1))

/**
 * The level's orders, fixed by its seed: the same level always deals the
 * same orders, which is what makes replays and the FIFO/LIFO comparison
 * fair. Lanes nearer the best price get more orders, as in real books.
 */
export function scriptFor(def: LevelDef): Script {
  const r = rng(def.seed)
  const sides: Side[] = [...(def.bids.length ? (['buy'] as Side[]) : []), ...(def.asks.length ? (['sell'] as Side[]) : [])]
  const limits: LimitArrival[] = []
  const lanePick = (n: number) => {
    const x = r()
    return n === 1 ? 0 : x < 0.5 ? 0 : x < 0.8 ? 1 : Math.min(2, n - 1)
  }
  const total = def.initial + def.limits
  let at = 0
  for (let i = 1; i <= total; i++) {
    const side = sides[Math.floor(r() * sides.length)]
    const lane = lanePick(side === 'buy' ? def.bids.length : def.asks.length)
    const size = between(r, def.limitSize)
    const look = (i * 3 + Math.floor(r() * 3)) % 8
    if (i > def.initial) at += between(r, def.limitGap)
    limits.push({ id: i, at, side, lane, size, look })
  }
  const markets: MarketArrival[] = []
  let mt = 1200
  for (let k = 1; k <= def.markets; k++) {
    // A buy takes from the asks, a sell from the bids.
    const side: Side = sides.length === 1 ? (sides[0] === 'sell' ? 'buy' : 'sell') : r() < 0.5 ? 'buy' : 'sell'
    markets.push({ id: k, at: mt, side, size: between(r, def.marketSize) })
    mt += between(r, def.marketGap)
  }
  return { limits, markets }
}

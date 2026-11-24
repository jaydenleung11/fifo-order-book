import { Line } from './line'
import { scriptFor, type LevelDef, type LimitArrival, type MarketArrival } from './levels'
import type { Priority, Side } from './types'

/**
 * "Match the Book" as a pure simulation: the player is the matching engine.
 *
 * Limit orders arrive and join the TAIL of their price lane (enqueue).
 * Market orders arrive one after another; the one at the front is active
 * and the player fills it by tapping chips on the opposite side. A tap
 * trades min(chip size, order still wanted). The rule is: best price
 * first, and the HEAD of that lane (FIFO) – or, in the LIFO level, the
 * tail.
 *
 * Nothing here knows about React or real time. The UI calls advance(t)
 * with the game clock and tap(t, ...) when the player acts. Every tap is
 * kept in an input log, so replay(def, inputs) rebuilds the same game,
 * and autoplay() runs both rules on the same orders with the same timing.
 */

export interface Chip extends LimitArrival {
  /** Size still resting. Shrinks on a partial fill. */
  left: number
  /** Someone behind this chip was filled first. */
  jumped: boolean
}

export interface ActiveMarket extends MarketArrival {
  left: number
  /** When it became the active order (its patience starts here). */
  since: number
}

export interface Input {
  at: number
  /** Lane index on the side being taken; undefined = the best lane. */
  lane?: number
  /** Chip tapped; undefined = whichever chip the rule picks. */
  id?: number
}

export type Mistake = 'jump' | 'price'

export interface Fill {
  type: 'fill'
  at: number
  market: number
  /** Side the chip rests on. */
  side: Side
  lane: number
  price: number
  chip: number
  qty: number
  ok: boolean
  fair: boolean
  mistake?: Mistake
  points: number
  /** How the chip left: dequeue (head), pop (tail), cut (middle), or partial (stayed). */
  op: 'dequeue' | 'pop' | 'cut' | 'partial'
  combo: number
}

export type MatchEvent =
  | { type: 'enqueue'; at: number; side: Side; lane: number; chip: number }
  | { type: 'market'; at: number; market: number }
  | Fill
  | { type: 'done-market'; at: number; market: number }
  | { type: 'expire'; at: number; market: number; left: number }

export interface Result {
  score: number
  stars: number
  /** Share of fills that took the oldest chip at the best price, 0..1. */
  fairness: number
  mistakes: number
  bestCombo: number
  /** Market orders that ran out of patience. */
  missed: number
  /** Longest a chip waited from joining to being used up, ms. */
  longestWait: number
  /** Chips used up while an older chip at the same price still waited. */
  jumped: number
  /** Chip numbers in the order they were used up. */
  order: number[]
}

export const POINTS = { fill: 10, mistake: -25, missed: -10 }
export const multiplier = (combo: number) => Math.min(4, 1 + Math.floor(combo / 4))

export class Match {
  readonly def: LevelDef
  readonly policy: Priority
  readonly limits: LimitArrival[]
  readonly marketsIn: MarketArrival[]
  t = 0
  bids: Line<Chip>[]
  asks: Line<Chip>[]
  /** Market orders that have arrived and are waiting their turn. */
  pending: MarketArrival[] = []
  active: ActiveMarket | null = null
  score = 0
  combo = 0
  bestCombo = 0
  mistakes = 0
  missed = 0
  fills = 0
  fairFills = 0
  done = false
  endAt = 0
  readonly log: MatchEvent[] = []
  readonly inputs: Input[] = []
  private nextLimit = 0
  private nextMarket = 0
  private usedUp: { id: number; wait: number; lane: string }[] = []

  constructor(def: LevelDef, policy: Priority = def.policy) {
    this.def = def
    this.policy = policy
    const s = scriptFor(def)
    this.limits = s.limits
    this.marketsIn = s.markets
    this.bids = def.bids.map(() => new Line<Chip>())
    this.asks = def.asks.map(() => new Line<Chip>())
    this.advance(0)
  }

  lanes(side: Side): Line<Chip>[] {
    return side === 'buy' ? this.bids : this.asks
  }

  prices(side: Side): number[] {
    return side === 'buy' ? this.def.bids : this.def.asks
  }

  /** The side the active market order takes from. */
  takeSide(): Side | null {
    if (!this.active) return null
    return this.active.side === 'buy' ? 'sell' : 'buy'
  }

  /** Best lane with anything resting on a side (lanes are listed best first). */
  bestLane(side: Side): number {
    const i = this.lanes(side).findIndex((l) => l.size > 0)
    return i < 0 ? -1 : i
  }

  /** The chip the rule fills next in a lane. */
  pick(side: Side, lane: number): Chip | undefined {
    const l = this.lanes(side)[lane]
    if (!l) return undefined
    return this.policy === 'fifo' ? l.peek() : l.peekTail()
  }

  /** Seconds-left fraction of the active order's patience, 0..1. */
  patience(): number {
    if (!this.active) return 1
    return Math.max(0, 1 - (this.t - this.active.since) / this.def.patienceMs)
  }

  private activate(at: number) {
    if (this.active || this.pending.length === 0) return
    const m = this.pending.shift()!
    this.active = { ...m, left: m.size, since: at }
    this.log.push({ type: 'market', at, market: m.id })
  }

  /** Run the clock: limit orders join their lane, market orders arrive, patience runs out. */
  advance(to: number): void {
    if (this.done) return
    for (;;) {
      const lim = this.limits[this.nextLimit]
      const mkt = this.marketsIn[this.nextMarket]
      const expireAt = this.active ? this.active.since + this.def.patienceMs : Infinity
      const next = Math.min(lim?.at ?? Infinity, mkt?.at ?? Infinity, expireAt)
      if (next > to || next === Infinity) break
      this.t = next
      if (lim && lim.at === next) {
        this.lanes(lim.side)[lim.lane].enqueue({ ...lim, left: lim.size, jumped: false })
        this.log.push({ type: 'enqueue', at: next, side: lim.side, lane: lim.lane, chip: lim.id })
        this.nextLimit++
      } else if (mkt && mkt.at === next) {
        this.pending.push(mkt)
        this.nextMarket++
        this.activate(next)
      } else {
        const a = this.active!
        this.log.push({ type: 'expire', at: next, market: a.id, left: a.left })
        this.missed++
        this.combo = 0
        this.score = Math.max(0, this.score + POINTS.missed)
        this.active = null
        this.activate(next)
      }
    }
    this.t = Math.max(this.t, to)
    this.checkDone(to)
    if (to >= this.def.maxMs) this.finish(this.def.maxMs)
  }

  private checkDone(at: number) {
    if (this.nextMarket >= this.marketsIn.length && !this.active && this.pending.length === 0) this.finish(at)
  }

  /**
   * The player taps a chip. Returns the fill, or null if the tap could not
   * trade (no active order, an empty lane, or a lane on the wrong side).
   */
  tap(at: number, lane?: number, id?: number): Fill | null {
    this.advance(at)
    if (this.done || !this.active) return null
    const side = this.takeSide()!
    const best = this.bestLane(side)
    if (best < 0) return null
    const ln = lane ?? best
    const line = this.lanes(side)[ln]
    if (!line || line.size === 0) return null
    const rulePick = this.pick(side, ln)!
    const chip = id === undefined ? rulePick : line.toArray().find((c) => c.id === id)
    if (!chip) return null
    this.inputs.push({ at, lane, id })

    const head = this.lanes(side)[best].peek()!
    const priceOk = ln === best
    const timeOk = chip === rulePick
    const ok = priceOk && timeOk
    const fair = priceOk && chip === head
    const mistake: Mistake | undefined = !priceOk ? 'price' : !timeOk ? 'jump' : undefined

    let points: number
    if (ok) {
      points = POINTS.fill * multiplier(this.combo)
      this.combo++
      this.bestCombo = Math.max(this.bestCombo, this.combo)
    } else {
      points = POINTS.mistake
      this.combo = 0
      this.mistakes++
      // Everyone ahead of the chip that jumped the queue saw it happen.
      for (const c of line) {
        if (c === chip) break
        c.jumped = true
      }
      if (mistake === 'price') for (const c of this.lanes(side)[best]) c.jumped = true
    }
    this.score = Math.max(0, this.score + points)
    this.fills++
    if (fair) this.fairFills++

    const a = this.active
    const qty = Math.min(chip.left, a.left)
    chip.left -= qty
    a.left -= qty

    let op: Fill['op'] = 'partial'
    if (chip.left === 0) {
      if (line.peek() === chip) {
        line.dequeue()
        op = 'dequeue'
      } else if (line.peekTail() === chip) {
        line.popTail()
        op = 'pop'
      } else {
        line.removeWhere((c) => c === chip)
        op = 'cut'
      }
      this.usedUp.push({ id: chip.id, wait: at - chip.at, lane: `${side}${ln}` })
    }
    const fill: Fill = {
      type: 'fill',
      at,
      market: a.id,
      side,
      lane: ln,
      price: this.prices(side)[ln],
      chip: chip.id,
      qty,
      ok,
      fair,
      mistake,
      points,
      op,
      combo: this.combo,
    }
    this.log.push(fill)
    if (a.left === 0) {
      this.log.push({ type: 'done-market', at, market: a.id })
      this.active = null
      this.activate(at)
    }
    this.checkDone(at)
    return fill
  }

  /** Mood of a resting chip's trader. */
  mood(c: Chip, now = this.t): 'happy' | 'meh' | 'angry' {
    if (c.jumped) return 'angry'
    const w = now - c.at
    if (w > 14_000) return 'meh'
    return 'happy'
  }

  /** Every fill so far, oldest first (the trade tape). */
  tape(): Fill[] {
    return this.log.filter((e): e is Fill => e.type === 'fill')
  }

  private finish(at: number) {
    if (this.done) return
    this.done = true
    this.endAt = at
  }

  result(): Result {
    const fairness = this.fills === 0 ? 1 : this.fairFills / this.fills
    const allMarkets = this.nextMarket >= this.marketsIn.length && !this.active && this.pending.length === 0
    let stars = allMarkets ? 1 : 0
    if (allMarkets && fairness >= 0.9 && this.missed <= 1) stars++
    if (allMarkets && this.def.target > 0 && this.score >= this.def.target) stars++
    return {
      score: this.score,
      stars,
      fairness,
      mistakes: this.mistakes,
      bestCombo: this.bestCombo,
      missed: this.missed,
      longestWait: this.usedUp.reduce((m, u) => Math.max(m, u.wait), 0),
      jumped: jumpedCount(this.usedUp),
      order: this.usedUp.map((u) => u.id),
    }
  }
}

/** Chips used up while an older chip in the same lane was still resting. */
export function jumpedCount(used: { id: number; lane: string }[]): number {
  let n = 0
  const minAfter = new Map<string, number>()
  for (let i = used.length - 1; i >= 0; i--) {
    const { id, lane } = used[i]
    const m = minAfter.get(lane) ?? Infinity
    if (id > m) n++
    minAfter.set(lane, Math.min(m, id))
  }
  return n
}

/** Rebuild a game from its input log. Same inputs, same game. */
export function replay(def: LevelDef, inputs: Input[], until?: number, policy?: Priority): Match {
  const m = new Match(def, policy)
  for (const i of inputs) m.tap(i.at, i.lane, i.id)
  if (until !== undefined) m.advance(until)
  return m
}

/**
 * Play a level automatically under a rule, tapping the rule's chip at the
 * given times; after those, keep tapping every 50 ms until the level ends.
 * Used to compare FIFO and LIFO on the same orders and the same timing.
 */
export function autoplay(def: LevelDef, policy: Priority, times: number[]): Match {
  const m = new Match(def, policy)
  for (const t of times) m.tap(t)
  let t = times.length ? times[times.length - 1] : 0
  while (!m.done && t < def.maxMs) {
    t += 50
    m.tap(t)
  }
  m.advance(Math.max(t, m.t))
  return m
}

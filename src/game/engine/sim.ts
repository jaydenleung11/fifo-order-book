import { Line } from './line'
import { scriptFor, type Arrival, type LevelDef, type Policy } from './levels'

/**
 * The game, as a pure simulation. Nothing here knows about React or time
 * passing on its own: the UI calls advance(t) with the game clock and
 * serve(t, ...) when the player acts. Every player action is kept in an
 * input log, so replay(def, inputs) rebuilds exactly the same game, and the
 * FIFO/LIFO comparison can run the same customers with the same timing.
 */

export interface Customer extends Arrival {
  got: number
  /** Someone behind was served first. */
  skipped: boolean
}

export interface Input {
  at: number
  /** Lane chosen; undefined means "the best lane". */
  lane?: number
  /** Customer chosen; undefined means "whoever the rule says". */
  id?: number
}

export type Reason = 'time' | 'price'

export type SimEvent =
  | { type: 'enqueue'; at: number; lane: number; id: number }
  | { type: 'dish'; at: number }
  | {
      type: 'serve'
      at: number
      lane: number
      id: number
      ok: boolean
      fair: boolean
      reason?: Reason
      points: number
      /** The customer's order is complete and they left the line. */
      done: boolean
      /** How they left: dequeue (front), pop (back), or cut (middle). */
      op: 'dequeue' | 'pop' | 'cut' | 'partial'
      combo: number
    }

export interface Result {
  score: number
  stars: number
  /** Share of items that went to whoever had waited longest, 0..1. */
  fairness: number
  /** Longest time from joining to leaving, ms. */
  longestWait: number
  /** Customers who left angry. */
  angry: number
  /** Ticket numbers in the order customers finished. */
  order: number[]
  mistakes: number
  bestCombo: number
  /** Customers who finished before someone who had arrived earlier. */
  jumped: number
}

export const POINTS = { serve: 10, late: 5, mistake: -25 }

export const multiplier = (combo: number) => Math.min(4, 1 + Math.floor(combo / 4))

export type Mood = 'happy' | 'meh' | 'angry'

export class Sim {
  readonly def: LevelDef
  readonly script: Arrival[]
  readonly policy: Policy
  t = 0
  lanes: Line<Customer>[]
  dishes = 0
  /** When the next item is ready, or null while the counter is full. */
  nextDishAt: number | null
  score = 0
  combo = 0
  bestCombo = 0
  mistakes = 0
  items = 0
  fairItems = 0
  done = false
  endAt = 0
  readonly log: SimEvent[] = []
  readonly inputs: Input[] = []
  private nextArrival = 0
  private finished: { id: number; wait: number; angry: boolean }[] = []

  constructor(def: LevelDef, policy: Policy = def.policy) {
    this.def = def
    this.policy = policy
    this.script = scriptFor(def)
    this.lanes = def.prices.map(() => new Line<Customer>())
    this.nextDishAt = def.cookMs
  }

  /** Run the clock forward: arrivals join the back, the kitchen cooks. */
  advance(to: number): void {
    if (this.done) return
    for (;;) {
      const arr = this.script[this.nextArrival]
      const arrAt = arr ? arr.at : Infinity
      const dishAt = this.nextDishAt ?? Infinity
      const next = Math.min(arrAt, dishAt)
      if (next > to) break
      if (arrAt <= dishAt) {
        this.t = arrAt
        this.lanes[arr.lane].enqueue({ ...arr, got: 0, skipped: false })
        this.log.push({ type: 'enqueue', at: arrAt, lane: arr.lane, id: arr.id })
        this.nextArrival++
      } else {
        this.t = dishAt
        this.dishes++
        this.log.push({ type: 'dish', at: dishAt })
        this.nextDishAt = this.dishes >= this.def.counterMax ? null : dishAt + this.def.cookMs
      }
    }
    this.t = Math.max(this.t, to)
    if (to >= this.def.maxMs) this.finish(this.def.maxMs)
  }

  waiting(): number {
    return this.lanes.reduce((n, l) => n + l.size, 0)
  }

  /** The best lane that has anyone in it (lanes are listed best first). */
  bestLane(): number {
    const i = this.lanes.findIndex((l) => l.size > 0)
    return i < 0 ? 0 : i
  }

  /** Who the current rule serves next in a lane. */
  pick(lane: number): Customer | undefined {
    const l = this.lanes[lane]
    return this.policy === 'fifo' ? l.peek() : l.peekTail()
  }

  /** Progress of the item on the stove, 0..1 (1 when the counter is full). */
  cookProgress(): number {
    if (this.nextDishAt === null) return 1
    return Math.max(0, Math.min(1, 1 - (this.nextDishAt - this.t) / this.def.cookMs))
  }

  canServe(): boolean {
    return !this.done && this.dishes > 0 && this.waiting() > 0
  }

  /**
   * Hand one item over. Returns the event, or null if there was nothing to
   * hand over (no item ready, or nobody waiting there).
   */
  serve(at: number, lane?: number, id?: number): Extract<SimEvent, { type: 'serve' }> | null {
    this.advance(at)
    if (!this.canServe()) return null
    const best = this.bestLane()
    const ln = lane ?? best
    const line = this.lanes[ln]
    if (!line || line.size === 0) return null
    const rulePick = this.pick(ln)!
    const target = id === undefined ? rulePick : line.toArray().find((c) => c.id === id)
    if (!target) return null
    this.inputs.push({ at, lane, id })

    const head = this.lanes[best].peek()!
    const fair = ln === best && target === head
    const priceOk = ln === best
    const timeOk = target === rulePick
    const ok = priceOk && timeOk
    const reason: Reason | undefined = !priceOk ? 'price' : !timeOk ? 'time' : undefined

    let points: number
    if (ok) {
      const late = this.waitOf(target, at) > this.def.patienceMs || target.skipped
      points = (late ? POINTS.late : POINTS.serve) * multiplier(this.combo)
      this.combo++
      this.bestCombo = Math.max(this.bestCombo, this.combo)
    } else {
      points = POINTS.mistake
      this.combo = 0
      this.mistakes++
      // Everyone who was ahead of them in this lane saw it happen.
      for (const c of line) {
        if (c === target) break
        c.skipped = true
      }
      if (reason === 'price') for (const c of this.lanes[best]) c.skipped = true
    }
    this.score = Math.max(0, this.score + points)
    this.items++
    if (fair) this.fairItems++

    target.got++
    this.dishes--
    if (this.nextDishAt === null) this.nextDishAt = at + this.def.cookMs

    const doneNow = target.got >= target.need
    let op: 'dequeue' | 'pop' | 'cut' | 'partial' = 'partial'
    if (doneNow) {
      if (line.peek() === target) {
        line.dequeue()
        op = 'dequeue'
      } else if (line.peekTail() === target) {
        line.popTail()
        op = 'pop'
      } else {
        line.removeWhere((c) => c === target)
        op = 'cut'
      }
      const wait = at - target.at
      this.finished.push({ id: target.id, wait, angry: wait > this.def.patienceMs || target.skipped })
    }
    const ev = {
      type: 'serve' as const,
      at,
      lane: ln,
      id: target.id,
      ok,
      fair,
      reason,
      points,
      done: doneNow,
      op,
      combo: this.combo,
    }
    this.log.push(ev)
    if (this.nextArrival >= this.script.length && this.waiting() === 0) this.finish(at)
    return ev
  }

  waitOf(c: Customer, now = this.t): number {
    return now - c.at
  }

  mood(c: Customer, now = this.t): Mood {
    const w = this.waitOf(c, now)
    if (c.skipped || w > this.def.patienceMs) return 'angry'
    if (w > this.def.patienceMs * 0.6) return 'meh'
    return 'happy'
  }

  private finish(at: number) {
    if (this.done) return
    this.done = true
    this.endAt = at
    // Anyone still in line when time runs out left unhappy.
    for (const l of this.lanes)
      for (const c of l) this.finished.push({ id: c.id, wait: at - c.at, angry: true })
  }

  result(): Result {
    const fairness = this.items === 0 ? 1 : this.fairItems / this.items
    const servedAll = this.finished.length === this.script.length && this.waiting() === 0
    let stars = servedAll ? 1 : 0
    if (servedAll && fairness >= 0.9) stars++
    if (servedAll && this.def.target > 0 && this.score >= this.def.target) stars++
    return {
      score: this.score,
      stars,
      fairness,
      longestWait: this.finished.reduce((m, f) => Math.max(m, f.wait), 0),
      angry: this.finished.filter((f) => f.angry).length,
      order: this.finished.map((f) => f.id),
      mistakes: this.mistakes,
      bestCombo: this.bestCombo,
      jumped: jumpedCount(this.finished.map((f) => f.id)),
    }
  }
}

/** How many in `order` finished while someone with a smaller ticket was still waiting. */
export function jumpedCount(order: number[]): number {
  let n = 0
  let minAfter = Infinity
  for (let i = order.length - 1; i >= 0; i--) {
    if (order[i] > minAfter) n++
    minAfter = Math.min(minAfter, order[i])
  }
  return n
}

/** Rebuild a game from its input log. Same inputs, same game. */
export function replay(def: LevelDef, inputs: Input[], until?: number, policy?: Policy): Sim {
  const sim = new Sim(def, policy)
  for (const i of inputs) sim.serve(i.at, i.lane, i.id)
  if (until !== undefined) sim.advance(until)
  return sim
}

/**
 * Play a level automatically under a rule: the player presses Serve at the
 * given times, always taking the rule's pick. Once those presses run out it
 * keeps serving as soon as an item is ready, until everyone is served.
 * Used to compare FIFO and LIFO on the same customers and the same timing.
 */
export function autoplay(def: LevelDef, policy: Policy, times: number[]): Sim {
  const sim = new Sim(def, policy)
  for (const t of times) sim.serve(t)
  let t = times.length ? times[times.length - 1] : 0
  while (!sim.done && t < def.maxMs) {
    t += 50
    sim.serve(t)
    sim.advance(t)
  }
  return sim
}

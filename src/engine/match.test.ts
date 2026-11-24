import { describe, expect, it } from 'vitest'
import { Line } from './line'
import { LEVELS, scriptFor, type LevelDef } from './levels'
import { Match, autoplay, jumpedCount, replay } from './match'

const level = (id: number) => LEVELS.find((l) => l.id === id)!

/** A small, fast level: chips every 100 ms, a market order every 100 ms after 1 s. */
const tiny = (over: Partial<LevelDef> = {}): LevelDef => ({
  ...level(1),
  initial: 5,
  limits: 0,
  markets: 5,
  marketGap: [100, 100],
  marketSize: [1, 1],
  limitSize: [1, 1],
  patienceMs: 60_000,
  ...over,
})

describe('Line (one price level)', () => {
  it('is first in, first out', () => {
    const q = new Line<number>()
    ;[1, 2, 3].forEach((n) => q.enqueue(n))
    expect([q.dequeue(), q.dequeue(), q.dequeue()]).toEqual([1, 2, 3])
  })

  it('takes an item out of the middle and keeps the rest in order', () => {
    const q = new Line<number>()
    ;[1, 2, 3, 4].forEach((n) => q.enqueue(n))
    expect(q.removeWhere((n) => n === 2)).toBe(2)
    expect(q.toArray()).toEqual([1, 3, 4])
  })
})

describe('FIFO in one lane', () => {
  it('fills chips in arrival order', () => {
    const m = new Match(tiny())
    m.advance(3000)
    for (let i = 0; i < 5; i++) m.tap(3000 + i)
    const r = m.result()
    expect(r.order).toEqual([1, 2, 3, 4, 5])
    expect(r.fairness).toBe(1)
    expect(m.done).toBe(true)
  })

  it('logs enqueue for each chip and a dequeue fill for the head', () => {
    const m = new Match(tiny())
    m.advance(3000)
    expect(m.log.filter((e) => e.type === 'enqueue')).toHaveLength(5)
    expect(m.tap(3000)).toMatchObject({ chip: 1, op: 'dequeue', ok: true, fair: true, price: 101 })
  })

  it('punishes a queue jump and angers the chips it skipped', () => {
    const m = new Match(tiny())
    m.advance(3000)
    const f = m.tap(3000, 0, 3)!
    expect(f).toMatchObject({ ok: false, fair: false, mistake: 'jump', op: 'cut' })
    expect(f.points).toBeLessThan(0)
    const [c1, c2, c4] = m.asks[0].toArray()
    expect([c1.jumped, c2.jumped, c4.jumped]).toEqual([true, true, false])
    expect(m.mood(c1)).toBe('angry')
  })

  it('does nothing without a market order to fill', () => {
    const m = new Match(tiny())
    expect(m.tap(500)).toBeNull()
  })

  it('builds a combo multiplier on correct fills', () => {
    const m = new Match(tiny({ initial: 9, markets: 9 }))
    m.advance(3000)
    const pts = Array.from({ length: 9 }, (_, i) => m.tap(3000 + i)!.points)
    expect([pts[0], pts[4], pts[8]]).toEqual([10, 20, 30])
  })

  it('a market order that runs out of patience is missed', () => {
    const m = new Match(tiny({ patienceMs: 1000 }))
    m.advance(2500)
    expect(m.missed).toBe(1)
    expect(m.log.some((e) => e.type === 'expire')).toBe(true)
  })
})

describe('partial fills', () => {
  it('shrinks the head chip and keeps it at the head until it is used up', () => {
    const m = new Match(tiny({ initial: 2, markets: 3, limitSize: [3, 3], marketSize: [2, 2] }))
    m.advance(1300)
    const a = m.tap(1300)!
    expect(a).toMatchObject({ chip: 1, qty: 2, op: 'partial' })
    expect(m.asks[0].peek()).toMatchObject({ id: 1, left: 1 })
    m.advance(1400)
    const b = m.tap(1400)!
    expect(b).toMatchObject({ chip: 1, qty: 1, op: 'dequeue' })
    // The same market order still wants 1 more: it takes the next chip.
    const c = m.tap(1401)!
    expect(c).toMatchObject({ chip: 2, qty: 1, op: 'partial', market: b.market })
  })

  it('a big market order needs one tap per chip', () => {
    const m = new Match(tiny({ initial: 4, markets: 1, limitSize: [1, 1], marketSize: [4, 4] }))
    m.advance(1300)
    const fills = [m.tap(1300), m.tap(1301), m.tap(1302), m.tap(1303)]
    expect(fills.map((f) => f!.chip)).toEqual([1, 2, 3, 4])
    expect(m.active).toBeNull()
  })
})

describe('several price levels (price-time priority)', () => {
  const book = () => ({ ...level(3), limits: 0, initial: 12, marketGap: [100, 100] as [number, number], patienceMs: 60_000 })

  it('takes the best price first, and the head of that lane', () => {
    const def = book()
    const m = new Match(def)
    m.advance(1300)
    const side = m.takeSide()!
    const best = m.bestLane(side)
    const head = m.lanes(side)[best].peek()!.id
    const f = m.tap(1300)!
    expect(f).toMatchObject({ ok: true, lane: best, chip: head })
  })

  it('flags a worse-priced lane as a price violation', () => {
    const def = book()
    const m = new Match(def)
    m.advance(1300)
    const side = m.takeSide()!
    const worse = m.lanes(side).findIndex((l, i) => i > 0 && l.size > 0)
    expect(worse).toBeGreaterThan(0)
    expect(m.tap(1300, worse)).toMatchObject({ ok: false, mistake: 'price' })
  })

  it('a buy takes from the asks at ask prices, a sell from the bids', () => {
    const m = autoplay(book(), 'fifo', [])
    for (const f of m.tape()) {
      const mk = m.marketsIn.find((x) => x.id === f.market)!
      expect(f.side).toBe(mk.side === 'buy' ? 'sell' : 'buy')
      expect(f.price > 100).toBe(f.side === 'sell')
    }
  })

  it('never fills a worse price while a better one rests (autoplay)', () => {
    const m = new Match(book())
    for (let t = 1300; t < 20_000; t += 50) {
      m.advance(t)
      const side = m.takeSide()
      const best = side ? m.bestLane(side) : -1
      const f = m.tap(t)
      if (f) expect(f.lane).toBe(best)
    }
  })
})

describe('FIFO vs LIFO on the identical order sequence', () => {
  it('levels 3 and 4 deal exactly the same orders', () => {
    expect(scriptFor(level(4))).toEqual(scriptFor(level(3)))
  })

  it('LIFO is less fair: it fills newer chips while older ones wait', () => {
    const times = Array.from({ length: 60 }, (_, i) => 1300 + i * 700)
    const fifo = autoplay(level(4), 'fifo', times).result()
    const lifo = autoplay(level(4), 'lifo', times).result()
    expect(fifo.fairness).toBe(1)
    expect(fifo.jumped).toBe(0)
    expect(lifo.fairness).toBeLessThan(0.8)
    expect(lifo.jumped).toBeGreaterThan(0)
  })

  it('counts queue jumps per lane', () => {
    expect(jumpedCount([{ id: 3, lane: 'a' }, { id: 1, lane: 'a' }, { id: 2, lane: 'b' }])).toBe(1)
  })
})

describe('determinism', () => {
  it('the same seed deals the same orders', () => {
    expect(scriptFor(level(2))).toEqual(scriptFor(level(2)))
  })

  it('replaying the input log rebuilds the same game', () => {
    const def = level(3)
    const m = new Match(def)
    for (let t = 1300; t < 40_000; t += 600) m.tap(t, t % 3000 === 0 ? 1 : undefined)
    m.advance(40_000)
    const again = replay(def, m.inputs, 40_000)
    expect(again.result()).toEqual(m.result())
    expect(again.log).toEqual(m.log)
  })
})

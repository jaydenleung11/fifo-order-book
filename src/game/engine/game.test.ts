import { describe, expect, it } from 'vitest'
import { Line } from './line'
import { LEVELS, scriptFor, type LevelDef } from './levels'
import { Sim, autoplay, replay } from './sim'

const level = (id: number) => LEVELS.find((l) => l.id === id)!

/** A small hand-made level: arrivals every 100 ms, items every 50 ms. */
const tiny = (over: Partial<LevelDef> = {}): LevelDef => ({
  ...level(1),
  count: 5,
  gap: [100, 100],
  cookMs: 50,
  counterMax: 9,
  twoChance: 0,
  ...over,
})

describe('Line (the queue)', () => {
  it('is first in, first out', () => {
    const q = new Line<number>()
    ;[1, 2, 3, 4].forEach((n) => q.enqueue(n))
    expect([q.dequeue(), q.dequeue(), q.dequeue(), q.dequeue()]).toEqual([1, 2, 3, 4])
    expect(q.dequeue()).toBeUndefined()
  })

  it('removes from the middle without disturbing the order', () => {
    const q = new Line<number>()
    ;[1, 2, 3, 4].forEach((n) => q.enqueue(n))
    expect(q.removeWhere((n) => n === 3)).toBe(3)
    expect(q.toArray()).toEqual([1, 2, 4])
    expect(q.peekTail()).toBe(4)
  })
})

describe('Sim: one line', () => {
  it('serves customers in arrival order', () => {
    const sim = new Sim(tiny())
    sim.advance(2000)
    for (let i = 0; i < 5; i++) sim.serve(2000 + i)
    const r = sim.result()
    expect(r.order).toEqual([1, 2, 3, 4, 5])
    expect(r.fairness).toBe(1)
    expect(r.mistakes).toBe(0)
    expect(sim.done).toBe(true)
  })

  it('logs an enqueue for each arrival and a dequeue for each finished customer', () => {
    const sim = new Sim(tiny())
    sim.advance(2000)
    sim.serve(2000)
    expect(sim.log.filter((e) => e.type === 'enqueue')).toHaveLength(5)
    const s = sim.log.find((e) => e.type === 'serve')!
    expect(s).toMatchObject({ id: 1, op: 'dequeue', ok: true, fair: true })
  })

  it('punishes serving someone who is not at the front', () => {
    const sim = new Sim(tiny())
    sim.advance(2000)
    const ev = sim.serve(2000, 0, 3)!
    expect(ev).toMatchObject({ ok: false, fair: false, reason: 'time', op: 'cut' })
    expect(ev.points).toBeLessThan(0)
    // Customers 1 and 2 saw it happen.
    const [c1, c2, c4] = sim.lanes[0].toArray()
    expect([c1.skipped, c2.skipped, c4.skipped]).toEqual([true, true, false])
    expect(sim.mood(c1)).toBe('angry')
  })

  it('cannot serve before an item is cooked', () => {
    const sim = new Sim(tiny({ cookMs: 5000 }))
    sim.advance(1000)
    expect(sim.serve(1000)).toBeNull()
  })

  it('builds a combo multiplier on in-order serves', () => {
    const sim = new Sim(tiny({ count: 9 }))
    sim.advance(5000)
    const points = Array.from({ length: 9 }, (_, i) => sim.serve(5000 + i)!.points)
    // 10 points each, times 1 for the first four, 2 for the next four, then 3.
    expect(points[0]).toBe(10)
    expect(points[4]).toBe(20)
    expect(points[8]).toBe(30)
  })
})

describe('Sim: partial service', () => {
  it('keeps a two-item customer at the front until both items are handed over', () => {
    const def = tiny({ count: 3, twoChance: 1 })
    const sim = new Sim(def)
    sim.advance(2000)
    const a = sim.serve(2000)!
    expect(a).toMatchObject({ id: 1, op: 'partial', done: false })
    expect(sim.lanes[0].peek()!.id).toBe(1)
    const b = sim.serve(2001)!
    expect(b).toMatchObject({ id: 1, op: 'dequeue', done: true })
    expect(sim.lanes[0].peek()!.id).toBe(2)
  })
})

describe('Sim: several lanes (price-time priority)', () => {
  const lanes = (over: Partial<LevelDef> = {}) => tiny({ ...level(3), count: 9, gap: [100, 100], cookMs: 50, counterMax: 20, twoChance: 0, ...over })

  it('serves the best-price lane first, and its front first', () => {
    const def = lanes()
    const sim = new Sim(def)
    sim.advance(3000)
    const ev = sim.serve(3000)!
    const best = scriptFor(def).filter((a) => a.lane === sim.bestLane())[0]
    expect(ev).toMatchObject({ lane: 0, ok: true })
    expect(ev.id).toBe(best.id)
  })

  it('flags a worse-price lane as a price mistake', () => {
    const def = lanes()
    const sim = new Sim(def)
    sim.advance(3000)
    const worse = sim.lanes.findIndex((l, i) => i > 0 && l.size > 0)
    const ev = sim.serve(3000, worse)!
    expect(ev).toMatchObject({ ok: false, reason: 'price' })
  })

  it('finishes all lanes in price order, each lane in arrival order', () => {
    const def = lanes()
    const sim = autoplay(def, 'fifo', [3000])
    const order = sim.result().order
    const script = scriptFor(def)
    const expected = [0, 1, 2].flatMap((lane) => script.filter((a) => a.lane === lane).map((a) => a.id))
    expect(order).toEqual(expected)
  })
})

describe('FIFO vs LIFO on the same customers', () => {
  it('uses the identical customer sequence in rush hour and chaos mode', () => {
    const a = scriptFor(level(2)).map(({ id, at, lane, need, look }) => ({ id, at, lane, need, look }))
    const b = scriptFor(level(4)).map(({ id, at, lane, need, look }) => ({ id, at, lane, need, look }))
    expect(b).toEqual(a)
  })

  it('LIFO is less fair and makes people wait longer', () => {
    const def = level(4)
    const times = Array.from({ length: 40 }, (_, i) => 1400 + i * 1300)
    const fifo = autoplay(def, 'fifo', times).result()
    const lifo = autoplay(def, 'lifo', times).result()
    expect(fifo.fairness).toBe(1)
    expect(lifo.fairness).toBeLessThan(0.8)
    expect(lifo.longestWait).toBeGreaterThan(fifo.longestWait)
    expect(fifo.jumped).toBe(0)
    expect(lifo.jumped).toBeGreaterThan(5)
    expect(fifo.order).toEqual([...fifo.order].sort((x, y) => x - y))
    expect(lifo.order).not.toEqual([...lifo.order].sort((x, y) => x - y))
  })
})

describe('determinism', () => {
  it('the same seed gives the same customers', () => {
    expect(scriptFor(level(2))).toEqual(scriptFor(level(2)))
  })

  it('replaying the input log rebuilds the same game', () => {
    const def = level(2)
    const sim = new Sim(def)
    for (let t = 1000; t < 40_000; t += 700) sim.serve(t, undefined, t % 4900 === 0 ? 99 : undefined)
    sim.advance(40_000)
    const again = replay(def, sim.inputs, 40_000)
    expect(again.result()).toEqual(sim.result())
    expect(again.log).toEqual(sim.log)
  })
})

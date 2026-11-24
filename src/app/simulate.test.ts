import { describe, expect, it } from 'vitest'
import { createSession, currentBook, pushCommand, stepForward, trimSession, type Session } from '@/engine/session'
import { FREE_PLAY_SEED } from './scenarios'
import { nextOrder } from './simulate'

/** Run the live simulation for n orders, showing every step, like the app does. */
function simulate(n: number, trim: boolean) {
  let s: Session = createSession(FREE_PLAY_SEED)
  let seed = 7
  for (let i = 0; i < n; i++) {
    const next = nextOrder(currentBook(s), 'fifo', seed)
    seed = next.seed
    s = pushCommand(s, next.command)
    if (trim) s = trimSession(s)
    while (s.cursor < s.log.length) s = stepForward(s)
  }
  return s
}

describe('live simulation', () => {
  it('is repeatable for the same seed', () => {
    expect(JSON.stringify(currentBook(simulate(60, true)))).toBe(JSON.stringify(currentBook(simulate(60, true))))
  })

  it('never lets a queue grow past six and keeps both sides alive', () => {
    let s: Session = createSession(FREE_PLAY_SEED)
    let seed = 99
    for (let i = 0; i < 400; i++) {
      const next = nextOrder(s.engine.snapshot(), 'fifo', seed)
      seed = next.seed
      s = pushCommand(s, next.command)
      const b = s.engine.snapshot()
      for (const l of [...b.bids, ...b.asks]) expect(l.orders.length).toBeLessThanOrEqual(6)
    }
    const b = s.engine.snapshot()
    expect(b.bids.some((l) => l.orders.length)).toBe(true)
    expect(b.asks.some((l) => l.orders.length)).toBe(true)
  })

  it('trimming old history does not change the book', () => {
    const trimmed = simulate(300, true)
    const full = simulate(300, false)
    expect(trimmed.log.length).toBeLessThan(full.log.length)
    expect(trimmed.log.length).toBeLessThanOrEqual(400)
    expect(JSON.stringify(currentBook(trimmed))).toBe(JSON.stringify(currentBook(full)))
  })
})

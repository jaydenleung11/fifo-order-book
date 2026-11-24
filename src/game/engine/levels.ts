import { rng } from './rng'

export type Policy = 'fifo' | 'lifo'

export interface LevelDef {
  id: number
  name: string
  /** The one line of instruction the level gets. */
  hint: string
  /** One price per lane, best (highest) first. A single lane has no price. */
  prices: number[]
  policy: Policy
  /** Customers in the level. */
  count: number
  /** Time between arrivals, ms, [min, max]. */
  gap: [number, number]
  /** Chance a customer orders two items (a partial fill). */
  twoChance: number
  /** Time to cook one item, ms. */
  cookMs: number
  /** Ready items the counter can hold. */
  counterMax: number
  /** How long someone waits happily, ms. */
  patienceMs: number
  /** Chance a customer waves a tip to tempt you into serving them early. */
  lureChance: number
  /** Show arrival-number tickets. */
  tickets: boolean
  seed: number
  /** Score for the third star. */
  target: number
  /** Hard stop, ms. */
  maxMs: number
}

const L2 = {
  prices: [0],
  count: 16,
  gap: [850, 1350] as [number, number],
  twoChance: 0.35,
  cookMs: 1250,
  counterMax: 2,
  patienceMs: 12000,
  lureChance: 0.4,
  tickets: true,
  seed: 2026,
  maxMs: 75_000,
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'One line',
    hint: 'Serve whoever is at the window.',
    prices: [0],
    policy: 'fifo',
    count: 10,
    gap: [1300, 2100],
    twoChance: 0,
    cookMs: 1900,
    counterMax: 2,
    patienceMs: 9000,
    lureChance: 0,
    tickets: false,
    seed: 101,
    target: 150,
    maxMs: 60_000,
  },
  {
    id: 2,
    name: 'Rush hour',
    hint: 'Some orders need two. They stay at the window until done.',
    policy: 'fifo',
    target: 420,
    ...L2,
  },
  {
    id: 3,
    name: 'Three lanes',
    hint: 'Best price first, then the front of that lane.',
    prices: [11, 10, 9],
    policy: 'fifo',
    count: 15,
    gap: [650, 1150],
    twoChance: 0.2,
    cookMs: 1150,
    counterMax: 2,
    patienceMs: 11000,
    lureChance: 0,
    tickets: true,
    seed: 303,
    target: 260,
    maxMs: 75_000,
  },
  {
    id: 4,
    name: 'Chaos mode',
    hint: 'Same customers as rush hour. Now the newest gets served first.',
    policy: 'lifo',
    target: 0,
    ...L2,
    lureChance: 0,
  },
]

export interface Arrival {
  /** Arrival number, 1-based. Also the ticket number. */
  id: number
  at: number
  lane: number
  need: number
  lure: boolean
  /** Which sprite variation to draw. */
  look: number
}

/** The level's customers. Fixed by the seed, so every replay sees the same ones. */
export function scriptFor(def: LevelDef): Arrival[] {
  const r = rng(def.seed)
  const out: Arrival[] = []
  let at = 600
  for (let i = 1; i <= def.count; i++) {
    out.push({
      id: i,
      at: Math.round(at),
      lane: Math.floor(r() * def.prices.length),
      need: r() < def.twoChance ? 2 : 1,
      lure: r() < def.lureChance && i > 2,
      // Cycle through the sprites so neighbours rarely look alike.
      look: (i * 3 + Math.floor(r() * 3)) % 8,
    })
    at += def.gap[0] + r() * (def.gap[1] - def.gap[0])
  }
  return out
}

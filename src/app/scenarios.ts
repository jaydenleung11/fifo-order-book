import type { Command } from '@/engine/session'

export interface ScenarioStep {
  caption: string
  command?: Command
}

export interface Scenario {
  id: string
  title: string
  seed: Command[]
  steps: ScenarioStep[]
}

const L = (side: 'buy' | 'sell', price: number, qty: number, trader?: string): Command => ({
  type: 'limit',
  side,
  price,
  qty,
  trader,
})

/** A lived-in book for free play. Firms follow arrival order. */
export const FREE_PLAY_SEED: Command[] = [
  L('sell', 101, 4),
  L('buy', 99, 3),
  L('buy', 98, 4),
  L('sell', 101, 2),
  L('sell', 102, 3),
  L('buy', 99, 5),
  L('sell', 103, 6),
  L('buy', 97, 5),
  L('sell', 101, 5),
  L('buy', 98, 2),
  L('sell', 104, 4),
  L('buy', 96, 3),
  L('sell', 103, 2),
  L('buy', 95, 8),
  L('sell', 105, 7),
  L('buy', 96, 4),
]

const TAKER = 'Citadel Securities'

/**
 * Captions are templates: {p:101} is shown as the instrument's quote for
 * price 101 and {u} as its unit, so they read right for every instrument.
 */
export const SCENARIOS: Scenario[] = [
  {
    id: 'same-price',
    title: 'Same price: who goes first?',
    seed: [
      L('sell', 101, 3, 'Goldman Sachs'),
      L('buy', 99, 4, 'Morgan Stanley'),
      L('sell', 102, 4, 'Barclays'),
      L('buy', 98, 5, 'UBS'),
    ],
    steps: [
      { caption: 'Goldman Sachs is waiting to sell 3 {u} at {p:101}. It is alone, so it is both head and tail.' },
      {
        caption: 'J.P. Morgan offers the same price a moment later. Same price, so it joins the tail, behind Goldman.',
        command: L('sell', 101, 3, 'J.P. Morgan'),
      },
      {
        caption: `${TAKER} wants 3 {u} now. The price ties, so the queue decides: under FIFO the head (Goldman) sells first.`,
        command: { type: 'market', side: 'buy', qty: 3, priority: 'fifo', trader: TAKER },
      },
      {
        caption: 'Now switch the rule to LIFO and replay: J.P. Morgan, the newest, jumps ahead of Goldman. That is why exchanges use FIFO.',
      },
    ],
  },
  {
    id: 'partial',
    title: 'Partial fill',
    seed: [
      L('sell', 101, 6, 'Morgan Stanley'),
      L('sell', 101, 2, 'Jane Street'),
      L('sell', 102, 4, 'UBS'),
      L('buy', 99, 5, 'HSBC'),
    ],
    steps: [
      { caption: 'Morgan Stanley is at the head with 6 {u}. Jane Street waits behind it with 2.' },
      {
        caption: `${TAKER} buys 4. Morgan Stanley had more than enough, so its stack shrinks to 2 and it keeps its place at the head.`,
        command: { type: 'market', side: 'buy', qty: 4, priority: 'fifo', trader: TAKER },
      },
      {
        caption: 'The next buy is for 3: Morgan Stanley’s last 2 go first, then 1 from Jane Street, which becomes the head.',
        command: { type: 'market', side: 'buy', qty: 3, priority: 'fifo', trader: TAKER },
      },
    ],
  },
  {
    id: 'sweep',
    title: 'Sweeping levels',
    seed: [
      L('sell', 102, 4, 'Deutsche Bank'),
      L('sell', 101, 2, 'Bank of America'),
      L('sell', 101, 3, 'Citi'),
      L('sell', 103, 5, 'Barclays'),
      L('buy', 99, 4, 'Virtu Financial'),
    ],
    steps: [
      {
        caption: 'Deutsche Bank arrived first, but at {p:102}. Bank of America and Citi came later at a better price, {p:101}.',
      },
      {
        caption: `${TAKER} buys 8 at market: the best price comes first, so the {p:101} queue empties head-first before {p:102} is touched.`,
        command: { type: 'market', side: 'buy', qty: 8, priority: 'fifo', trader: TAKER },
      },
      {
        caption: 'Price first, then time. Deutsche Bank waited longest overall, yet it traded last, because its price was worse.',
      },
    ],
  },
]

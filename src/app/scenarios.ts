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

/** A lived-in book for free play. Names follow arrival order (Ana is #1). */
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

export const SCENARIOS: Scenario[] = [
  {
    id: 'same-price',
    title: 'Same price: who goes first?',
    seed: [
      L('sell', 101, 3, 'Ana'),
      L('buy', 99, 4, 'Cleo'),
      L('sell', 102, 4, 'Dev'),
      L('buy', 98, 5, 'Eli'),
    ],
    steps: [
      { caption: 'Ana is waiting to sell 3 shares at 101. She is alone, so she is both head and tail.' },
      {
        caption: 'Ben offers the same price a moment later. Same price, so he joins the tail, behind Ana.',
        command: L('sell', 101, 3, 'Ben'),
      },
      {
        caption: 'A buyer wants 3 shares now. The price ties, so the queue decides: under FIFO the head (Ana) sells first.',
        command: { type: 'market', side: 'buy', qty: 3, priority: 'fifo', trader: 'Buyer' },
      },
      {
        caption: 'Now switch the rule to LIFO and replay this scenario: Ben, the newest, jumps ahead of Ana. That is why exchanges use FIFO.',
      },
    ],
  },
  {
    id: 'partial',
    title: 'Partial fill',
    seed: [
      L('sell', 101, 6, 'Cleo'),
      L('sell', 101, 2, 'Dev'),
      L('sell', 102, 4, 'Eli'),
      L('buy', 99, 5, 'Fay'),
    ],
    steps: [
      { caption: 'Cleo is at the head with 6 shares. Dev waits behind her with 2.' },
      {
        caption: 'A buyer takes 4. Cleo had more than enough, so her chip shrinks to 2 and she keeps her place at the head.',
        command: { type: 'market', side: 'buy', qty: 4, priority: 'fifo', trader: 'Buyer' },
      },
      {
        caption: 'Next buyer takes 3: Cleo’s last 2 go first, then 1 from Dev, who becomes the head.',
        command: { type: 'market', side: 'buy', qty: 3, priority: 'fifo', trader: 'Buyer' },
      },
    ],
  },
  {
    id: 'sweep',
    title: 'Sweeping levels',
    seed: [
      L('sell', 102, 4, 'Gus'),
      L('sell', 101, 2, 'Hana'),
      L('sell', 101, 3, 'Ivo'),
      L('sell', 103, 5, 'Jun'),
      L('buy', 99, 4, 'Kai'),
    ],
    steps: [
      {
        caption: 'Gus arrived first, but at 102. Hana and Ivo came later at a better price, 101.',
      },
      {
        caption: 'A market buy for 8: the best price comes first, so the 101 queue empties head-first before 102 is touched.',
        command: { type: 'market', side: 'buy', qty: 8, priority: 'fifo', trader: 'Buyer' },
      },
      {
        caption: 'Price first, then time. Gus waited longest overall, yet he traded last, because his price was worse.',
      },
    ],
  },
]

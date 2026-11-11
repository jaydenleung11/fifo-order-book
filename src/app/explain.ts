import type { LogEntry, Priority, Side } from '@/engine/types'

export type Program = 'limit' | 'market'

export const PSEUDOCODE: Record<Program, (priority: Priority) => string[]> = {
  limit: () => [
    'addLimit(order):',
    '  level ← book[side][price]',
    '  level.enqueue(order)   // at tail',
  ],
  market: (p) => [
    'marketOrder(taker):',
    '  for level in other side, best first:',
    '    while taker.qty > 0, level not empty:',
    p === 'fifo' ? '      maker ← level.peek()      // head' : '      maker ← level.peekTail()  // tail!',
    '      n ← min(taker.qty, maker.qty)',
    '      trade(maker, taker, n)',
    p === 'fifo' ? '      if maker.qty = 0: level.dequeue()' : '      if maker.qty = 0: level.popTail()',
    '    if taker.qty = 0: stop',
  ],
}

const lvl = (side: Side) => (side === 'buy' ? 'bids' : 'asks')

export interface Explanation {
  program: Program
  line: number
  /** Code-like name of the operation, e.g. asks[101].enqueue(#14) */
  op: string
  cost?: string
  /** One short sentence in plain English. */
  say: string
}

export function explain(entry: LogEntry, priority: Priority): Explanation {
  const e = entry.event
  switch (e.kind) {
    case 'enqueue': {
      const ahead = e.position
      return {
        program: 'limit',
        line: 2,
        op: `${lvl(e.order.side)}[${e.order.price}].enqueue(#${e.order.id})`,
        cost: 'O(1)',
        say:
          ahead === 0
            ? `#${e.order.id} (${e.order.trader}) is first in line at ${e.order.price}: it is the head.`
            : `#${e.order.id} (${e.order.trader}) joins the tail at ${e.order.price}, behind ${ahead} order${ahead === 1 ? '' : 's'}.`,
      }
    }
    case 'market-arrive':
      return {
        program: 'market',
        line: 0,
        op: `market${e.taker.side === 'buy' ? 'Buy' : 'Sell'}(qty: ${e.taker.qty})`,
        say: `A market ${e.taker.side} for ${e.taker.qty} arrives. It trades with whoever is waiting at the best price.`,
      }
    case 'visit-level':
      return {
        program: 'market',
        line: 1,
        op: `level ← ${lvl(e.makerSide)}[${e.price}]`,
        say: `Best ${e.makerSide === 'sell' ? 'ask' : 'bid'} is ${e.price}, with ${e.queueLength} order${e.queueLength === 1 ? '' : 's'} in line.`,
      }
    case 'peek':
      return {
        program: 'market',
        line: 3,
        op: `level.${e.end === 'head' ? 'peek' : 'peekTail'}() → #${e.order.id}`,
        cost: 'O(1)',
        say:
          e.end === 'head'
            ? `#${e.order.id} (${e.order.trader}) is at the head: it has waited longest at this price.`
            : `LIFO picks the tail: #${e.order.id} (${e.order.trader}) arrived last but trades first.`,
      }
    case 'fill': {
      const t = e.trade
      return {
        program: 'market',
        line: 5,
        op: `trade(#${t.makerId}, ${t.qty} @ ${t.price})`,
        say:
          e.makerRemaining > 0
            ? `Partial fill: ${t.qty} trade at ${t.price}. #${t.makerId} keeps ${e.makerRemaining} and stays at the ${e.end}.`
            : `${t.qty} trade at ${t.price}. #${t.makerId} is now fully filled.`,
      }
    }
    case 'dequeue': {
      const level = (e.order.side === 'buy' ? entry.book.bids : entry.book.asks).find(
        (l) => l.price === e.price,
      )
      const next = level?.orders[e.end === 'head' ? 0 : level.orders.length - 1]
      return {
        program: 'market',
        line: 6,
        op: `level.${e.end === 'head' ? 'dequeue' : 'popTail'}() → #${e.order.id}`,
        cost: 'O(1)',
        say: next
          ? `#${e.order.id} leaves the queue. #${next.id} is the new ${e.end}.`
          : `#${e.order.id} leaves the queue. The ${e.price} level is now empty.`,
      }
    }
    case 'level-empty':
      return {
        program: 'market',
        line: 2,
        op: `${lvl(e.makerSide)}[${e.price}].isEmpty() → true`,
        say: `Nothing left at ${e.price}. ${e.taker.remaining > 0 ? 'Move to the next best price.' : ''}`.trim(),
      }
    case 'market-done':
      return {
        program: 'market',
        line: 7,
        op: `done: ${e.filled}/${e.taker.qty} filled`,
        say:
          e.unfilled > 0
            ? `${e.filled} filled in ${e.trades.length} trade${e.trades.length === 1 ? '' : 's'}. ${e.unfilled} could not fill: the other side ran out.`
            : `All ${e.filled} filled in ${e.trades.length} trade${e.trades.length === 1 ? '' : 's'}${priority === 'fifo' ? ', oldest orders first' : ''}.`,
      }
  }
}

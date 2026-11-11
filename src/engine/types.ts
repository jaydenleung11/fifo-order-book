export type Side = 'buy' | 'sell'

/** Which end of a price level's queue trades first. Real exchanges use FIFO. */
export type Priority = 'fifo' | 'lifo'

export interface Order {
  /** Assigned in arrival order: #1 is the first order the book ever saw. */
  id: number
  side: Side
  price: number
  /** Shares still waiting. Shrinks on a partial fill. */
  qty: number
  originalQty: number
  /** Logical arrival clock. Displayed as 09:30:ss. */
  time: number
  trader: string
}

export interface Trade {
  id: number
  price: number
  qty: number
  makerId: number
  makerTrader: string
  makerTime: number
  takerId: number
  takerTrader: string
  /** Side of the incoming market order. */
  takerSide: Side
}

export interface LevelSnapshot {
  price: number
  /** Orders from HEAD (index 0) to TAIL. */
  orders: Order[]
}

export interface BookSnapshot {
  /** Best (highest) bid first. */
  bids: LevelSnapshot[]
  /** Best (lowest) ask first. */
  asks: LevelSnapshot[]
  priority: Priority
}

export interface Taker {
  id: number
  side: Side
  qty: number
  remaining: number
  time: number
  trader: string
}

export type End = 'head' | 'tail'

export type BookEvent =
  | { kind: 'enqueue'; order: Order; position: number; queueLength: number }
  | { kind: 'market-arrive'; taker: Taker }
  | { kind: 'visit-level'; taker: Taker; makerSide: Side; price: number; queueLength: number }
  | { kind: 'peek'; taker: Taker; order: Order; end: End }
  | { kind: 'fill'; taker: Taker; trade: Trade; makerRemaining: number; end: End }
  | { kind: 'dequeue'; taker: Taker; order: Order; end: End; price: number }
  | { kind: 'level-empty'; taker: Taker; makerSide: Side; price: number }
  | { kind: 'market-done'; taker: Taker; filled: number; unfilled: number; trades: Trade[] }

/** One step of the animation: what happened, and the book right after it. */
export interface LogEntry {
  seq: number
  event: BookEvent
  book: BookSnapshot
  /** The taker currently walking the book, if any (for drawing it). */
  taker: Taker | null
}

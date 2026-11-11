import { DEFAULT_CONFIG, OrderBook, compareFairness, type BookConfig } from './orderBook'
import type { BookSnapshot, LogEntry, Priority, Side, Trade } from './types'

export interface FairnessResult {
  fifo: Trade[]
  lifo: Trade[]
}

export type Command =
  | { type: 'limit'; side: Side; price: number; qty: number; trader?: string }
  | { type: 'market'; side: Side; qty: number; priority: Priority; trader?: string }

/**
 * Everything the UI needs, as plain data. The log is append-only and the
 * cursor says how many entries are currently shown, so Step, Back, Play and
 * Reset are just cursor moves over a fixed list: the same commands always
 * produce the same animation.
 */
export interface Session {
  config: BookConfig
  seed: Command[]
  commands: Command[]
  /** Book after the seed, before any command. */
  base: BookSnapshot
  log: LogEntry[]
  /** log index where each command's entries start */
  commandStarts: number[]
  /** number of log entries shown (0..log.length) */
  cursor: number
  /** The live book after every command (so a push never replays history). */
  engine: OrderBook
  /** For each market command: what FIFO and LIFO would each do on the book it met. */
  fairness: (FairnessResult | null)[]
}

function run(book: OrderBook, cmd: Command): LogEntry[] {
  if (cmd.type === 'limit') return book.addLimit(cmd.side, cmd.price, cmd.qty, cmd.trader)
  book.priority = cmd.priority
  return book.market(cmd.side, cmd.qty, cmd.trader)
}

/** Replay seed + commands silently. Deterministic. */
export function replay(config: BookConfig, seed: Command[], commands: Command[]): OrderBook {
  const book = new OrderBook(config)
  for (const c of seed) run(book, c)
  for (const c of commands) run(book, c)
  return book
}

export function createSession(seed: Command[], config: BookConfig = DEFAULT_CONFIG): Session {
  const book = replay(config, seed, [])
  return {
    config,
    seed,
    commands: [],
    base: book.snapshot(),
    log: [],
    commandStarts: [],
    cursor: 0,
    engine: book,
    fairness: [],
  }
}

export function resetSession(s: Session): Session {
  return createSession(s.seed, s.config)
}

/** Append a command; its events are queued after any not yet shown. */
export function pushCommand(s: Session, cmd: Command): Session {
  const book = s.engine.clone()
  let fair: FairnessResult | null = null
  if (cmd.type === 'market') {
    const makerSide: Side = cmd.side === 'buy' ? 'sell' : 'buy'
    if (book.depth(makerSide) === 0) {
      throw new Error(
        cmd.side === 'buy'
          ? 'No sellers are waiting, so a market buy has nothing to trade with. Add a limit sell first.'
          : 'No buyers are waiting, so a market sell has nothing to trade with. Add a limit buy first.',
      )
    }
    fair = compareFairness(book, cmd.side, cmd.qty)
  }
  const entries = run(book, cmd)
  return {
    ...s,
    commands: [...s.commands, cmd],
    commandStarts: [...s.commandStarts, s.log.length],
    log: [...s.log, ...entries],
    engine: book,
    fairness: [...s.fairness, fair],
  }
}

/**
 * Forget old history so an endless simulation stays small. Whole commands
 * are dropped from the front, only if they are at least `keepBehind`
 * entries behind the cursor. The book itself is unchanged.
 */
export function trimSession(s: Session, maxEntries = 320, keepBehind = 120): Session {
  if (s.log.length <= maxEntries) return s
  const limit = s.cursor - keepBehind
  let k = 0
  while (k + 1 < s.commandStarts.length && s.commandStarts[k + 1] <= limit) k++
  const drop = s.commandStarts[k]
  if (k === 0 || drop <= 0) return s
  return {
    ...s,
    base: s.log[drop - 1].book,
    commands: s.commands.slice(k),
    fairness: s.fairness.slice(k),
    commandStarts: s.commandStarts.slice(k).map((i) => i - drop),
    log: s.log.slice(drop),
    cursor: s.cursor - drop,
  }
}

export function canStepForward(s: Session) {
  return s.cursor < s.log.length
}
export function canStepBack(s: Session) {
  return s.cursor > 0
}
export function stepForward(s: Session): Session {
  return canStepForward(s) ? { ...s, cursor: s.cursor + 1 } : s
}
export function stepBack(s: Session): Session {
  return canStepBack(s) ? { ...s, cursor: s.cursor - 1 } : s
}

/** The entry on screen right now (null before the first step). */
export function currentEntry(s: Session): LogEntry | null {
  return s.cursor === 0 ? null : s.log[s.cursor - 1]
}

export function currentBook(s: Session): BookSnapshot {
  return currentEntry(s)?.book ?? s.base
}

/** Entries that have been shown, newest last. */
export function shownEntries(s: Session): LogEntry[] {
  return s.log.slice(0, s.cursor)
}

/** Trades that have been shown, oldest first. */
export function shownTrades(s: Session): Trade[] {
  const out: Trade[] = []
  for (const e of shownEntries(s)) if (e.event.kind === 'fill') out.push(e.event.trade)
  return out
}

/** Index of the command the shown entry belongs to (-1 if none shown). */
export function currentCommandIndex(s: Session): number {
  if (s.cursor === 0) return -1
  const at = s.cursor - 1
  let idx = -1
  for (let i = 0; i < s.commandStarts.length; i++) if (s.commandStarts[i] <= at) idx = i
  return idx
}

/**
 * For the most recent market order that has finished playing, what FIFO
 * and LIFO would each have done with the exact same book.
 */
export function fairnessForCurrent(s: Session) {
  for (let i = currentCommandIndex(s); i >= 0; i--) {
    const cmd = s.commands[i]
    if (cmd.type !== 'market') continue
    // Only once the order has finished playing, so it never spoils a prediction.
    const lastEntry = (s.commandStarts[i + 1] ?? s.log.length) - 1
    if (lastEntry >= s.cursor) continue
    const f = s.fairness[i]
    return f ? { command: cmd, ...f } : null
  }
  return null
}

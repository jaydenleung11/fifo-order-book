import { createContext, useContext } from 'react'

/**
 * What the book is trading. The engine works in whole price steps (ticks)
 * around 100; an instrument turns a tick into a real-looking quote, so the
 * same queues can be a stock, a bond, gold or oil.
 */
export type Look = 'share' | 'bond' | 'bar' | 'barrel'

export interface Instrument {
  id: string
  /** Ticker-style symbol shown on screens. */
  symbol: string
  name: string
  kind: 'Stock' | 'Bond' | 'Commodity'
  /** What one unit of quantity is, singular and plural. */
  unit: [string, string]
  look: Look
  /** Quote for an engine price (an integer near 100). */
  px: (p: number) => string
  /** The bid–ask spread, from a difference in engine ticks. */
  spread: (ticks: number) => string
}

const dec = (base: number, tick: number, digits: number) => (p: number) => (base + (p - 100) * tick).toFixed(digits)

/** Treasuries quote in 32nds of a point: 98-16 means 98 + 16/32. */
const thirtySeconds = (base32: number) => (p: number) => {
  const v = base32 + (p - 100)
  return `${Math.floor(v / 32)}-${String(v % 32).padStart(2, '0')}`
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'aapl',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    kind: 'Stock',
    unit: ['share', 'shares'],
    look: 'share',
    px: dec(230, 0.01, 2),
    spread: (t) => `$${(t * 0.01).toFixed(2)}`,
  },
  {
    id: 'ust10',
    symbol: 'UST 10Y',
    name: 'US Treasury 10-year note',
    kind: 'Bond',
    unit: ['bond', 'bonds'],
    look: 'bond',
    px: thirtySeconds(98 * 32 + 16),
    spread: (t) => `${t}/32`,
  },
  {
    id: 'gold',
    symbol: 'GOLD',
    name: 'Gold, $ per ounce',
    kind: 'Commodity',
    unit: ['bar', 'bars'],
    look: 'bar',
    px: dec(2650, 0.1, 1),
    spread: (t) => `$${(t * 0.1).toFixed(1)}`,
  },
  {
    id: 'oil',
    symbol: 'WTI',
    name: 'WTI crude oil, $ per barrel',
    kind: 'Commodity',
    unit: ['barrel', 'barrels'],
    look: 'barrel',
    px: dec(78.5, 0.01, 2),
    spread: (t) => `$${(t * 0.01).toFixed(2)}`,
  },
]

export const units = (inst: Instrument, n: number) => `${n} ${inst.unit[n === 1 ? 0 : 1]}`

export const InstrumentContext = createContext<Instrument>(INSTRUMENTS[0])
export const useInstrument = () => useContext(InstrumentContext)

/**
 * Fill a caption template: {p:101} becomes the quote for price 101 and
 * {u} the plural unit ("shares", "bars").
 */
export function fillText(text: string, inst: Instrument): string {
  return text.replace(/\{p:(\d+)\}/g, (_, p) => inst.px(Number(p))).replace(/\{u\}/g, inst.unit[1])
}

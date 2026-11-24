import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Logical arrival clock → a market-open timestamp, e.g. 7 → "9:30:07". */
export function clock(time: number) {
  const m = 30 + Math.floor(time / 60)
  const s = time % 60
  return `9:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const sideWord = { buy: 'Buy', sell: 'Sell' } as const

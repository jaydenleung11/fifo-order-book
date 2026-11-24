import monoFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff?url'
import type { Side } from '@/engine/types'

export { monoFont }

export const C = {
  bid: '#56c6d4',
  ask: '#f2a65e',
  focus: '#ffe58a',
  good: '#7fd69b',
  bad: '#f2848d',
  ground: '#0b0d11',
  lane: '#1b2027',
  ink: '#eef1f4',
  muted: '#aab2bd',
  faint: '#6f7884',
}

/** Footprint of one order (its tray) in world units. */
export const W = 0.8
export const D = 0.92

export const sideColor = (side: Side) => (side === 'buy' ? C.bid : C.ask)

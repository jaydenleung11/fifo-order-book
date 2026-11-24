import type { Mood } from '../engine/sim'

const SHIRTS = ['#4c7fe0', '#8a5cd6', '#ee6f98', '#5dae3e', '#46627f', '#9a5f3b', '#3fa6d8', '#b04a8c']
const SKIN = ['#f5c9a3', '#d89a6a', '#a86b45', '#6e4429']
const HAIR = ['#2f1d45', '#6b3e1f', '#c98b2b', '#1d1d2b']

/**
 * A customer, facing left (towards the window). Mood is drawn with shapes,
 * not only colour: a smile, a flat mouth with a sweat drop, or a frown with
 * angry brows and puffs of steam.
 */
export function Person({ look, mood, lure }: { look: number; mood: Mood; lure?: boolean }) {
  const shirt = SHIRTS[look % SHIRTS.length]
  const skin = SKIN[(look * 3 + 1) % SKIN.length]
  const hair = HAIR[(look + 2) % HAIR.length]
  const style = look % 4
  return (
    <svg viewBox="0 0 48 80" className="block h-full w-full overflow-visible" aria-hidden="true">
      <ellipse cx="24" cy="77" rx="14" ry="3" fill="#2f1d45" opacity=".16" />
      {/* legs */}
      <rect x="16" y="58" width="6.5" height="19" rx="3" fill="#2f1d45" />
      <rect x="25.5" y="58" width="6.5" height="19" rx="3" fill="#2f1d45" />
      {/* body */}
      <rect x="10" y="36" width="28" height="28" rx="11" fill={shirt} />
      {lure ? (
        <g className="ftr-wave">
          <rect x="5" y="20" width="6" height="20" rx="3" fill={shirt} />
          <circle cx="8" cy="17" r="4" fill={skin} />
        </g>
      ) : (
        <rect x="11" y="42" width="6" height="16" rx="3" fill={shirt} style={{ filter: 'brightness(.88)' }} />
      )}
      {/* head */}
      <circle cx="24" cy="24" r="12" fill={skin} />
      {style === 0 && (
        <>
          <path d="M12 22 a12 12 0 0 1 24 0 z" fill={shirt} />
          <rect x="5" y="19.5" width="12" height="3.5" rx="1.75" fill={shirt} />
        </>
      )}
      {style === 1 && (
        <>
          <path d="M12.5 23 a11.5 11 0 0 1 23 -2 q-8 -3 -16 2 z" fill={hair} />
          <circle cx="33" cy="12" r="5" fill={hair} />
        </>
      )}
      {style === 2 && (
        <>
          <path d="M12 21 a12 12 0 0 1 24 0 v1.5 h-24 z" fill="#f4a259" />
          <rect x="11" y="19.5" width="26" height="4" rx="2" fill="#fff4dc" />
          <circle cx="24" cy="9" r="3" fill="#fff4dc" />
        </>
      )}
      {style === 3 && (
        <g fill={hair}>
          <circle cx="16" cy="15" r="5" />
          <circle cx="23" cy="12" r="5.5" />
          <circle cx="30" cy="14" r="5" />
          <circle cx="34" cy="20" r="4" />
        </g>
      )}
      {/* face, looking left */}
      <circle cx="16.5" cy="25" r="1.7" fill="#2f1d45" />
      <circle cx="23" cy="25" r="1.7" fill="#2f1d45" />
      {mood === 'happy' && <path d="M15 29.5 q4 3.5 8 0" stroke="#2f1d45" strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {mood === 'meh' && (
        <>
          <path d="M15.5 31 h7" stroke="#2f1d45" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M34 15 q2.5 4 0 5.5 q-2.5 -1.5 0 -5.5 z" fill="#5fb7e8" />
        </>
      )}
      {mood === 'angry' && (
        <>
          <path d="M14 20.5 l5 2 M25 20.5 l-5 2" stroke="#2f1d45" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M15 32 q4 -3.5 8 0" stroke="#2f1d45" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <g className="ftr-steam" fill="#ffffff" stroke="#2f1d45" strokeWidth="1">
            <circle cx="36" cy="8" r="3.2" />
            <circle cx="41" cy="3" r="2.4" />
          </g>
        </>
      )}
    </svg>
  )
}

/** A food parcel: a little wrapped taco. Used for ready items and order pips. */
export function Taco({ className, filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden="true">
      {filled ? (
        <>
          <path d="M2 14 a10 10 0 0 1 20 0 z" fill="#f2b63d" stroke="#2f1d45" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M5 9 q3 -3 7 -2 q4 -1 7 2" stroke="#5dae3e" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="9" cy="8.5" r="1.3" fill="#e8483d" />
          <circle cx="15" cy="8" r="1.3" fill="#e8483d" />
        </>
      ) : (
        <path d="M2 14 a10 10 0 0 1 20 0 z" fill="none" stroke="#2f1d45" strokeWidth="1.4" strokeDasharray="2.5 2" />
      )}
    </svg>
  )
}

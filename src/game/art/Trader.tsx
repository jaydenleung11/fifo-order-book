export type Mood = 'happy' | 'meh' | 'angry'

const JACKETS = ['#4c7fe0', '#8a5cd6', '#ee6f98', '#5dae3e', '#46627f', '#c9853a', '#3fa6d8', '#b04a8c']
const SKIN = ['#f5c9a3', '#d89a6a', '#a86b45', '#6e4429']
const HAIR = ['#2a2140', '#6b3e1f', '#c98b2b', '#1d1d2b']

/**
 * A trader's portrait for an order chip: head and shoulders in a pit
 * jacket. Mood is drawn with shapes, not only colour: a smile, a flat
 * mouth with a sweat drop, or a frown with angry brows and steam.
 */
export function Trader({ look, mood = 'happy' }: { look: number; mood?: Mood }) {
  const jacket = JACKETS[look % JACKETS.length]
  const skin = SKIN[(look * 3 + 1) % SKIN.length]
  const hair = HAIR[(look + 2) % HAIR.length]
  const style = look % 4
  return (
    <svg viewBox="0 0 40 40" className="block h-full w-full overflow-visible" aria-hidden="true">
      {/* shoulders in a jacket, with a collar */}
      <path d="M5 40 q0 -11 15 -11 q15 0 15 11 z" fill={jacket} />
      <path d="M15 29.5 l5 5 l5 -5" fill="none" stroke="#fff9f0" strokeWidth="2.2" strokeLinejoin="round" />
      {/* head */}
      <circle cx="20" cy="18" r="10" fill={skin} />
      {style === 0 && <path d="M10 16 a10 10 0 0 1 20 0 q-10 -4 -20 0 z" fill={hair} />}
      {style === 1 && (
        <>
          <path d="M10.5 17 a9.5 9.5 0 0 1 19 -1.5 q-7 -2.5 -13 1 z" fill={hair} />
          <circle cx="27" cy="8.5" r="3.8" fill={hair} />
        </>
      )}
      {style === 2 && (
        <>
          <path d="M10 15 a10 10 0 0 1 20 0 z" fill={jacket} />
          <rect x="17" y="6.5" width="13" height="3" rx="1.5" fill={jacket} />
        </>
      )}
      {style === 3 && (
        <g fill={hair}>
          <circle cx="13" cy="11" r="4" />
          <circle cx="19" cy="8.5" r="4.5" />
          <circle cx="25.5" cy="10" r="4" />
          <circle cx="29" cy="15" r="3" />
        </g>
      )}
      {/* face */}
      <circle cx="16.5" cy="19" r="1.5" fill="#2a2140" />
      <circle cx="23.5" cy="19" r="1.5" fill="#2a2140" />
      {mood === 'happy' && <path d="M16.5 23 q3.5 3 7 0" stroke="#2a2140" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
      {mood === 'meh' && (
        <>
          <path d="M17 24.2 h6" stroke="#2a2140" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M30 10 q2.2 3.5 0 5 q-2.2 -1.5 0 -5 z" fill="#5fb7e8" />
        </>
      )}
      {mood === 'angry' && (
        <>
          <path d="M14.5 15 l4 1.6 M25.5 15 l-4 1.6" stroke="#2a2140" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M16.5 25 q3.5 -3 7 0" stroke="#2a2140" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <g className="steam" fill="#ffffff" stroke="#2a2140" strokeWidth="0.9">
            <circle cx="32" cy="5" r="2.8" />
            <circle cx="36.5" cy="1" r="2" />
          </g>
        </>
      )}
    </svg>
  )
}

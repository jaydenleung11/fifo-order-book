import type { BookSnapshot } from '@/engine/types'
import { useInstrument } from '@/app/instruments'

/**
 * Cumulative size per level: how many shares you could trade by walking the
 * book out to each price. Bids grow leftward from the best bid, asks grow
 * rightward from the best ask. Bars are labelled, asks are hatched.
 */
export function DepthChart({ book }: { book: BookSnapshot }) {
  const inst = useInstrument()
  const cum = (levels: BookSnapshot['bids']) => {
    let run = 0
    return levels.map((l) => {
      run += l.orders.reduce((s, o) => s + o.qty, 0)
      return { price: l.price, total: run }
    })
  }
  const bids = cum(book.bids).reverse() // 95 .. 99, left to right
  const asks = cum(book.asks) // 101 .. 105
  const bars = [...bids.map((b) => ({ ...b, side: 'bid' as const })), ...asks.map((a) => ({ ...a, side: 'ask' as const }))]
  const max = Math.max(1, ...bars.map((b) => b.total))

  const W = 320
  const H = 150
  const top = 16
  const bottom = 38
  const gap = 4
  const mid = 14
  const bw = (W - mid - gap * (bars.length - 1)) / bars.length
  const plotH = H - top - bottom

  const summary = `Bids: ${bids
    .slice()
    .reverse()
    .map((b) => `${b.total} up to ${inst.px(b.price)}`)
    .join(', ')}. Asks: ${asks.map((a) => `${a.total} up to ${inst.px(a.price)}`).join(', ')}.`

  return (
    <section aria-labelledby="depth-title" className="rounded-2xl bg-surface p-4">
      <h2 id="depth-title" className="text-[15px] font-semibold">
        Depth
      </h2>
      <p className="mt-0.5 text-[12.5px] text-faint">{inst.unit[1][0].toUpperCase() + inst.unit[1].slice(1)} available out to each price, added up level by level.</p>
      <div className="mt-2 flex justify-between text-[12px]" aria-hidden>
        <span className="flex items-center gap-1.5 text-bid">
          <span className="inline-block size-2.5 rounded-sm bg-bid" />
          Bids
        </span>
        <span className="flex items-center gap-1.5 text-ask">
          Asks
          <span className="hatch-legend inline-block size-2.5 rounded-sm" />
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={summary}>
        <defs>
          <pattern id="ask-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--ask-soft)" />
            <rect width="2.2" height="6" fill="var(--ask)" />
          </pattern>
        </defs>
        <line x1="0" x2={W} y1={top + plotH} y2={top + plotH} stroke="var(--rule)" />
        {bars.map((b, i) => {
          const x = i * (bw + gap) + (b.side === 'ask' ? mid : 0)
          const h = (b.total / max) * plotH
          const y = top + plotH - h
          return (
            <g key={`${b.side}${b.price}`}>
              <rect
                x={x}
                y={y}
                width={bw}
                height={Math.max(h, b.total > 0 ? 1 : 0)}
                rx="2"
                fill={b.side === 'bid' ? 'var(--bid)' : 'url(#ask-hatch)'}
                style={{ transition: 'y 300ms ease, height 300ms ease' }}
              />
              {b.total > 0 && (
                <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="var(--muted)" className="tnum">
                  {b.total}
                </text>
              )}
              <text
                x={x + bw / 2 + 3}
                y={top + plotH + 8}
                textAnchor="end"
                fontSize="9.5"
                fill="var(--faint)"
                className="tnum"
                transform={`rotate(-45 ${x + bw / 2 + 3} ${top + plotH + 8})`}
              >
                {inst.px(b.price)}
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}

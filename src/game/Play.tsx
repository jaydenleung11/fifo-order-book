import { useEffect, useReducer, useRef, useState } from 'react'
import { Flame, Scale } from 'lucide-react'
import { Board, Tape, type ChipView, type Recent } from './Board'
import { Match, multiplier } from '@/engine/match'
import type { LevelDef } from '@/engine/levels'
import type { Side } from '@/engine/types'
import { sfx } from './sound'

/** How long an operation tag stays on screen, ms (matches .op-tag in game.css). */
const TAG_MS = 1100

/**
 * One run of a level. Owns the game clock (paused with the game or a
 * hidden tab), feeds it to the Match every frame, and turns the Match's
 * event log into sounds and operation tags.
 */
export function Play({
  def,
  paused,
  onPause,
  onDone,
}: {
  def: LevelDef
  paused: boolean
  onPause: () => void
  onDone: (m: Match) => void
}) {
  const [m] = useState(() => new Match(def))
  const [, render] = useReducer((n: number) => n + 1, 0)
  const clock = useRef({ base: 0, since: performance.now(), running: true })
  const seen = useRef(m.log.length)
  const recent = useRef<(Recent & { wall: number })[]>([])
  const keySeq = useRef(0)
  const finished = useRef(false)

  const now = () => {
    const c = clock.current
    return Math.round(c.base + (c.running ? performance.now() - c.since : 0))
  }

  // Pause and resume the clock.
  useEffect(() => {
    const c = clock.current
    if (paused && c.running) {
      c.base += performance.now() - c.since
      c.running = false
    } else if (!paused && !c.running) {
      c.since = performance.now()
      c.running = true
    }
  }, [paused])

  // A hidden tab pauses the game.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && !paused) onPause()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [paused, onPause])

  /** Turn new log entries into sounds and tags. */
  const drain = () => {
    const wall = performance.now()
    for (; seen.current < m.log.length; seen.current++) {
      const ev = m.log[seen.current]
      if (ev.type === 'enqueue') {
        if (ev.at === 0) continue
        sfx.join()
      } else if (ev.type === 'fill') {
        if (ev.ok) sfx.serve(ev.combo)
        else sfx.wrong()
      } else if (ev.type === 'expire') {
        sfx.wrong()
        continue
      } else continue
      recent.current.push({ ev, key: keySeq.current++, wall })
    }
    recent.current = recent.current.filter((r) => wall - r.wall < TAG_MS)
  }

  // The frame loop.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      m.advance(now())
      drain()
      if (m.done && !finished.current) {
        finished.current = true
        sfx.done()
        window.setTimeout(() => onDone(m), 700)
      }
      render()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tap = (lane?: number, id?: number) => {
    if (paused || m.done) return
    const f = m.tap(now(), lane, id)
    if (!f) sfx.nope()
    drain()
    render()
  }

  const onChip = (side: Side, lane: number, id: number) => {
    if (side !== m.takeSide()) {
      sfx.nope()
      return
    }
    tap(lane, id)
  }

  // Space or Enter fills by the rule at the best price; 1-3 pick a lane.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target
      const onControl = el instanceof Element && el.closest('button, a, input, summary, select, textarea')
      if ((e.key === ' ' || e.key === 'Enter') && !onControl) {
        e.preventDefault()
        tap()
      } else if (/^[1-9]$/.test(e.key)) {
        const side = m.takeSide()
        const n = Number(e.key) - 1
        if (side && n < m.prices(side).length) tap(n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const view = (side: Side): ChipView[][] => m.lanes(side).map((l) => l.toArray().map((c) => ({ ...c, mood: m.mood(c) })))
  const side = m.takeSide()
  const fairness = m.fills === 0 ? 1 : m.fairFills / m.fills
  const served = m.log.filter((e) => e.type === 'done-market' || e.type === 'expire').length

  return (
    <div className="flex flex-col gap-3">
      <Hud
        score={m.score}
        combo={m.combo}
        fairness={fairness}
        served={served}
        total={m.marketsIn.length}
      />
      <Board
        def={def}
        bids={view('buy')}
        asks={view('sell')}
        active={m.active}
        pending={m.pending}
        patience={m.patience()}
        takeSide={side}
        bestLane={side ? m.bestLane(side) : -1}
        recent={recent.current}
        onTap={onChip}
      />
      <Tape fills={m.tape()} />
    </div>
  )
}

function Hud({ score, combo, fairness, served, total }: { score: number; combo: number; fairness: number; served: number; total: number }) {
  const x = multiplier(combo)
  const pct = Math.round(fairness * 100)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-[3px] border-ink bg-paper px-3 py-2 sm:px-4">
      <div className="flex items-baseline gap-1.5" aria-live="off">
        <span className="font-sign text-[28px] leading-none tabular-nums">{score}</span>
        <span className="text-sm text-ink-soft">pts</span>
      </div>
      <span
        className={`flex items-center gap-1 rounded-full border-2 border-ink px-2 font-sign text-base leading-6 ${x > 1 ? 'bg-gold' : 'bg-transparent text-ink-soft'}`}
        aria-label={`Combo ${combo}, points times ${x}`}
      >
        <Flame className="size-4" strokeWidth={2.6} aria-hidden="true" />×{x}
      </span>

      {/* fairness: share of fills that took the oldest chip at the best price */}
      <div className="flex min-w-[150px] flex-1 items-center gap-2" role="meter" aria-label="Fairness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <Scale className="size-5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
        <div className="relative h-3.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-bg">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${pct >= 90 ? 'bg-good' : pct >= 70 ? 'bg-gold' : 'bg-bad'}`}
            style={{ width: `${pct}%` }}
          />
          {/* the 90% mark a star needs */}
          <span className="absolute inset-y-0 left-[90%] w-0.5 bg-ink/50" aria-hidden="true" />
        </div>
        <span className="w-10 text-right font-sign text-base tabular-nums">{pct}%</span>
      </div>

      <span className="font-sign text-base tabular-nums text-ink-soft" aria-label={`${served} of ${total} market orders done`}>
        {served}/{total}
      </span>
    </div>
  )
}

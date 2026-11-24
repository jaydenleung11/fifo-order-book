import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Flame, Scale, Users } from 'lucide-react'
import { Scene, type LaneView } from './Scene'
import { Taco } from './art/Person'
import { Sim, multiplier } from './engine/sim'
import type { LevelDef } from './engine/levels'
import { sfx } from './sound'

/**
 * One run of a level. Owns the simulation and the game clock; everything
 * on screen is read from the simulation on each animation frame.
 */
export function Play({ def, paused, onDone }: { def: LevelDef; paused: boolean; onDone: (sim: Sim) => void }) {
  const [sim] = useState(() => new Sim(def))
  const [, render] = useReducer((n: number) => n + 1, 0)
  const [cursor, setCursor] = useState(0)
  const clock = useRef({ base: 0, since: performance.now(), running: true })
  const seen = useRef(0)
  const finished = useRef(false)

  const now = useCallback(() => {
    const c = clock.current
    return c.running ? c.base + performance.now() - c.since : c.base
  }, [])

  // Pause when asked, or when the tab is hidden.
  useEffect(() => {
    const set = (run: boolean) => {
      const c = clock.current
      if (run === c.running) return
      if (run) c.since = performance.now()
      else c.base = c.base + performance.now() - c.since
      c.running = run
    }
    set(!paused && !document.hidden)
    const onVis = () => set(!paused && !document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [paused])

  const flush = useCallback(() => {
    for (; seen.current < sim.log.length; seen.current++) {
      const ev = sim.log[seen.current]
      if (ev.type === 'enqueue') sfx.join()
      else if (ev.type === 'dish') sfx.ready()
      else if (ev.type === 'serve') {
        if (ev.ok) sfx.serve(ev.combo)
        else sfx.wrong()
      }
    }
  }, [sim])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      sim.advance(now())
      flush()
      render()
      if (sim.done && !finished.current) {
        finished.current = true
        sfx.done()
        window.setTimeout(() => onDone(sim), 750)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [sim, now, flush, onDone])

  const serve = useCallback(
    (lane?: number, id?: number) => {
      if (paused || sim.done) return
      const ev = sim.serve(now(), lane, id)
      if (!ev) sfx.nope()
      flush()
      render()
    },
    [sim, now, flush, paused],
  )

  const multi = def.prices.length > 1
  const lifo = def.policy === 'lifo'

  // Keyboard: Space/Enter serves; 1-3 serve a lane; arrows move the lane cursor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SUMMARY') {
        if (e.key === ' ' || e.key === 'Enter') return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        serve(multi ? cursor : undefined)
      } else if (multi && /^[1-9]$/.test(e.key)) {
        const lane = Number(e.key) - 1
        if (lane < def.prices.length) {
          setCursor(lane)
          serve(lane)
        }
      } else if (multi && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        setCursor((c) => Math.max(0, Math.min(def.prices.length - 1, c + (e.key === 'ArrowUp' ? -1 : 1))))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [serve, multi, cursor, def.prices.length])

  const t = sim.t
  const lanes: LaneView[] = sim.lanes.map((l, i) => ({
    customers: l.toArray().map((c) => ({ ...c, mood: sim.mood(c, t) })),
    pickId: sim.pick(i)?.id,
  }))
  const recent = sim.log
    .map((ev, key) => ({ ev, key }))
    .filter(({ ev }) => ev.type !== 'dish' && t - ev.at < 1100)
  const fairness = sim.items === 0 ? 1 : sim.fairItems / sim.items
  const left = sim.script.length - sim.log.filter((e) => e.type === 'serve' && e.done).length
  const lastServe = [...sim.log].reverse().find((e) => e.type === 'serve')
  const status =
    lastServe && lastServe.type === 'serve'
      ? `Served customer ${lastServe.id}${lastServe.ok ? '' : ', out of order'}. ${sim.waiting()} waiting.`
      : `${sim.waiting()} waiting.`

  return (
    <div className="flex flex-col gap-3">
      <Hud score={sim.score} combo={sim.combo} fairness={fairness} left={left} lifo={lifo} />
      <Scene
        def={def}
        lanes={lanes}
        recent={recent}
        cursor={multi ? cursor : undefined}
        bestLane={multi ? sim.bestLane() : undefined}
        onPick={lifo ? undefined : (lane, id) => serve(lane, id)}
      />
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <Counter sim={sim} def={def} cursor={cursor} serve={serve} setCursor={setCursor} />
    </div>
  )
}

function Hud({ score, combo, fairness, left, lifo }: { score: number; combo: number; fairness: number; left: number; lifo: boolean }) {
  const mult = multiplier(combo)
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
      <div className="flex items-baseline gap-1.5">
        <span className="font-sign text-[clamp(28px,4vw,40px)] leading-none tabular-nums">{score}</span>
        <span className="text-sm font-bold text-ink-soft">pts</span>
      </div>
      <div
        className={`flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 font-sign text-lg leading-tight transition-colors ${
          mult > 1 ? 'bg-awning text-paper' : 'bg-paper/60 text-ink-soft'
        }`}
        aria-label={`Combo ${combo}, multiplier ${mult}`}
      >
        <Flame className="size-4" strokeWidth={2.6} aria-hidden="true" />×{mult}
      </div>
      <div className="flex min-w-[150px] flex-1 items-center gap-2 sm:max-w-[260px]" aria-label={`Fairness ${Math.round(fairness * 100)} percent`}>
        <Scale className="size-5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
        <div className="relative h-3.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-paper">
          <div
            className={`absolute inset-0 origin-left transition-transform duration-300 ${fairness >= 0.9 ? 'bg-mint' : fairness >= 0.6 ? 'bg-[#e9a23b]' : 'bg-tomato'}`}
            style={{ transform: `scaleX(${fairness})` }}
          />
        </div>
        <span className="w-10 text-right text-sm font-bold tabular-nums">{Math.round(fairness * 100)}%</span>
      </div>
      <div className="ml-auto flex items-center gap-1.5 text-sm font-bold" aria-label={`${left} customers to go`}>
        <Users className="size-4.5" strokeWidth={2.4} aria-hidden="true" />
        <span className="tabular-nums">{left}</span>
        {lifo && (
          <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[12px] text-paper" title="Last in, first out">
            LIFO
          </span>
        )}
      </div>
    </div>
  )
}

function Counter({
  sim,
  def,
  cursor,
  serve,
  setCursor,
}: {
  sim: Sim
  def: LevelDef
  cursor: number
  serve: (lane?: number, id?: number) => void
  setCursor: (n: number) => void
}) {
  const multi = def.prices.length > 1
  const ready = sim.dishes > 0
  const p = sim.cookProgress()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-2" aria-label={`${sim.dishes} ready to serve`}>
        <div className="relative grid size-11 place-items-center" title="Cooking">
          <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="22" cy="22" r="18" fill="var(--paper)" stroke="color-mix(in srgb, var(--ink) 18%, transparent)" strokeWidth="5" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="var(--awning)"
              strokeWidth="5"
              strokeDasharray={`${p * 113} 113`}
              strokeLinecap="round"
            />
          </svg>
          <Taco className="relative h-3.5 w-5" filled={p >= 1} />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: def.counterMax }, (_, i) => (
            <Taco key={i} filled={i < sim.dishes} className="h-6 w-9" />
          ))}
        </div>
      </div>

      {multi ? (
        <div className="flex gap-2" role="group" aria-label="Serve a lane">
          {def.prices.map((price, i) => (
            <button
              key={price}
              type="button"
              onClick={() => {
                setCursor(i)
                serve(i)
              }}
              className={`flex min-h-12 items-center gap-1.5 rounded-2xl border-[3px] border-ink px-3.5 font-sign text-xl shadow-[0_4px_0_var(--ink)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--ink)] active:translate-y-1 active:shadow-none ${
                ready ? 'bg-paper text-ink' : 'bg-paper/55 text-ink-soft'
              } ${cursor === i ? 'outline-3 outline-offset-2 outline-ink' : ''}`}
            >
              <kbd className="rounded bg-ink px-1.5 font-sans text-xs font-bold text-paper">{i + 1}</kbd>${price}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => serve()}
          className={`flex min-h-14 items-center gap-3 rounded-2xl border-[3px] border-ink px-6 font-sign text-[26px] shadow-[0_5px_0_var(--ink)] transition-[background-color,color,transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_7px_0_var(--ink)] active:translate-y-1 active:shadow-none ${
            ready ? 'bg-awning text-paper' : 'bg-paper/60 text-ink-soft'
          }`}
        >
          Serve
          <kbd className="rounded-md bg-ink/85 px-2 py-0.5 font-sans text-xs font-bold text-paper">Space</kbd>
        </button>
      )}
    </div>
  )
}

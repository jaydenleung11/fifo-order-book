import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeftRight, DoorOpen, Layers, PieChart, Pause, Play as PlayIcon, RotateCcw, Star, Volume2, VolumeX } from 'lucide-react'
import { LEVELS, type LevelDef } from '@/engine/levels'
import { Match, autoplay, type Result } from '@/engine/match'
import { Play } from './Play'
import { Board } from './Board'
import { Trader } from './art/Trader'
import { isMuted, setMuted } from './sound'
import { loadStars, saveStars } from './progress'

type Screen =
  | { name: 'menu' }
  | { name: 'intro'; level: number }
  | { name: 'play'; level: number; run: number }
  | { name: 'summary'; level: number; result: Result }
  | { name: 'reveal' }
  | { name: 'compare'; fifo: Result; lifo: Result }

/** Move focus to the main button only with a mouse; on phones it would pop the keyboard or jump the page. */
const FINE = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

const lvl = (id: number) => LEVELS.find((l) => l.id === id)!

export function Game() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })
  const [stars, setStars] = useState(loadStars)
  const [muted, setMute] = useState(isMuted)
  const [paused, setPaused] = useState(false)

  const start = (level: number) => {
    setPaused(false)
    setScreen({ name: 'play', level, run: Date.now() })
  }

  const finish = useCallback((m: Match) => {
    const def = m.def
    if (def.policy === 'lifo') {
      // The same orders and the same tap times; only the rule changes.
      const times = m.inputs.map((i) => i.at)
      const lifo = autoplay(def, 'lifo', times).result()
      const fifo = autoplay(def, 'fifo', times).result()
      setStars(saveStars(def.id, m.result().stars))
      setScreen({ name: 'compare', fifo, lifo })
      return
    }
    const result = m.result()
    setStars(saveStars(def.id, result.stars))
    setScreen({ name: 'summary', level: def.id, result })
  }, [])

  const pause = useCallback(() => setPaused(true), [])

  // P or Escape pauses during play.
  useEffect(() => {
    if (screen.name !== 'play') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') setPaused((p) => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen.name])

  const current = screen.name === 'play' || screen.name === 'intro' || screen.name === 'summary' ? screen.level : null
  const def = current ? lvl(current) : lvl(3)

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1180px] flex-col px-3 pb-6 pt-3 sm:px-6">
      <header className="flex items-center gap-2 py-2 sm:gap-3">
        <button type="button" onClick={() => setScreen({ name: 'menu' })} aria-label="Match the Book: levels" className="flex items-center gap-2 whitespace-nowrap font-sign text-[clamp(20px,3.2vw,30px)] leading-none">
          <Logo />
          <span className="max-[459px]:hidden">Match the Book</span>
        </button>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Levels">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setScreen({ name: 'intro', level: l.id })}
              aria-label={`Level ${l.id}: ${l.name}`}
              aria-current={current === l.id ? 'step' : undefined}
              className={`grid size-7 place-items-center rounded-full border-2 border-ink font-sign text-sm hover:bg-paper sm:size-8 sm:text-base ${
                current === l.id ? 'bg-ink text-paper hover:bg-ink' : stars[l.id] ? 'bg-paper text-ink' : 'bg-transparent text-ink'
              }`}
            >
              {l.id}
            </button>
          ))}
        </nav>
        {screen.name === 'play' && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Resume' : 'Pause'}
            className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper sm:size-9"
          >
            {paused ? <PlayIcon className="size-4" strokeWidth={2.6} /> : <Pause className="size-4" strokeWidth={2.6} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setMuted(!muted)
            setMute(!muted)
          }}
          aria-label={muted ? 'Turn sound on' : 'Mute sound'}
          aria-pressed={muted}
          className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper sm:size-9"
        >
          {muted ? <VolumeX className="size-4" strokeWidth={2.6} /> : <Volume2 className="size-4" strokeWidth={2.6} />}
        </button>
      </header>

      <main className="relative mt-2 flex-1">
        {screen.name === 'play' ? (
          <>
            <h1 className="sr-only">
              Level {def.id}: {def.name}
            </h1>
            <Play key={screen.run} def={def} paused={paused} onPause={pause} onDone={finish} />
            <p className="mt-3 px-1 text-[15px] font-bold text-ink-soft">{def.hint}</p>
            <HowItWorks def={def} />
            {paused && (
              <div className="absolute inset-0 z-[300] flex items-start justify-center bg-bg/60 pt-10 backdrop-blur-[2px]">
                <Card>
                  <h2 className="text-balance font-sign text-3xl">Paused</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Btn primary onClick={() => setPaused(false)} autoFocus>
                      Resume
                    </Btn>
                    <Btn onClick={() => start(def.id)}>Restart</Btn>
                    <Btn onClick={() => setScreen({ name: 'menu' })}>Levels</Btn>
                  </div>
                </Card>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-6 pt-2 sm:pt-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={screen.name + ('level' in screen ? screen.level : '')}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className={`w-full ${screen.name === 'compare' ? 'max-w-[760px]' : 'max-w-[560px]'}`}
              >
                {screen.name === 'menu' && <Menu stars={stars} onPick={(id) => setScreen({ name: 'intro', level: id })} />}
                {screen.name === 'intro' && <Intro def={def} onStart={() => start(def.id)} />}
                {screen.name === 'summary' && (
                  <Summary
                    def={def}
                    result={screen.result}
                    onRetry={() => start(def.id)}
                    onNext={() => (def.id === 3 ? setScreen({ name: 'reveal' }) : setScreen({ name: 'intro', level: def.id + 1 }))}
                  />
                )}
                {screen.name === 'reveal' && <Reveal onNext={() => setScreen({ name: 'intro', level: 4 })} />}
                {screen.name === 'compare' && (
                  <Compare fifo={screen.fifo} lifo={screen.lifo} onRetry={() => start(4)} onMenu={() => setScreen({ name: 'menu' })} />
                )}
              </motion.div>
            </AnimatePresence>
            {(screen.name === 'menu' || screen.name === 'intro') && <Preview key={screen.name === 'intro' ? def.id : 0} def={screen.name === 'intro' ? def : lvl(3)} />}
          </div>
        )}
      </main>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-soft">
        <span>Aarav Kyparlis &amp; Jayden Leung, CSCI-UA.0102 Data Structures</span>
        <a href="v1/" className="underline underline-offset-2 hover:text-ink">Version 1</a>
      </footer>
    </div>
  )
}

/** The board as it looks when a level opens: its starting chips, nothing to fill yet. */
function Preview({ def }: { def: LevelDef }) {
  const [m] = useState(() => new Match(def))
  const view = (l: ReturnType<Match['lanes']>) => l.map((q) => q.toArray().map((c) => ({ ...c, mood: 'happy' as const })))
  return (
    <div className="pointer-events-none w-full opacity-80" aria-hidden="true">
      <Board def={def} bids={view(m.bids)} asks={view(m.asks)} active={null} pending={[]} patience={1} takeSide={null} bestLane={-1} recent={[]} idle />
    </div>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
      <rect x="2" y="5" width="13" height="22" rx="4" fill="var(--bid)" stroke="var(--ink)" strokeWidth="2.5" />
      <rect x="17" y="5" width="13" height="22" rx="4" fill="var(--ask)" stroke="var(--ink)" strokeWidth="2.5" />
      <path d="M8.5 11 l-3 4 h6 z M23.5 21 l-3 -4 h6 z" fill="var(--paper)" />
    </svg>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[22px] border-[3px] border-ink bg-paper p-5 shadow-[0_8px_0_var(--ink)] sm:p-7 ${className}`}>{children}</div>
}

function Btn({ children, onClick, primary, autoFocus }: { children: React.ReactNode; onClick: () => void; primary?: boolean; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus && FINE}
      className={`inline-flex min-h-12 items-center gap-2 rounded-2xl border-[3px] border-ink px-5 font-sign text-xl text-ink shadow-[0_4px_0_var(--ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--ink)] active:translate-y-1 active:shadow-none ${
        primary ? 'bg-gold' : 'bg-paper'
      }`}
    >
      {children}
    </button>
  )
}

function Stars({ n, size = 'size-7' }: { n: number; size?: string }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} className={`${size} ${i < n ? 'fill-gold text-ink' : 'fill-transparent text-ink/35'}`} strokeWidth={2.2} />
      ))}
    </span>
  )
}

const ICON: Record<number, React.ReactNode> = {
  1: <DoorOpen className="size-6" strokeWidth={2.4} />,
  2: <PieChart className="size-6" strokeWidth={2.4} />,
  3: <Layers className="size-6" strokeWidth={2.4} />,
  4: <ArrowLeftRight className="size-6" strokeWidth={2.4} />,
}

function Menu({ stars, onPick }: { stars: Record<number, number>; onPick: (id: number) => void }) {
  const next = LEVELS.find((l) => !stars[l.id])?.id ?? 1
  return (
    <Card>
      <h1 className="text-balance font-sign text-[clamp(34px,6vw,52px)] leading-[0.95]">Match the Book</h1>
      <p className="mt-2 text-[17px]">You are the matching engine. Fill each market order from the right chip.</p>
      <ol className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {LEVELS.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onPick(l.id)}
              autoFocus={l.id === next && FINE}
              className={`flex w-full items-center gap-3 rounded-2xl border-[3px] border-ink p-3 text-left transition-[background-color] hover:bg-bg-hi ${l.id === next ? 'bg-bg-hi' : 'bg-paper'}`}
            >
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl border-2 border-ink ${l.id % 2 ? 'bg-bid-soft' : 'hatch bg-ask-soft'}`}>{ICON[l.id]}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-sign text-xl leading-tight">
                  {l.id}. {l.name}
                </span>
                <Stars n={stars[l.id] ?? 0} size="size-4" />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function Intro({ def, onStart }: { def: LevelDef; onStart: () => void }) {
  const multi = def.bids.length + def.asks.length > 1
  return (
    <Card>
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl border-[3px] border-ink bg-gold font-sign text-4xl">{def.id}</span>
        <div>
          <h2 className="text-balance font-sign text-[34px] leading-none">{def.name}</h2>
          <p className="mt-1.5 text-[17px]">{def.hint}</p>
        </div>
      </div>
      <IntroPicture def={def} />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Btn primary onClick={onStart} autoFocus>
          <PlayIcon className="size-5 fill-current" strokeWidth={2.4} /> Start
        </Btn>
        <span className="text-sm text-ink-soft">
          Tap a chip, or <Kbd>Space</Kbd>
          {multi && (
            <>
              {' '}
              / <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> for a lane
            </>
          )}
        </span>
      </div>
    </Card>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border-2 border-ink bg-paper px-1.5 py-px text-xs font-bold">{children}</kbd>
}

/** A tiny lane per level, with the chip to fill marked. */
function IntroPicture({ def }: { def: LevelDef }) {
  const chip = (id: number, pick: boolean, left = 1, size = 1) => (
    <span key={id} className={`relative grid h-12 w-9 shrink-0 place-items-end rounded-lg border-2 border-ink bg-paper pb-0.5 ${pick ? 'outline-3 outline-offset-2 outline-gold' : ''}`}>
      <span className="absolute -left-1.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-0.5 font-sign text-[10px] text-paper">{id}</span>
      <span className="absolute inset-x-1 top-1 h-6">
        <Trader look={id + 1} mood={def.policy === 'lifo' && !pick && id === 1 ? 'meh' : 'happy'} />
      </span>
      <span className="w-full text-center font-sign text-xs leading-none">{size > 1 ? `${left}/${size}` : left}</span>
    </span>
  )
  const lane = (price: number, ids: number[], pickIdx: number | null, part = false) => (
    <div className="flex items-center gap-2">
      <span className="w-11 shrink-0 font-sign text-lg">${price}</span>
      <span className="flex gap-1.5">{ids.map((id, i) => chip(id, i === pickIdx, part && i === 0 ? 1 : part ? 3 : 1, part ? 3 : 1))}</span>
    </div>
  )
  return (
    <div className="mt-5 flex flex-col gap-2 rounded-2xl border-2 border-ink/20 bg-ask-soft/60 p-3 pt-4">
      {def.id === 1 && lane(101, [1, 2, 3, 4], 0)}
      {def.id === 2 && lane(101, [1, 2, 3], 0, true)}
      {def.id >= 3 && (
        <>
          {lane(101, [2, 5, 7], def.policy === 'lifo' ? 2 : 0)}
          {lane(102, [1, 3], null)}
        </>
      )}
    </div>
  )
}

function Summary({ def, result, onRetry, onNext }: { def: LevelDef; result: Result; onRetry: () => void; onNext: () => void }) {
  const rows: [string, string][] = [
    ['Score', String(result.score)],
    ['Fairness', `${Math.round(result.fairness * 100)}%`],
    ['Best combo', String(result.bestCombo)],
    ['Mistakes', String(result.mistakes)],
    ['Missed orders', String(result.missed)],
  ]
  return (
    <div className="mx-auto max-w-[380px]">
      <div className="receipt px-6 py-8 shadow-[0_10px_30px_rgba(42,33,64,.18)]">
        <p className="text-center font-sign text-2xl">
          Level {def.id}: {def.name}
        </p>
        <div className="mt-3 flex justify-center">
          <Stars n={result.stars} size="size-10" />
        </div>
        <dl className="mt-4 border-y-2 border-dashed border-ink/40 py-3 font-mono text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-0.5">
              <dt>{k}</dt>
              <dd className="font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-center text-sm text-ink-soft">
          Filled in order: {result.order.slice(0, 12).map((n) => `#${n}`).join(' ')}
          {result.order.length > 12 ? ' …' : ''}
        </p>
      </div>
      <div className="mt-5 flex justify-center gap-2">
        <Btn onClick={onRetry}>
          <RotateCcw className="size-5" strokeWidth={2.6} /> Again
        </Btn>
        <Btn primary onClick={onNext} autoFocus>
          Next
        </Btn>
      </div>
    </div>
  )
}

function Reveal({ onNext }: { onNext: () => void }) {
  return (
    <Card>
      <h2 className="text-balance font-sign text-[clamp(28px,5vw,40px)] leading-[1.05]">Best price first, then first in line: price-time priority.</h2>
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-bg-hi p-3 font-sign text-lg" aria-hidden="true">
        <span className="rounded-lg border-2 border-ink bg-gold px-2">$101</span>
        <span>›</span>
        <span className="rounded-lg border-2 border-ink bg-paper px-2">$102</span>
        <span>›</span>
        <span className="rounded-lg border-2 border-ink bg-paper px-2">$103</span>
        <span className="ml-auto flex items-center gap-1 text-base">
          <DoorOpen className="size-4" strokeWidth={2.6} /> head first
        </span>
      </div>
      <div className="mt-5">
        <Btn primary onClick={onNext} autoFocus>
          Next
        </Btn>
      </div>
    </Card>
  )
}

function Compare({ fifo, lifo, onRetry, onMenu }: { fifo: Result; lifo: Result; onRetry: () => void; onMenu: () => void }) {
  const col = (title: string, sub: string, r: Result, good: boolean) => (
    <div className={`rounded-2xl border-[3px] border-ink p-4 ${good ? 'bg-[#e2f6e9]' : 'hatch bg-[#ffe3dd]'}`}>
      <p className="font-sign text-2xl leading-none">{title}</p>
      <p className="text-sm text-ink-soft">{sub}</p>
      <p className="mt-3 flex items-baseline gap-2 font-sign text-5xl leading-none tabular-nums">
        {Math.round(r.fairness * 100)}%<span className="font-sans text-sm font-bold">fair</span>
      </p>
      <dl className="mt-3 grid gap-0.5 text-[15px]">
        <div className="flex justify-between gap-2">
          <dt>Longest wait</dt>
          <dd className="font-bold tabular-nums">{(r.longestWait / 1000).toFixed(1)}s</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Filled ahead of an older chip</dt>
          <dd className="font-bold tabular-nums">{r.jumped}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1" aria-label={`Filled in this order: ${r.order.join(', ')}`}>
        {r.order.map((id) => (
          <span key={id} className="grid h-6 min-w-7 place-items-center rounded bg-paper px-1 font-sign text-sm">
            {id}
          </span>
        ))}
      </div>
    </div>
  )
  return (
    <Card>
      <h2 className="text-balance font-sign text-[clamp(28px,4.6vw,38px)] leading-none">Same orders. Same taps.</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {col('Queue', 'FIFO: oldest chip first', fifo, true)}
        {col('Stack', 'LIFO: newest chip first', lifo, false)}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Btn onClick={onRetry}>
          <RotateCcw className="size-5" strokeWidth={2.6} /> Again
        </Btn>
        <Btn primary onClick={onMenu} autoFocus>
          Levels
        </Btn>
      </div>
    </Card>
  )
}

function HowItWorks({ def }: { def: LevelDef }) {
  return (
    <details className="mt-4 max-w-[640px] rounded-2xl border-2 border-ink/25 bg-paper/60 px-4 py-2.5">
      <summary className="cursor-pointer font-bold">How it works</summary>
      <ul className="mt-2 grid gap-1 font-mono text-[13.5px]" translate="no">
        <li>new limit order joins the tail: enqueue(chip), O(1)</li>
        <li>fill the head: dequeue(), O(1)</li>
        <li>fill anyone else: walk the lane, O(n)</li>
        {def.bids.length + def.asks.length > 1 && <li>one queue per price; best price first</li>}
        {def.policy === 'lifo' && <li>LIFO fills the newest: a stack, pop()</li>}
      </ul>
    </details>
  )
}

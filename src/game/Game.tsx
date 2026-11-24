import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeftRight, Layers, Pause, Play as PlayIcon, RotateCcw, Star, Users, Volume2, VolumeX } from 'lucide-react'
import { LEVELS, type LevelDef } from './engine/levels'
import { autoplay, type Result, type Sim } from './engine/sim'
import { Play } from './Play'
import { Scene } from './Scene'
import { Person, Taco } from './art/Person'
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

  const finish = useCallback((sim: Sim) => {
    const def = sim.def
    if (def.policy === 'lifo') {
      // Same customers, same button presses; only the rule changes.
      const times = sim.inputs.map((i) => i.at)
      const lifo = autoplay(def, 'lifo', times).result()
      const fifo = autoplay(def, 'fifo', times).result()
      setStars(saveStars(def.id, lifo.stars))
      setScreen({ name: 'compare', fifo, lifo })
      return
    }
    const result = sim.result()
    setStars(saveStars(def.id, result.stars))
    setScreen({ name: 'summary', level: def.id, result })
  }, [])

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
  const def = current ? lvl(current) : lvl(1)

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1120px] flex-col px-4 pb-6 pt-3 sm:px-6">
      <header className="flex items-center gap-2 py-2 sm:gap-3">
        <button type="button" onClick={() => setScreen({ name: 'menu' })} className="font-sign whitespace-nowrap text-[clamp(18px,3.2vw,30px)] leading-none">
          Food Truck Rush
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
                current === l.id ? 'bg-ink text-paper' : stars[l.id] ? 'bg-paper text-ink' : 'bg-transparent text-ink'
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
            <Play key={screen.run} def={def} paused={paused} onDone={finish} />
            <p className="mt-3 px-1 text-[15px] font-bold text-ink-soft">{def.hint}</p>
            <HowItWorks def={def} />
            {paused && (
              <Overlay>
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
              </Overlay>
            )}
          </>
        ) : (
          <>
            <div className="pt-6 sm:pt-10" aria-hidden="true">
              <Scene def={screen.name === 'intro' ? def : lvl(1)} lanes={(screen.name === 'intro' ? def : lvl(1)).prices.map(() => ({ customers: [] }))} recent={[]} idle />
            </div>
            <div className="relative z-10 -mt-4 flex justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={screen.name + ('level' in screen ? screen.level : '')}
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  className="w-full max-w-[560px]"
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
            </div>
          </>
        )}
      </main>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-soft">
        <span>Aarav Kyparlis &amp; Jayden Leung, CSCI-UA.0102</span>
        <a href="v1/" className="underline decoration-2 underline-offset-2 hover:text-ink">
          Version 1
        </a>
      </footer>
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-[300] flex items-start justify-center pt-2 sm:pt-6">{children}</div>
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
      className={`inline-flex min-h-12 items-center gap-2 rounded-2xl border-[3px] border-ink px-5 font-sign text-xl shadow-[0_4px_0_var(--ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--ink)] active:translate-y-1 active:shadow-none ${
        primary ? 'bg-awning text-paper' : 'bg-paper text-ink'
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
        <Star key={i} className={`${size} ${i < n ? 'fill-[#ffc23a] text-ink' : 'fill-transparent text-ink/35'}`} strokeWidth={2.2} />
      ))}
    </span>
  )
}

const ICON: Record<number, React.ReactNode> = {
  1: <Users className="size-6" strokeWidth={2.4} />,
  2: <Taco className="h-5 w-8" />,
  3: <Layers className="size-6" strokeWidth={2.4} />,
  4: <ArrowLeftRight className="size-6" strokeWidth={2.4} />,
}

function Menu({ stars, onPick }: { stars: Record<number, number>; onPick: (id: number) => void }) {
  const next = LEVELS.find((l) => !stars[l.id])?.id ?? 1
  return (
    <Card>
      <h1 className="text-balance font-sign text-[clamp(34px,6vw,52px)] leading-[0.95]">Food Truck Rush</h1>
      <p className="mt-2 text-[17px]">Serve the line in order. First come, first served.</p>
      <ol className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {LEVELS.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onPick(l.id)}
              autoFocus={l.id === next && FINE}
              className={`flex w-full items-center gap-3 rounded-2xl border-[3px] border-ink p-3 text-left transition-[background-color] hover:bg-sky-hi ${l.id === next ? 'bg-sky-hi' : 'bg-paper'}`}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-truck text-paper">{ICON[l.id]}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-sign text-xl leading-tight">
                  {l.id}. {l.name}
                </span>
                {l.policy === 'lifo' ? (
                  <span className="text-sm text-ink-soft">FIFO vs LIFO</span>
                ) : (
                  <Stars n={stars[l.id] ?? 0} size="size-4" />
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function Intro({ def, onStart }: { def: LevelDef; onStart: () => void }) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-truck font-sign text-4xl text-paper">{def.id}</span>
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
          {def.prices.length > 1 ? (
            <>
              <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> serve a lane
            </>
          ) : (
            <>
              <Kbd>Space</Kbd> or tap Serve
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

/** A tiny diagram per level: who gets served next, drawn with an arrow. */
function IntroPicture({ def }: { def: LevelDef }) {
  const row = (ids: number[], served: number, mood: 'happy' | 'angry' = 'happy') => (
    <div className="flex items-end gap-1">
      {ids.map((id, i) => (
        <div key={id} className="relative w-9">
          {def.tickets && <span className="mx-auto mb-0.5 block w-6 rounded-sm bg-white text-center font-sign text-xs">{id}</span>}
          <div className={`h-14 ${id === served ? 'ftr-bob' : ''}`}>
            <Person look={id + 2} mood={def.policy === 'lifo' && i === 0 ? mood : 'happy'} />
          </div>
          {id === served && <span className="absolute -bottom-3 left-1/2 h-1.5 w-6 -translate-x-1/2 rounded-full bg-awning" />}
        </div>
      ))}
    </div>
  )
  return (
    <div className="mt-5 flex items-center gap-3 overflow-hidden rounded-2xl bg-street/60 p-3 pb-5">
      <span className="grid h-16 w-10 shrink-0 place-items-center rounded-lg bg-truck text-paper" aria-hidden="true">
        <Taco className="h-4 w-6" />
      </span>
      {def.prices.length > 1 ? (
        <div className="flex flex-col gap-1">
          {def.prices.map((p, i) => (
            <div key={p} className="flex items-center gap-2">
              <span className={`w-10 font-sign text-lg ${i === 0 ? 'text-ink' : 'text-ink-soft'}`}>${p}</span>
              <span className="flex gap-1">
                {[1, 2].map((k) => (
                  <span key={k} className={`size-5 rounded-full border-2 border-ink ${i === 0 && k === 1 ? 'bg-awning' : 'bg-paper'}`} />
                ))}
              </span>
            </div>
          ))}
        </div>
      ) : (
        row([1, 2, 3, 4], def.policy === 'lifo' ? 4 : 1, 'angry')
      )}
    </div>
  )
}

function Summary({ def, result, onRetry, onNext }: { def: LevelDef; result: Result; onRetry: () => void; onNext: () => void }) {
  const rows: [string, string][] = [
    ['Score', String(result.score)],
    ['Fairness', `${Math.round(result.fairness * 100)}%`],
    ['Best combo', String(result.bestCombo)],
    ['Out of order', String(result.mistakes)],
  ]
  return (
    <div className="mx-auto max-w-[380px]">
      <div className="ftr-receipt px-6 py-8 shadow-[0_10px_30px_rgba(47,29,69,.18)]">
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
          Served in order: {result.order.slice(0, 12).join(' ')}
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
  const rows: [React.ReactNode, string, string][] = [
    [<Layers key="l" className="size-7" strokeWidth={2.4} />, 'Lane', 'price level'],
    [
      <span key="p" className="block h-10 w-7">
        <Person look={1} mood="happy" />
      </span>,
      'Customer',
      'limit order',
    ],
    [<Taco key="t" className="h-6 w-9" />, 'Ready item', 'market order'],
  ]
  return (
    <Card>
      <h2 className="text-balance font-sign text-[clamp(30px,5vw,42px)] leading-none">This is an order book.</h2>
      <ul className="mt-5 grid gap-2.5">
        {rows.map(([icon, a, b]) => (
          <li key={a} className="flex items-center gap-3 rounded-2xl bg-sky-hi px-3 py-2">
            <span className="grid size-11 shrink-0 place-items-center">{icon}</span>
            <span className="font-sign text-xl">{a}</span>
            <span aria-hidden="true" className="text-xl">
              =
            </span>
            <span className="text-lg font-bold">{b}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[17px]">Best price first, then first come, first served: price-time priority.</p>
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
    <div className={`rounded-2xl border-[3px] border-ink p-4 ${good ? 'bg-[#e2f6e9]' : 'bg-[#ffe3dd]'}`}>
      <p className="font-sign text-2xl leading-none">{title}</p>
      <p className="text-sm text-ink-soft">{sub}</p>
      <p className="mt-3 font-sign text-5xl leading-none tabular-nums">{Math.round(r.fairness * 100)}%</p>
      <p className="text-sm font-bold">fair</p>
      <dl className="mt-3 grid gap-0.5 text-[15px]">
        <div className="flex justify-between">
          <dt>Longest wait</dt>
          <dd className="font-bold tabular-nums">{(r.longestWait / 1000).toFixed(1)}s</dd>
        </div>
        <div className="flex justify-between">
          <dt>Served ahead of someone earlier</dt>
          <dd className="font-bold tabular-nums">{r.jumped}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1" aria-label={`Served in this order: ${r.order.join(', ')}`}>
        {r.order.map((id) => (
          <span key={id} className="grid h-6 min-w-6 place-items-center rounded bg-paper px-1 font-sign text-sm">
            {id}
          </span>
        ))}
      </div>
    </div>
  )
  return (
    <Card className="!max-w-none">
      <h2 className="text-balance font-sign text-[clamp(28px,4.6vw,38px)] leading-none">Same customers. Same timing.</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {col('Queue', 'FIFO: oldest first', fifo, true)}
        {col('Stack', 'LIFO: newest first', lifo, false)}
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
        <li>join the back: enqueue(customer), O(1)</li>
        <li>serve the front: dequeue(), O(1)</li>
        <li>serve anyone else: walk the line, O(n)</li>
        {def.prices.length > 1 && <li>lanes: one queue per price, best price first</li>}
        {def.policy === 'lifo' && <li>LIFO: serve the newest, a stack, pop()</li>}
      </ul>
    </details>
  )
}

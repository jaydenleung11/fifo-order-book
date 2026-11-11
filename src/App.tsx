import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Box, Check, ChevronRight, Rows3, X } from 'lucide-react'
import { canStepForward, currentBook, currentEntry, fairnessForCurrent, shownTrades } from '@/engine/session'
import type { BookSnapshot, LogEntry } from '@/engine/types'
import { isScenario, useController, type Dispatch, type State } from '@/app/useController'
import { SCENARIOS } from '@/app/scenarios'
import { explain } from '@/app/explain'
import { Book } from '@/components/Book'
import { Dock, OrderForm } from '@/components/Controls'
import { OpsPanel } from '@/components/OpsPanel'
import { TradeTape } from '@/components/TradeTape'
import { DepthChart } from '@/components/DepthChart'
import { QueueDiagram } from '@/components/QueueDiagram'
import { RuleCard } from '@/components/RuleCard'
import { Segmented } from '@/components/ui/segmented'
import { Button } from '@/components/ui/button'
import SplitFlapText from '@/components/kokonutui/split-flap-text'
import type { LaneId } from '@/components/three/Book3D'
import { clock, cn } from '@/lib/utils'

const Book3D = lazy(() => import('@/components/three/Book3D'))

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function App() {
  const [state, dispatch] = useController()
  const { session } = state
  const entry = currentEntry(session)
  const book = currentBook(session)
  const trades = useMemo(() => shownTrades(session), [session])
  const fairness = useMemo(() => fairnessForCurrent(session), [session])
  const lastPrice = trades.length ? trades[trades.length - 1].price : null
  const webgl = useMemo(hasWebGL, [])
  const view = webgl ? state.view : 'flat'
  const [pinned, setPinned] = useState<LaneId | null>(null)

  useKeyboard(state, dispatch)

  return (
    <div className={cn('mx-auto max-w-[1480px] px-4 pb-10 pt-5 sm:px-6', state.prediction && 'pb-36')}>
      <a
        href="#book"
        className="sr-only rounded-full bg-ink px-4 py-2 text-ground focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to the order book
      </a>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="max-w-xl">
          <h1 className="text-balance text-[clamp(1.6rem,2.6vw,2.15rem)] font-bold leading-[1.05] tracking-[-0.02em]">
            First in, first filled
          </h1>
          <p className="mt-1.5 text-[15px] leading-snug text-muted">
            Every price is a <b className="font-semibold text-ink">queue</b>. Orders join at the tail, trades take from the head.
          </p>
        </div>
        <ModePicker state={state} dispatch={dispatch} />
      </header>

      <div className="mt-4 flex flex-col gap-3">
        <ScenarioCaption state={state} dispatch={dispatch} />
        <PredictBanner state={state} dispatch={dispatch} />

        <div id="book" tabIndex={-1} className="scroll-mt-4 outline-none">
          {view === '3d' ? (
            <div className="overflow-hidden rounded-2xl border border-rule bg-ground">
            <div className="relative h-[clamp(380px,40vw,580px)]">
              <Suspense fallback={<div className="grid h-full place-items-center text-[13px] text-faint">Building the 3D book…</div>}>
                <Book3D
                  book={book}
                  entry={entry}
                  prediction={state.prediction}
                  onGuess={(orderId) => dispatch({ type: 'guess', orderId })}
                  lane={pinned}
                  onLane={setPinned}
                />
              </Suspense>
              <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
                <Hud book={book} lastPrice={lastPrice} />
                <div className="pointer-events-auto flex items-center gap-2">
                  <span className="hidden text-[12px] text-faint [@media(pointer:fine)]:inline">drag to orbit · click a lane</span>
                  <ViewToggle state={state} dispatch={dispatch} webgl={webgl} />
                </div>
              </div>
              <BookSummary book={book} />
            </div>
              <div className="border-t border-rule">
                <StepCaption entry={entry} overlay />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap justify-end gap-2">
                <Segmented
                  size="sm"
                  label="Draw each queue as"
                  value={state.skin}
                  onChange={(skin) => dispatch({ type: 'skin', skin })}
                  options={[
                    { value: 'chips', label: 'Order chips' },
                    { value: 'checkout', label: 'Checkout lines' },
                  ]}
                />
                <ViewToggle state={state} dispatch={dispatch} webgl={webgl} />
              </div>
              <Book
                book={book}
                entry={entry}
                lastPrice={lastPrice}
                priority={state.priority}
                skin={state.skin}
                prediction={state.prediction}
                onGuess={(orderId) => dispatch({ type: 'guess', orderId })}
              />
              <StepCaption entry={entry} />
            </div>
          )}
        </div>

        <AnimatePresence>
          {state.error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start justify-between gap-3 rounded-xl bg-[#3a1d22] px-4 py-2.5 text-[13.5px] text-[#ffd1d6]"
            >
              {state.error}
              <button
                type="button"
                className="cursor-pointer rounded-full p-0.5 hover:bg-white/10"
                aria-label="Dismiss message"
                onClick={() => dispatch({ type: 'dismiss-error' })}
              >
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-2xl bg-surface p-3.5">
          <Dock state={state} dispatch={dispatch} />
          {state.mode === 'free' && (
            <div className="mt-3.5 border-t border-rule pt-3.5">
              <OrderForm config={session.config} dispatch={dispatch} disabled={!!state.prediction} />
            </div>
          )}
        </div>

        <div className="grid gap-3 min-[1100px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <QueueDiagram book={book} entry={entry} pinned={pinned} onUnpin={() => setPinned(null)} />
          <RuleCard priority={state.priority} onChange={(priority) => dispatch({ type: 'priority', priority })} fairness={fairness} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 min-[1100px]:grid-cols-3">
          <OpsPanel entry={entry} priority={state.priority} />
          <TradeTape trades={trades} />
          <DepthChart book={book} />
        </div>
      </div>

      <footer className="mt-8 border-t border-rule pt-4 text-[12.5px] text-faint">
        Made by Aarav Kyparlis and Jayden Leung for CSCI-UA.0102 Data Structures, NYU, Fall 2026. Keyboard: ← and → step, P plays or
        pauses. Prices and names are made up.
      </footer>
    </div>
  )
}

function ViewToggle({ state, dispatch, webgl }: { state: State; dispatch: Dispatch; webgl: boolean }) {
  if (!webgl) return null
  return (
    <Segmented<'3d' | 'flat'>
      size="sm"
      label="View"
      value={state.view}
      onChange={(view) => dispatch({ type: 'view', view })}
      options={[
        { value: '3d', label: <><Box className="size-3.5" aria-hidden />3D</> },
        { value: 'flat', label: <><Rows3 className="size-3.5" aria-hidden />Flat</> },
      ]}
    />
  )
}

/** Last trade and spread, floating over the 3D stage. */
function Hud({ book, lastPrice }: { book: BookSnapshot; lastPrice: number | null }) {
  const bestBid = book.bids.find((l) => l.orders.length)?.price ?? null
  const bestAsk = book.asks.find((l) => l.orders.length)?.price ?? null
  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface/85 px-3 py-1.5 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] leading-tight text-faint">Last<br />trade</span>
        <SplitFlapText
          text={lastPrice === null ? '---' : String(lastPrice)}
          length={3}
          className="text-[18px] font-semibold"
          tileClassName="bg-raised text-ink"
        />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11.5px] text-faint">Spread</span>
        <span className="tnum text-[17px] font-semibold">{bestBid !== null && bestAsk !== null ? bestAsk - bestBid : '–'}</span>
      </div>
    </div>
  )
}

/** One line: the operation in code, and what it means. */
function StepCaption({ entry, overlay }: { entry: LogEntry | null; overlay?: boolean }) {
  const ex = entry ? explain(entry, entry.book.priority) : null
  return (
    <div
      className={cn(
        'flex min-h-[3.6rem] max-w-full flex-col justify-center gap-0.5 px-4 py-2',
        overlay ? 'bg-surface' : 'rounded-xl bg-surface',
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={entry?.seq ?? 'idle'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {ex ? (
            <>
              <code className="font-mono text-[13px] font-semibold text-ink">{ex.op}</code>
              <p className="text-[13px] leading-snug text-muted">{ex.say}</p>
            </>
          ) : (
            <p className="text-[13px] text-muted">Press play, or step through one operation at a time.</p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** The 3D book, read out as text for screen readers. */
function BookSummary({ book }: { book: BookSnapshot }) {
  const line = (side: string, l: BookSnapshot['bids'][number]) =>
    `${side} ${l.price}: ${l.orders.length === 0 ? 'empty' : l.orders.map((o) => `#${o.id} ${o.trader} ${o.qty}`).join(', then ')}`
  return (
    <div className="sr-only">
      <h2>Order book, head of each queue first</h2>
      <ul>
        {book.asks.map((l) => (
          <li key={`a${l.price}`}>{line('Ask', l)}</li>
        ))}
        {book.bids.map((l) => (
          <li key={`b${l.price}`}>{line('Bid', l)}</li>
        ))}
      </ul>
    </div>
  )
}

function ModePicker({ state, dispatch }: { state: State; dispatch: Dispatch }) {
  const modes = [
    { id: 'live', title: 'Live market' },
    ...SCENARIOS.map((s, i) => ({ id: s.id, title: `${i + 1}. ${s.title.split(':')[0]}` })),
    { id: 'free', title: 'Build your own' },
  ]
  return (
    <nav aria-label="Modes">
      <ul className="flex flex-wrap gap-1 rounded-full bg-surface p-1">
        {modes.map((m) => {
          const on = state.mode === m.id
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => dispatch({ type: 'mode', mode: m.id })}
                className={cn(
                  'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150',
                  on ? 'bg-ink text-ground' : 'text-muted hover:bg-raised hover:text-ink',
                )}
              >
                {m.id === 'live' && <span className={cn('size-1.5 rounded-full', on ? 'bg-good' : 'bg-faint')} aria-hidden />}
                {m.title}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function ScenarioCaption({ state, dispatch }: { state: State; dispatch: Dispatch }) {
  const scenario = SCENARIOS.find((s) => s.id === state.mode)
  if (!scenario || !isScenario(state.mode)) return null
  const step = scenario.steps[state.scenarioStep]
  const last = state.scenarioStep >= scenario.steps.length - 1
  const busy = canStepForward(state.session)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-raised px-4 py-3">
      <span className="flex shrink-0 gap-1" aria-label={`Step ${state.scenarioStep + 1} of ${scenario.steps.length}`}>
        {scenario.steps.map((_, i) => (
          <span key={i} className={cn('h-1.5 w-5 rounded-full', i <= state.scenarioStep ? 'bg-ink' : 'bg-control')} />
        ))}
      </span>
      <p className="min-w-0 flex-1 text-[15px] leading-snug text-ink" aria-live="polite">
        {step.caption}
      </p>
      {last && !busy ? (
        <Button variant="quiet" onClick={() => dispatch({ type: 'reset' })}>
          Replay
        </Button>
      ) : (
        <Button variant="primary" onClick={() => dispatch({ type: 'scenario-next' })} disabled={!!state.prediction}>
          {state.playing ? 'Skip ahead' : 'Next'}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  )
}

function PredictBanner({ state, dispatch }: { state: State; dispatch: Dispatch }) {
  const p = state.prediction
  const continueRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (p?.guess != null) continueRef.current?.focus()
  }, [p?.guess])
  if (!p) return null
  const side = p.takerSide === 'buy' ? 'asks' : 'bids'
  const book = currentBook(state.session)
  const level = (p.takerSide === 'buy' ? book.asks : book.bids).find((l) => l.price === p.price)
  const correct = level?.orders.find((o) => o.id === p.correctId)
  const rule = state.session.log[state.session.cursor]?.book.priority ?? state.priority
  const why =
    rule === 'fifo'
      ? `Best price first (${p.price}), then earliest arrival: #${p.correctId}${correct ? ` arrived at ${clock(correct.time)}` : ''} and sits at the head.`
      : `LIFO takes the newest order at the best price (${p.price}): #${p.correctId}, at the tail.`
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-3xl rounded-2xl border border-focus/50 bg-raised px-4 py-3 shadow-[0_12px_40px_rgb(0_0_0/0.55)]"
      role="region"
      aria-label="Predict the fill"
    >
      {p.guess === null ? (
        <p className="text-[15px] text-ink">
          <b className="font-semibold">Your call:</b> a market {p.takerSide} is about to trade at {p.price}. Which {side.slice(0, -1)} fills
          first? Click its block.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-full text-ground',
              p.guess === p.correctId ? 'bg-good' : 'bg-bad',
            )}
            aria-hidden
          >
            {p.guess === p.correctId ? <Check className="size-4" /> : <X className="size-4" />}
          </span>
          <p className="min-w-0 flex-1 text-[14.5px] leading-snug text-ink" aria-live="assertive">
            <b className="font-semibold">{p.guess === p.correctId ? 'Right.' : `Not quite: #${p.correctId} goes first.`}</b> {why}
          </p>
          <Button ref={continueRef} variant="primary" onClick={() => dispatch({ type: 'continue' })}>
            Continue
          </Button>
        </div>
      )}
    </motion.div>
  )
}

function useKeyboard(state: State, dispatch: Dispatch) {
  const playing = state.playing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, select, textarea, [contenteditable]') || t.closest('[data-radix-collection-item]'))) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        dispatch({ type: 'step' })
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        dispatch({ type: 'back' })
      } else if (e.key === 'p' || e.key === 'P') {
        dispatch({ type: playing ? 'pause' : 'play' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, playing])
}

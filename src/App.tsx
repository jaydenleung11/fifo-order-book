import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronRight, X } from 'lucide-react'
import {
  currentBook,
  currentEntry,
  fairnessForCurrent,
  shownTrades,
  canStepForward,
} from '@/engine/session'
import { useController, type Dispatch, type State } from '@/app/useController'
import { SCENARIOS } from '@/app/scenarios'
import { Book } from '@/components/Book'
import { Lenses, OrderForm, Playback } from '@/components/Controls'
import { OpsPanel } from '@/components/OpsPanel'
import { TradeTape } from '@/components/TradeTape'
import { DepthChart } from '@/components/DepthChart'
import { FairnessCard } from '@/components/FairnessCard'
import { Button } from '@/components/ui/button'
import { clock, cn } from '@/lib/utils'

export default function App() {
  const [state, dispatch] = useController()
  const { session } = state
  const entry = currentEntry(session)
  const book = currentBook(session)
  const trades = useMemo(() => shownTrades(session), [session])
  const fairness = useMemo(() => fairnessForCurrent(session), [session])
  const lastPrice = trades.length ? trades[trades.length - 1].price : null

  useKeyboard(state, dispatch)

  return (
    <div className="mx-auto max-w-[1480px] px-4 pb-10 pt-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="max-w-2xl">
          <h1 className="text-[clamp(1.6rem,2.6vw,2.15rem)] font-bold leading-[1.05] tracking-[-0.02em]">
            First in, first filled
          </h1>
          <p className="mt-1.5 text-[15px] leading-snug text-muted">
            An order book is a row of queues, one per price. New orders join at the <b className="font-semibold text-ink">tail</b>;
            trades take from the <b className="font-semibold text-ink">head</b>.
          </p>
        </div>
        <ModePicker state={state} dispatch={dispatch} />
      </header>

      {/* Below 1180px, <main> and <aside> dissolve (display: contents) and the
          order-* classes interleave them: book, why, operations, controls. */}
      <div className="mt-5 flex flex-col gap-3 min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_23rem] min-[1180px]:items-start min-[1180px]:gap-4">
        <main className="flex min-w-0 flex-col gap-3 max-[1179px]:contents">
          <div className="order-1 empty:hidden">
            <ScenarioCaption state={state} dispatch={dispatch} />
          </div>
          <PredictBanner state={state} dispatch={dispatch} />
          <div className="order-2 min-w-0">
          <Book
            book={book}
            entry={entry}
            lastPrice={lastPrice}
            priority={state.priority}
            skin={state.skin}
            prediction={state.prediction}
            onGuess={(orderId) => dispatch({ type: 'guess', orderId })}
          />
          </div>
          <div className="order-3">
            <WhyFifo state={state} />
          </div>
          <div className="order-3 empty:hidden">
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
          </div>
          <div className="order-6 grid gap-x-8 gap-y-5 rounded-2xl bg-surface p-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <OrderForm config={session.config} dispatch={dispatch} disabled={!!state.prediction} />
            <Playback state={state} dispatch={dispatch} />
            <Lenses state={state} dispatch={dispatch} />
          </div>
        </main>

        <aside className="grid min-w-0 grid-cols-1 content-start gap-3 max-[1179px]:contents" aria-label="What happened">
          <div className="order-4 min-w-0">
            <OpsPanel entry={entry} priority={state.priority} />
          </div>
          <div className="order-5 min-w-0">
            <FairnessCard data={fairness} />
          </div>
          <div className="order-7 min-w-0">
            <TradeTape trades={trades} />
          </div>
          <div className="order-8 min-w-0">
            <DepthChart book={book} />
          </div>
        </aside>
      </div>

      <footer className="mt-8 border-t border-rule pt-4 text-[12.5px] text-faint">
        Made by Aarav Kyparlis and Jayden Leung for CSCI-UA.0102 Data Structures, NYU, Fall 2026. Keyboard: ← and → step, P plays or
        pauses. Prices and names are made up.
      </footer>
    </div>
  )
}

function ModePicker({ state, dispatch }: { state: State; dispatch: Dispatch }) {
  const modes = [{ id: 'free', title: 'Free play' }, ...SCENARIOS.map((s, i) => ({ id: s.id, title: `${i + 1}. ${s.title}` }))]
  return (
    <nav aria-label="Guided scenarios">
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
                  'h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150',
                  on ? 'bg-ink text-ground' : 'text-muted hover:bg-raised hover:text-ink',
                )}
              >
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
  if (!scenario) return null
  const step = scenario.steps[state.scenarioStep]
  const last = state.scenarioStep >= scenario.steps.length - 1
  const busy = canStepForward(state.session)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-raised px-4 py-3">
      <span className="tnum shrink-0 text-[12.5px] text-faint">
        Step {state.scenarioStep + 1} of {scenario.steps.length}
      </span>
      <p className="min-w-0 flex-1 text-[15px] leading-snug text-ink" aria-live="polite">
        {step.caption}
      </p>
      {last && !busy ? (
        <Button variant="quiet" onClick={() => dispatch({ type: 'reset' })}>
          Replay scenario
        </Button>
      ) : (
        <Button variant="primary" onClick={() => dispatch({ type: 'scenario-next' })} disabled={!!state.prediction}>
          {busy ? 'Play this step' : 'Next'}
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
          <b className="font-semibold">Your call:</b> a market {p.takerSide} is about to trade. Which order on the {side} side fills
          first? Click its chip.
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

function WhyFifo({ state }: { state: State }) {
  const lifo = state.priority === 'lifo'
  return (
    <p
      className={cn(
        'rounded-xl px-4 py-2.5 text-[13.5px] leading-snug',
        lifo ? 'bg-[#3a1d22] text-[#ffd1d6]' : 'bg-surface text-muted',
      )}
    >
      {lifo ? (
        <>
          <b className="font-semibold">LIFO is on.</b> The newest order at a price trades first, so anyone who arrives later can cut
          the line. Exchanges don&rsquo;t do this: it punishes the people who committed first.
        </>
      ) : (
        <>
          <b className="font-semibold text-ink">Why FIFO?</b> At the same price, whoever waited longest trades first. Arriving later
          can&rsquo;t get you ahead, so the only way to jump the line is a better price.
        </>
      )}
    </p>
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

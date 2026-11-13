import { useState, type ReactNode } from 'react'
import { useInstrument } from '@/app/instruments'
import { ArrowDownRight, ArrowUpRight, Minus, Pause, Play, Plus, RotateCcw, StepBack, StepForward } from 'lucide-react'
import { isScenario, type Speed } from '@/app/useController'
import type { BookConfig } from '@/engine/orderBook'
import type { Side } from '@/engine/types'
import type { Dispatch, State } from '@/app/useController'
import { Button } from './ui/button'
import { Segmented } from './ui/segmented'
import { Switch } from './ui/switch'

const MAX_UI_QTY = 20

function Group({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-[13px] font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  )
}

export function OrderForm({ config, dispatch, disabled }: { config: BookConfig; dispatch: Dispatch; disabled: boolean }) {
  const [side, setSide] = useState<Side>('buy')
  const [type, setType] = useState<'limit' | 'market'>('limit')
  const [qty, setQty] = useState(3)
  const inst = useInstrument()
  const prices = side === 'buy' ? config.bidPrices : config.askPrices
  const [price, setPrice] = useState<number>(prices[0])
  const shownPrice = prices.includes(price) ? price : prices[0]

  const submit = () => {
    if (type === 'limit') dispatch({ type: 'submit', order: { type, side, price: shownPrice, qty } })
    else dispatch({ type: 'submit', order: { type, side, qty } })
  }
  const verb = side === 'buy' ? 'buy' : 'sell'

  return (
    <Group title="Place an order">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Side>
          label="Side"
          value={side}
          onChange={(s) => {
            setSide(s)
            setPrice((s === 'buy' ? config.bidPrices : config.askPrices)[0])
          }}
          options={[
            { value: 'buy', label: <><ArrowUpRight className="size-3.5" aria-hidden />Buy</>, activeClass: 'bg-bid' },
            { value: 'sell', label: <><ArrowDownRight className="size-3.5" aria-hidden />Sell</>, activeClass: 'bg-ask' },
          ]}
        />
        <Segmented<'limit' | 'market'>
          label="Order type"
          value={type}
          onChange={setType}
          options={[
            { value: 'limit', label: 'Limit' },
            { value: 'market', label: 'Market' },
          ]}
        />
      </div>
      <p className="mt-2 text-[12.5px] text-faint">
        {type === 'limit'
          ? `Waits in line at its price. Joins the tail of the ${side === 'buy' ? 'bid' : 'ask'} queue.`
          : `Trades now with the best ${side === 'buy' ? 'asks' : 'bids'}, starting at the head.`}
      </p>
      <div className="mt-2.5 flex flex-wrap items-end gap-3">
        {type === 'limit' && (
          <label className="flex flex-col gap-1 text-[12px] text-muted">
            Price
            <select
              name="price"
              value={shownPrice}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="tnum h-9 cursor-pointer rounded-full bg-raised px-3 text-[14px] text-ink hover:bg-control"
            >
              {prices.map((p) => (
                <option key={p} value={p}>
                  {inst.px(p)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-col gap-1 text-[12px] text-muted">
          <span id="qty-label">Size</span>
          <div className="flex items-center gap-1" role="group" aria-labelledby="qty-label">
            <Button size="icon" aria-label="Decrease size" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
              <Minus className="size-4" aria-hidden />
            </Button>
            <input
              aria-labelledby="qty-label"
              name="size"
              type="text"
              autoComplete="off"
              inputMode="numeric"
              value={qty}
              onChange={(e) => {
                const v = Number(e.target.value.replace(/\D/g, ''))
                if (!Number.isNaN(v)) setQty(Math.min(MAX_UI_QTY, Math.max(1, v || 1)))
              }}
              className="tnum h-9 w-12 rounded-full bg-raised text-center text-[14px] text-ink"
            />
            <Button size="icon" aria-label="Increase size" onClick={() => setQty((q) => Math.min(MAX_UI_QTY, q + 1))} disabled={qty >= MAX_UI_QTY}>
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
        <Button variant={side === 'buy' ? 'bid' : 'ask'} onClick={submit} disabled={disabled} className="ml-auto">
          {type === 'limit' ? `Add limit ${verb} at ${shownPrice}` : `Send market ${verb}`}
        </Button>
      </div>
    </Group>
  )
}

/** Playback in one row: it runs by itself; pause to step through by hand. */
export function Dock({ state, dispatch }: { state: State; dispatch: Dispatch }) {
  const { session, playing, speed, prediction, mode } = state
  const live = mode === 'live'
  const atEnd = session.cursor >= session.log.length
  const canGoOn = live || isScenario(mode) || !atEnd
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-1.5">
        <Button
          size="icon"
          variant="quiet"
          aria-label="Step back"
          aria-keyshortcuts="ArrowLeft"
          title="Step back (←)"
          onClick={() => dispatch({ type: 'back' })}
          disabled={session.cursor === 0 || !!prediction}
        >
          <StepBack className="size-4" aria-hidden />
        </Button>
        <Button
          variant="primary"
          className="w-[6.5rem]"
          aria-keyshortcuts="P"
          title="Play / pause (P)"
          onClick={() => dispatch({ type: playing ? 'pause' : 'play' })}
          disabled={!playing && (!canGoOn || !!prediction)}
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          size="icon"
          variant="quiet"
          aria-label="Step forward"
          aria-keyshortcuts="ArrowRight"
          title="Step (→)"
          onClick={() => dispatch({ type: 'step' })}
          disabled={!canGoOn || !!prediction}
        >
          <StepForward className="size-4" aria-hidden />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Reset" title="Reset" onClick={() => dispatch({ type: 'reset' })}>
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>
      <Segmented<string>
        size="sm"
        label="Speed"
        value={String(speed)}
        onChange={(v) => dispatch({ type: 'speed', speed: Number(v) as Speed })}
        options={[
          { value: '0.5', label: '½×', aria: 'Half speed' },
          { value: '1', label: '1×', aria: 'Normal speed' },
          { value: '2', label: '2×', aria: 'Double speed' },
          { value: '4', label: '4×', aria: 'Four times speed' },
        ]}
      />
      <span className="flex items-center gap-1.5 text-[12.5px] text-faint" aria-live="off">
        {live && playing && <span className="size-2 animate-pulse rounded-full bg-good" aria-hidden />}
        {live ? (playing ? 'Live: orders keep arriving' : 'Paused: step through by hand') : `Step ${session.cursor} of ${session.log.length}`}
      </span>
      <div className="ml-auto">
        <Switch
          checked={state.predict}
          onChange={(on) => dispatch({ type: 'predict', on })}
          label="Predict the fill"
          hint="Pause before each trade and guess"
        />
      </div>
    </div>
  )
}

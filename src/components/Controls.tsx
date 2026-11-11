import { useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, Pause, Play, Plus, RotateCcw, StepBack, StepForward } from 'lucide-react'
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
                  {p}
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

export function Playback({ state, dispatch }: { state: State; dispatch: Dispatch }) {
  const { session, playing, speed, prediction } = state
  const total = session.log.length
  const atEnd = session.cursor >= total
  return (
    <Group title="Playback">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="icon" variant="quiet" aria-label="Step back" aria-keyshortcuts="ArrowLeft" title="Step back (←)" onClick={() => dispatch({ type: 'back' })} disabled={session.cursor === 0 || !!prediction}>
          <StepBack className="size-4" aria-hidden />
        </Button>
        <Button
          variant="primary"
          className="w-[6.5rem]"
          aria-keyshortcuts="P"
          title="Play / pause (P)"
          onClick={() => dispatch({ type: playing ? 'pause' : 'play' })}
          disabled={!playing && (atEnd || !!prediction)}
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button size="icon" variant="quiet" aria-label="Step forward" aria-keyshortcuts="ArrowRight" title="Step (→)" onClick={() => dispatch({ type: 'step' })} disabled={atEnd || !!prediction}>
          <StepForward className="size-4" aria-hidden />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Reset" title="Reset" onClick={() => dispatch({ type: 'reset' })}>
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <Segmented<string>
          size="sm"
          label="Speed"
          value={String(speed)}
          onChange={(v) => dispatch({ type: 'speed', speed: Number(v) as 0.5 | 1 | 2 })}
          options={[
            { value: '0.5', label: '½×', aria: 'Half speed' },
            { value: '1', label: '1×', aria: 'Normal speed' },
            { value: '2', label: '2×', aria: 'Double speed' },
          ]}
        />
        <span className="tnum text-[12.5px] text-faint" aria-live="off">
          {total === 0 ? 'No steps yet' : `Step ${session.cursor} of ${total}`}
        </span>
      </div>
    </Group>
  )
}

export function Lenses({ state, dispatch }: { state: State; dispatch: Dispatch }) {
  return (
    <Group title="Ways to see it">
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 text-[12px] text-muted" id="rule-label">Who trades first at a price</div>
          <Segmented
            label="Matching rule"
            value={state.priority}
            onChange={(priority) => dispatch({ type: 'priority', priority })}
            options={[
              { value: 'fifo', label: 'FIFO: oldest' },
              { value: 'lifo', label: 'LIFO: newest', activeClass: 'bg-bad' },
            ]}
          />
        </div>
        <div>
          <div className="mb-1 text-[12px] text-muted">Show each queue as</div>
          <Segmented
            label="Display"
            value={state.skin}
            onChange={(skin) => dispatch({ type: 'skin', skin })}
            options={[
              { value: 'chips', label: 'Order chips' },
              { value: 'checkout', label: 'Checkout lines' },
            ]}
          />
        </div>
        <Switch
          checked={state.predict}
          onChange={(on) => dispatch({ type: 'predict', on })}
          label="Predict the fill"
          hint="Pause each market order and guess who trades first."
        />
      </div>
    </Group>
  )
}

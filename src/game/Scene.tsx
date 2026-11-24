import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Coins, UserPlus } from 'lucide-react'
import { Person, Taco } from './art/Person'
import type { Customer, Mood, SimEvent } from './engine/sim'
import type { LevelDef } from './engine/levels'

export interface LaneView {
  customers: (Customer & { mood: Mood })[]
  /** Who the rule serves next in this lane (id), if anyone. */
  pickId?: number
}

interface SceneProps {
  def: LevelDef
  lanes: LaneView[]
  /** Recent events, for the little operation tags. */
  recent: { ev: SimEvent; key: number }[]
  /** Lane the keyboard cursor is on (several lanes only). */
  cursor?: number
  /** The lane the rule says to serve next. */
  bestLane?: number
  onPick?: (lane: number, id: number) => void
  /** Draw an empty street (menu backdrop). */
  idle?: boolean
}

/** One customer's width on screen, by available room. */
function slotFor(width: number, multi: boolean) {
  if (width >= 800) return multi ? 60 : 88
  if (width >= 520) return multi ? 50 : 66
  return multi ? 36 : 46
}

export function Scene({ def, lanes, recent, cursor, bestLane, onPick, idle }: SceneProps) {
  const multi = def.prices.length > 1
  return (
    <div className="relative select-none">
      <div className="grid grid-cols-[clamp(88px,19vw,210px)_minmax(0,1fr)]">
        {/* roof row: chimney and awning */}
        <div className="relative h-14 sm:h-16">
          <div className="ftr-chimney absolute left-[22%] top-0 h-5 w-5" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="absolute inset-x-0 bottom-0 top-4 rounded-tl-[40px] rounded-tr-[14px] bg-truck" />
          <div className="absolute left-[22%] top-3 h-4 w-3.5 rounded-t-sm bg-truck-dk" />
          <p className="font-sign absolute inset-x-2 bottom-1.5 truncate text-center text-[clamp(11px,1.7vw,17px)] leading-none text-paper">
            Food Truck
          </p>
        </div>
        <div className="relative">
          <div className="ftr-awning absolute -left-2 bottom-0 h-7 w-[min(260px,70%)] sm:h-8" aria-hidden="true" />
        </div>

        {lanes.map((lane, i) => (
          <LaneRow
            key={i}
            index={i}
            def={def}
            lane={lane}
            multi={multi}
            recent={recent.filter((r) => 'lane' in r.ev && r.ev.lane === i)}
            cursor={cursor === i}
            best={bestLane === i}
            onPick={onPick}
            idle={idle}
          />
        ))}

        {/* base: wheels and curb */}
        <div className="relative h-9 bg-truck-dk" aria-hidden="true">
          <Wheel className="left-[12%]" />
          <Wheel className="right-[12%]" />
        </div>
        <div className="h-9 bg-street" aria-hidden="true" />
        <div className="col-span-2 h-4 bg-curb" aria-hidden="true" />
      </div>
    </div>
  )
}

/** The cook behind the window, peeking over the counter. */
function Cook() {
  return (
    <svg viewBox="0 0 40 40" className="absolute bottom-0 left-1/2 h-[min(62%,64px)] -translate-x-1/2" aria-hidden="true">
      <rect x="9" y="27" width="22" height="16" rx="8" fill="#fff7e4" />
      <circle cx="20" cy="21" r="8.5" fill="#d89a6a" />
      <path d="M11 15 h18 v-3 a5 5 0 0 0 -3 -8 a5 5 0 0 0 -12 0 a5 5 0 0 0 -3 8 z" fill="#fff7e4" />
      <circle cx="23.5" cy="21" r="1.3" fill="#2f1d45" />
      <circle cx="28" cy="21" r="1.3" fill="#2f1d45" />
      <path d="M23 25 q2.5 2 5 0" stroke="#2f1d45" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Wheel({ className }: { className: string }) {
  return (
    <span className={`absolute -bottom-4 grid size-9 place-items-center rounded-full bg-ink ${className}`}>
      <span className="size-3.5 rounded-full bg-[#d9cfe3]" />
    </span>
  )
}

function LaneRow({
  index,
  def,
  lane,
  multi,
  recent,
  cursor,
  best,
  onPick,
  idle,
}: {
  index: number
  def: LevelDef
  lane: LaneView
  multi: boolean
  recent: { ev: SimEvent; key: number }[]
  cursor: boolean
  best: boolean
  onPick?: (lane: number, id: number) => void
  idle?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const slot = slotFor(width, multi)
  const room = width - 70
  const n = lane.customers.length
  const step = n > 0 ? Math.min(slot, room / n) : slot
  const personH = Math.round(slot * 1.55)
  const rowH = personH + (def.tickets ? 44 : 18)
  const lifo = def.policy === 'lifo'
  const price = def.prices[index]

  return (
    <>
      {/* the truck's window for this lane */}
      <div className="relative bg-truck" style={{ height: rowH }}>
        <div
          className={`absolute bottom-3 right-1.5 top-2 w-[58%] rounded-[10px] bg-truck-dk shadow-[inset_0_4px_0_rgba(0,0,0,.18)] ${
            cursor ? 'outline-3 outline-offset-2 outline-paper' : ''
          }`}
        >
          {multi && (
            <div
              className={`font-sign absolute left-1/2 top-2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[clamp(15px,2.2vw,22px)] leading-none ${
                best ? 'bg-paper text-ink' : 'bg-paper/70 text-ink-soft'
              }`}
            >
              ${price}
            </div>
          )}
          <Cook />
          <div className="absolute inset-x-[-6px] bottom-[-6px] h-2.5 rounded-sm bg-paper" />
        </div>
      </div>

      {/* the line */}
      <div
        ref={ref}
        data-lane={index}
        className={`relative flex items-end bg-street pl-2 ${multi && index > 0 ? 'border-t-2 border-dashed border-curb/70' : ''}`}
        style={{ height: rowH }}
      >
        {/* the spot the rule serves from: front (queue) or back (stack) */}
        {!idle && n > 0 && (
          <div
            className="ftr-spot pointer-events-none absolute -bottom-1 h-8"
            style={{ width: slot * 1.3, left: 8 + (lifo ? (n - 1) * step : 0) - slot * 0.15 }}
            aria-hidden="true"
          />
        )}
        <AnimatePresence initial={false} mode="popLayout">
          {lane.customers.map((c, i) => (
            <motion.button
              key={c.id}
              layout="position"
              type="button"
              tabIndex={-1}
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ y: -36, x: -24, opacity: 0, transition: { duration: 0.35 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              onClick={() => onPick?.(index, c.id)}
              className="relative shrink-0 cursor-pointer pb-1 text-left"
              style={{ width: slot, marginRight: step - slot, zIndex: 100 - i }}
              aria-label={`Customer ${c.id}${c.need > 1 ? `, ${c.got} of ${c.need} served` : ''}, ${c.mood}`}
            >
              {def.tickets && <Ticket c={c} />}
              {c.lure && def.lureChance > 0 && <TipBubble />}
              <div style={{ height: personH }} className={c.id === lane.pickId && c.mood !== 'angry' ? 'ftr-bob' : undefined}>
                <Person look={c.look} mood={c.mood} lure={c.lure && def.lureChance > 0} />
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {/* back of the line */}
        <motion.div layout="position" className="relative z-[150] ml-2 flex shrink-0 flex-col items-center self-end pb-1" aria-hidden="true">
          <span className="grid size-7 place-items-center rounded-full border-2 border-ink bg-paper text-ink">
            <UserPlus className="size-4" strokeWidth={2.4} />
          </span>
          <span className="h-8 w-1 rounded-full bg-ink" />
          <span className="h-1.5 w-6 rounded-full bg-ink" />
          <OpTags items={recent.filter((r) => r.ev.type === 'enqueue' || (r.ev.type === 'serve' && lifo))} side="back" />
        </motion.div>

        <div className="pointer-events-none absolute bottom-full left-1 z-[200]">
          <OpTags items={recent.filter((r) => r.ev.type === 'serve' && !lifo)} side="front" />
        </div>
      </div>
    </>
  )
}

function Ticket({ c }: { c: Customer }) {
  return (
    <div className="ftr-ticket mx-auto mb-1 flex w-[min(100%,40px)] flex-col items-center gap-0.5 px-1 pb-2 pt-0.5 shadow-sm">
      <span className="font-sign text-[15px] leading-none text-ink">{c.id}</span>
      {c.need > 1 && (
        <span className="flex gap-px">
          {Array.from({ length: c.need }, (_, k) => (
            <Taco key={k} filled={k < c.got} className="h-2 w-3" />
          ))}
        </span>
      )}
    </div>
  )
}

function TipBubble() {
  return (
    <span className="absolute -top-2 right-0 z-10 grid size-6 place-items-center rounded-full border-2 border-ink bg-[#ffe07a] text-ink" title="Waving a tip">
      <Coins className="size-3.5" strokeWidth={2.4} />
    </span>
  )
}

function opLabel(ev: SimEvent): { text: string; cost: string; tone: 'ok' | 'bad' | 'note' } | null {
  if (ev.type === 'enqueue') return { text: 'enqueue', cost: 'O(1)', tone: 'note' }
  if (ev.type !== 'serve') return null
  if (ev.op === 'cut' || (!ev.ok && ev.reason === 'time')) return { text: 'cut in line', cost: 'O(n)', tone: 'bad' }
  if (!ev.ok && ev.reason === 'price') return { text: 'not the best price', cost: '', tone: 'bad' }
  if (ev.op === 'pop') return { text: 'pop newest', cost: 'O(1)', tone: 'bad' }
  if (ev.op === 'partial') return { text: '1 of 2', cost: '', tone: 'note' }
  return { text: 'dequeue', cost: 'O(1)', tone: 'ok' }
}

function OpTags({ items, side }: { items: { ev: SimEvent; key: number }[]; side: 'front' | 'back' }) {
  return (
    <div className={`pointer-events-none absolute flex flex-col items-start gap-1 ${side === 'back' ? 'bottom-full right-0 mb-1' : 'bottom-1 left-0'}`}>
      {items.slice(-2).map(({ ev, key }) => {
        const l = opLabel(ev)
        if (!l) return null
        const pts = ev.type === 'serve' ? ev.points : 0
        return (
          <div
            key={key}
            translate="no"
            className={`ftr-tag flex items-center gap-1 whitespace-nowrap rounded-full border-2 px-2 py-0.5 font-mono text-[11.5px] font-semibold shadow-sm ${
              l.tone === 'bad' ? 'border-tomato bg-[#ffe3dd] text-tomato' : l.tone === 'ok' ? 'border-mint bg-[#e2f6e9] text-[#1f6e41]' : 'border-ink/30 bg-paper text-ink'
            }`}
          >
            {l.tone === 'bad' && <span aria-hidden="true">✕</span>}
            {l.text}
            {l.cost && <span className="opacity-70">{l.cost}</span>}
            {pts !== 0 && <span className="font-sign text-[13px] font-normal">{pts > 0 ? `+${pts}` : `−${-pts}`}</span>}
          </div>
        )
      })}
    </div>
  )
}

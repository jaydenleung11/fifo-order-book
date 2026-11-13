import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { Trade } from '@/engine/types'
import { cn } from '@/lib/utils'
import { useInstrument } from '@/app/instruments'
import { FirmLogo } from './FirmLogo'

export function TradeTape({ trades }: { trades: Trade[] }) {
  const rows = [...trades].reverse()
  const inst = useInstrument()
  return (
    <section aria-labelledby="tape-title" className="rounded-2xl bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 id="tape-title" className="text-[15px] font-semibold">
          Trade tape
        </h2>
        <span className="tnum text-[12px] text-faint">{trades.length} trades, newest first</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-faint">No trades yet. Send a market order to see who gets filled.</p>
      ) : (
        <ol className="mt-2 max-h-56 overflow-y-auto pr-1 text-[13px]" aria-label="Executed trades">
          <AnimatePresence initial={false}>
            {rows.map((t) => {
              const buy = t.takerSide === 'buy'
              const Icon = buy ? ArrowUpRight : ArrowDownRight
              return (
                <motion.li
                  key={t.id}
                  layout="position"
                  initial={{ opacity: 0, backgroundColor: 'rgb(255 255 255 / 0.14)' }}
                  animate={{ opacity: 1, backgroundColor: 'rgb(255 255 255 / 0)' }}
                  transition={{ duration: 0.7 }}
                  className="tnum grid grid-cols-[2rem_3.5rem_1fr_auto] items-center gap-2 rounded-md border-b border-rule px-1 py-1.5 last:border-0"
                >
                  <span className="text-faint">{t.id}</span>
                  <span className={cn('flex items-center gap-0.5 font-semibold', buy ? 'text-bid' : 'text-ask')}>
                    <Icon className="size-3.5" aria-hidden />
                    {buy ? 'Buy' : 'Sell'}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-muted">
                    <span className="text-ink">#{t.makerId}</span>
                    <FirmLogo name={t.makerTrader} className="h-[18px] min-w-0" />
                  </span>
                  <span className="text-right">
                    <span className="font-semibold text-ink">{t.qty}</span>
                    <span className="text-faint"> @ </span>
                    {inst.px(t.price)}
                  </span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}

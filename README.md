# First in, first filled

An interactive order book in which every price level is a **queue**. New limit orders
`enqueue` at the tail, and market orders `dequeue` from the head of the best price level. That
is FIFO, or price-time priority, which is how real exchanges match orders.

Course project for NYU CSCI-UA.0102-060 Data Structures, Fall 2026, by
Aarav Kyparlis (ak13728) and Jayden Leung (jal9756).

Live site: <https://fifo-order-book.vercel.app>  
Repository: <https://github.com/jaydenleung11/fifo-order-book>

## What it shows

- **A ladder of queues.** There are 5 bid and 5 ask levels. Each level is a horizontal queue of
  order chips showing id, trader, size and arrival time. The head of every queue faces the
  spread; the tail is a dashed "joins here" slot.
- **Animations driven by the engine's event log.** A new chip slides in at the tail. A market
  order token walks to the best opposing level and trades with the head. Partial fills shrink the
  head chip, and filled chips leave with a flash.
- **Operations panel.** It names each step (`asks[101].enqueue(#14) O(1)`,
  `level.dequeue() → #3 O(1)`) and highlights the matching pseudocode line.
- **Trade tape**, **cumulative depth chart**, and a **split-flap last-trade board**.
- **FIFO vs LIFO.** Flip the matching rule. The "Same book, other rule" card replays every
  finished market order on a copy of the book under both rules, so you can see who would have
  cut the line.
- **Checkout-line skin.** The same queues drawn as supermarket lines: shoppers, baskets, tills.
- **Predict the fill.** Each market order pauses before its first trade, you click the chip you
  think fills first, and you get instant feedback.
- **3 guided scenarios:** same price, partial fill, sweeping levels. Each step has a one-line
  caption, and each scenario can be deep-linked (`#same-price`, `#partial`, `#sweep`).

Controls: Step back, Play/Pause, Step, Reset, and Speed (½×, 1×, 2×). Keyboard: `←`/`→` step,
`P` plays or pauses.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest engine tests
npm run build      # type-check + production build into dist/
```

## Deploy

**Vercel (live site).** The Vercel project is linked to this repository with the Vite preset
(build `npm run build`, output `dist`, no `BASE_PATH`). Every push to `main` deploys to
production; other branches get preview URLs.

**GitHub Pages (manual fallback).** In the repo go to Settings → Pages → Build and deployment,
set Source to **GitHub Actions**, then run the "Deploy to GitHub Pages" workflow from the
Actions tab. It tests, builds with `BASE_PATH=/<repo-name>/`, and publishes `dist/` to
`https://<user>.github.io/<repo-name>/`. Nothing in the code hard-codes the repo name:
`vite.config.ts` reads `BASE_PATH` (default `/`).

## How it is built

```
src/engine/        pure TypeScript, no React or DOM
  queue.ts         OrderQueue: doubly linked list, O(1) enqueue / dequeue / peek
  orderBook.ts     OrderBook: one OrderQueue per price; addLimit, market, clone,
                   compareFairness; every operation returns LogEntry[]
                   (an event + a snapshot of the book right after it)
  session.ts       append-only event log + cursor; Step/Back/Play/Reset are
                   cursor moves, so playback is deterministic
  engine.test.ts   Vitest: FIFO order, partial fills, multi-level sweeps,
                   price priority, LIFO contrast, playback determinism
src/app/           controller (useReducer), plain-English explanations,
                   pseudocode, scenarios
src/components/    Book (ladder, lanes, chips), controls, panels
```

Stack: Vite 8, React 19, TypeScript 7, Tailwind CSS 4, Motion (layout and enter/exit
animations), Radix primitives (toggle groups, switch) styled shadcn-style with `cva`, Lucide
icons, Vitest, and self-hosted fonts (Schibsted Grotesk, JetBrains Mono for code) via
Fontsource.

## Decisions we made (and why)

- **Limit orders never cross the spread.** You pick a price from your own side's levels, so a
  limit order always rests in a queue. That keeps the story about queues, not about marketable
  limit orders.
- **LIFO is shown, never used for real.** `popTail()`/`peekTail()` exist only so the toggle can
  show the queue being misused as a stack.
- **Order ids are assigned in arrival order**, and arrival time is shown as a market clock
  (`9:30:07`) to make "time priority" concrete.
- **The fairness card appears only after a market order finishes**, so it can't give away the
  answer in Predict mode.
- **Side is never colour alone.** Bids are cyan with a solid left edge and an ↗ glyph; asks are
  amber with a hatched right edge and an ↘ glyph. The tape says "Buy"/"Sell" in words.
- **Motion:** `MotionConfig reducedMotion="user"` plus a CSS `prefers-reduced-motion` rule.
  Chip width animates on purpose, because the shrinking width *is* the partial fill.
- **Design skills** (copied into `.claude/skills/`): taste-skill, ui-ux-pro-max, Anthropic's
  frontend-design, and Vercel's web-design-guidelines and react-best-practices. We used their
  accessibility and data-UI rules. We declined two suggestions: ui-ux-pro-max proposed a light
  "claymorphism + Comic Neue" style, and taste-skill dealt "lime on true black", a pattern
  frontend-design lists as a generated-UI tell. Both clashed with the brief's dark, intentional
  look. We kept sentence-case labels (frontend-design) over the guidelines' Title Case rule.
- **kokonutui:** we used its split-flap text board (MIT, header kept) and its sliding-pill
  technique for segmented controls. **bklit-ui** was skipped: it is a visx-based monorepo, and a
  10-bar cumulative depth chart is clearer as ~60 lines of hand-written SVG.

# First in, first filled

An interactive order book in which every price level is a **queue**. New limit orders
`enqueue` at the tail, and market orders `dequeue` from the head of the best price level. That
is FIFO, or price-time priority, which is how real exchanges match orders.

Course project for NYU CSCI-UA.0102-060 Data Structures, Fall 2026, by
Aarav Kyparlis (ak13728) and Jayden Leung (jal9756).

Live site: <https://fifo-order-book.vercel.app>  
Repository: <https://github.com/jaydenleung11/fifo-order-book>

## What it shows

- **A 3D order book that runs by itself.** The *Live market* mode invents a steady flow of
  orders, so you can just watch. Each price level is a lane of blocks: block height is the order's
  size, and every queue's **head** faces the middle aisle. New orders drop in at the **tail**. A
  glowing market order walks down the aisle to the best price and trades with the head. Filled
  orders float away, and the rest of the line slides forward. Pause at any time and step one
  operation at a time (`←`/`→`), or drag to orbit the camera.
- **Inside one queue.** The lane being worked on is redrawn as a linked list (`head → … → tail →
  null`), with the pointer change for each step (`tail.next = node`, `head = head.next`) and its
  cost, O(1). Click any lane in 3D to pin it.
- **Who trades first? (FIFO vs LIFO).** A small animated picture of four orders shows the queue
  (oldest first) and the stack (newest cuts the line). Clicking either one switches the rule for
  the whole book. After each market order, the book replays it both ways on a copy.
- **Guided scenarios** (same price, partial fill, sweeping levels). They advance on their own, one
  caption per step, and can be deep-linked (`#same-price`, `#partial`, `#sweep`).
- **Build your own** (`#build`): place limit and market orders yourself.
- **Predict the fill**: pauses before each trade, and you click the block you think fills first.
- **The code**: the matching algorithm's pseudocode, with the running line lit up. Also a
  **trade tape**, a **depth chart** and a split-flap **last trade** board.
- **Flat view**: the same book as 2D order chips or checkout lines. Phones start in this view,
  and it is also used when WebGL is unavailable.

Controls: Step back, Play/Pause, Step, Reset, and Speed (½×, 1×, 2×, 4×). Keyboard: `←`/`→` step,
`P` plays or pauses. With reduced motion turned on, nothing moves until you press Play.

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
src/app/           controller (useReducer), live order generator
                   (seeded, repeatable), explanations, pseudocode, scenarios
src/components/    three/Book3D (react-three-fiber scene), QueueDiagram
                   (linked list), RuleCard, flat Book, controls, panels
```

Stack: Vite 8, React 19, TypeScript 7, Tailwind CSS 4, three.js with react-three-fiber and
drei (the 3D book, lazy-loaded), Motion (layout and enter/exit animations), Radix primitives (toggle groups, switch) styled shadcn-style with `cva`, Lucide
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

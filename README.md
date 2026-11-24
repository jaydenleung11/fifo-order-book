# First in, first filled

A course project about **queues** for NYU CSCI-UA.0102-060 Data Structures, Fall 2026, by
Aarav Kyparlis (ak13728) and Jayden Leung (jal9756).

- **Version 2, Food Truck Rush** (the game), at <https://fifo-order-book.vercel.app/>
- **Version 1, the order book**, at <https://fifo-order-book.vercel.app/v1/>

Repository: <https://github.com/jaydenleung11/fifo-order-book>. Version 1 is preserved as the git
tag `v1` and the branch `v1-archive`.

## Version 2: Food Truck Rush

You run a food truck window, and the line is a FIFO queue. Customers join at the **back**
(`enqueue`) and you serve the **front** (`dequeue`). Serving anyone else is possible, but the
people you skipped get angry and you lose points. Serving in order builds a combo.

| Level | Idea it adds |
| --- | --- |
| 1. One line | Serve the front. A glowing spot marks the front, a signpost marks the back. |
| 2. Rush hour | Faster arrivals, numbered tickets, and two-item orders that stay at the front until both are served (a partial fill). Some customers wave a tip to tempt you to serve them early. |
| 3. Three lanes | Lanes priced $11, $10 and $9, one queue each. Serve the best price first, then the front of that lane. A short screen then reveals that this is an order book: lane = price level, customer = limit order, ready item = market order. That is price-time priority. |
| 4. Chaos mode | The rush-hour customers again, under LIFO (newest first). At the end, both rules are replayed on the same customers with the same button presses and shown side by side: how fair each was, the longest wait, and the order people were served in. |

In level 3 the waiting customers are buyers bidding a price, and each ready item is the truck
selling "at market" into the best bid. (The brief said "a buyer arriving"; we put the market
order on the seller's side so the waiting customers can stay the buyers.)

**Controls.** Space or Enter serves (in chaos mode it serves the newest). Click or tap any
customer to serve them out of turn. In level 3, keys `1` `2` `3` serve a lane, and `↑`/`↓` move
the lane that Space serves. `P` or `Esc` pauses. There is a mute button, and a "How it works"
panel that starts collapsed.

**Scoring.** You get 10 points per item served in order (5 if the customer had already waited
too long). The multiplier goes up by ×1 every 4 in-order serves, to a maximum of ×4. Serving out
of order costs 25 points and resets the combo. The fairness meter shows the share of items that
went to whoever had waited longest. Stars: 1 for finishing, 1 for at least 90% fairness, and 1
for reaching the level's score target.

### How it is built

```
src/game/engine/        pure TypeScript, no React or DOM
  line.ts               Line: Version 1's linked-list OrderQueue plus removeWhere()
                        (cutting the line, O(n))
  levels.ts             level settings and scriptFor(): the seeded customer sequence
  rng.ts                Mulberry32 seeded random numbers
  sim.ts                Sim: arrivals, kitchen, serving, scoring, an input log and an event
                        log; replay() rebuilds a game from its inputs; autoplay() runs the
                        FIFO/LIFO comparison
  game.test.ts          Vitest: FIFO order, partial service, lane priority, LIFO vs FIFO
                        on identical customers, replay determinism
src/game/               React UI: Game (screens), Play (game clock + HUD), Scene (truck
                        and lanes), art/Person (customers drawn as SVG), sound (Web Audio)
index.html              Version 2 entry (/)
v1/index.html           Version 1 entry (/v1/), code in src/app, src/components, src/engine
```

The game is deterministic. The customers come from a seeded script, and every player action is
logged with its game-clock time, so `replay(level, inputs)` rebuilds exactly the same game.
Chaos mode uses the same seed as rush hour.

### Design

The look is midday street food: a butter-yellow sky, apricot pavement, a teal truck with a
cherry-and-cream awning, and plum instead of black for text. Fonts are Lilita One (the
hand-painted truck sign) and Atkinson Hyperlegible Next (small text, chosen because it stays
readable when tiny). All art is drawn by us in SVG and CSS, with no logos or brands. Mood is
shown by shape as well as colour: a smile; a flat mouth with a sweat drop; a frown with angry
brows and steam. Animations respect `prefers-reduced-motion`.

Design skills used (in `.claude/skills/`):
- **frontend-design:** palette and type plan, one bold element (the truck), sentence case,
  no template chrome.
- **web-design-guidelines:** audited `src/game`. We fixed the findings: hover states, the
  fairness bar animated with transform, autofocus only with a mouse, focus on Resume when
  paused, `translate="no"` on code tokens, balanced headings.
- **ui-ux-pro-max** and **taste-skill:** used as checklists for touch targets and
  anti-template rules.

From **kokonutui**, the summary screen borrows the torn-paper look of its receipt-printer
component. We drew our own simpler version rather than shipping its physics. Lucide supplies the
UI icons.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (game) and http://localhost:5173/v1/ (order book)
npm test           # Vitest: Version 1 engine + Version 2 game engine
npm run build      # type-check + production build of both pages into dist/
```

## Deploy

**Vercel (live site).** The Vercel project is linked to this repository with the Vite preset
(build `npm run build`, output `dist`). Every push to `main` deploys to production. The build
produces `dist/index.html` (the game) and `dist/v1/index.html` (the order book).
`vercel.json` only redirects `/v1` to `/v1/`. No project settings or domains changed.

**GitHub Pages (manual fallback).** Set Settings → Pages → Source to **GitHub Actions**, then run
the "Deploy to GitHub Pages" workflow. It builds with `BASE_PATH=/<repo-name>/`. The game's link
to Version 1 and Version 1's link back are relative, so both work under that path.

## Version 1: the order book (at /v1/)

An interactive order book in which every price level is a queue. New limit orders `enqueue` at
the tail, and market orders `dequeue` from the head of the best price level. It is unchanged
except for a "Back to the game" link.

### What it shows

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

### How it is built

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

### Decisions we made (and why)

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

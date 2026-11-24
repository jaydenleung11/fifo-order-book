# Match the Book

A small game about **queues** for NYU CSCI-UA.0102-060 Data Structures, Fall 2026, by
Aarav Kyparlis (ak13728) and Jayden Leung (jal9756).

Live: <https://fifo-order-book.vercel.app/>
Repository: <https://github.com/jaydenleung11/fifo-order-book>

You are the matching engine of an order book. Bids sit on the left and asks on the right. Each
price level is a **lane**, and each lane is a FIFO queue of order chips. A chip shows its arrival
number and size, and a small trader. New limit orders slide onto the **tail** of their lane
(`enqueue`, O(1)). Market orders arrive in the middle, each with a size and a patience ring. You
fill them by tapping the **head** chip of the best-priced lane (`dequeue`, O(1)).

## Levels

| Level | What it adds |
| --- | --- |
| 1. One lane | One ask lane. Fill from the head. |
| 2. Partial fills | Bigger chips and bigger orders. A tap trades min(chip, order still wanted); a chip shrinks and stays at the head until it is used up, so a big order takes several taps. |
| 3. Price levels | Three bid and three ask lanes. A buy takes from the asks, a sell from the bids. Best price first, then the head of that lane. Afterwards one line names it: price-time priority. |
| 4. FIFO vs LIFO | The identical order sequence from level 3 (same seed), but the rule is now LIFO: the newest chip fills first. At the end both rules are replayed on the same orders with your tap times and shown side by side: fairness, longest wait, and how many chips were filled ahead of an older one. |

**Mistakes.** Tapping a chip that is not the head is a *queue jump*: an `✕ queue jump O(n)` tag,
−25 points, the combo resets, and every chip that was skipped turns angry (frown, brows, steam).
Tapping a lane at a worse price is a *price violation* (`✕ worse price`), and the traders at the
better price turn angry. Mistakes always carry a shape or icon (✕, the angry face, a red tape
entry with ✕), never colour alone. Bids point up and asks point down and are hatched.

**Scoring.** 10 points per correct fill, times a combo multiplier that grows by ×1 every 4
correct fills (up to ×4). A market order that runs out of patience costs 10 points. The fairness
meter is the share of fills that took the oldest chip at the best price. Stars: 1 for finishing,
1 for at least 90% fairness with at most one missed order, 1 for the level's score target.

**Controls.** Tap or click a chip. Space or Enter fills by the rule at the best price. Keys
`1` `2` `3` fill from a lane (1 is the best price). `P` or `Esc` pauses, and the game pauses
when the tab is hidden. Sound is synthesized (no files) and has a mute button. "How it works"
starts collapsed. Animations follow `prefers-reduced-motion`. Tested at 1366×820 and 375×812.

## How it is built

```
src/engine/            pure TypeScript, no React or DOM
  queue.ts             OrderQueue: doubly linked list, O(1) enqueue / dequeue / peek
  line.ts              Line: OrderQueue plus removeWhere() (a queue jump, O(n))
  levels.ts            level settings and scriptFor(): the seeded order sequence
  rng.ts               Mulberry32 seeded random numbers
  match.ts             Match: the game as a simulation. advance(t) runs the clock
                       (limit arrivals, market arrivals, patience); tap(t, lane, chip)
                       fills. Every tap goes into an input log and every change into an
                       event log. replay() rebuilds a game from its inputs; autoplay()
                       runs the FIFO/LIFO comparison.
  match.test.ts        Vitest: FIFO order, queue jumps, partial fills, multi-lane
                       price-time priority, LIFO vs FIFO on identical orders, replay
  orderBook.ts         the original Version 1 order book engine (still tested)
  session.ts           Version 1's event-log cursor
  engine.test.ts       Vitest for the Version 1 engine
src/game/              React UI
  Game.tsx             screens: menu, intro, play, summary, reveal, compare
  Play.tsx             game clock, frame loop, keyboard, HUD
  Board.tsx            lanes, chips, head/tail markers, market order, op tags, tape
  art/Trader.tsx       trader portraits drawn in SVG, three moods
  sound.ts             Web Audio cues
```

The game is deterministic: orders come from a seeded script, and every tap is logged with its
game-clock time, so `replay(level, inputs)` rebuilds exactly the same game and event log.

Stack: Vite 8, React 19, TypeScript, Tailwind CSS 4, Motion, Lucide icons, Vitest, and
self-hosted fonts via Fontsource.

## Design

A sunny trading-pit board on apricot paper. Bids are teal and point up; asks are coral, point
down and are hatched. Plum is the ink (never black) and gold marks the chip the rule fills next.
Fonts: Lilita One for prices and numbers, like a painted board; Atkinson Hyperlegible Next for
the few small words; JetBrains Mono only for the code tags (`enqueue O(1)`). All art is ours, in
SVG and CSS. There are no bank or brand logos anywhere; traders have first names only.

Design skills used (copied into `.claude/skills/`):
- **frontend-design:** the palette and type plan, one bold element (the board), sentence case,
  almost no text.
- **web-design-guidelines:** audited `src/game`. Fixes made: a heading on the play screen, hover
  feedback on chips, overscroll only with a mouse, `translate="no"` on code tags, autofocus only
  with a mouse, visible focus rings, tabular numbers.
- **ui-ux-pro-max** and **taste-skill:** used as checklists for touch targets and
  anti-template rules.

From **kokonutui**, the summary screen borrows the torn-paper look of its receipt component; we
drew our own simple version in CSS.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: both engines
npm run build      # type-check + production build into dist/
```

## Deploy

The Vercel project is linked to this repository with the Vite preset (build `npm run build`,
output `dist`). Every push to `main` deploys to production. `vercel.json` redirects the old
`/v1` paths to `/`. No project settings or domains were changed.

A manual GitHub Pages workflow is also in `.github/workflows`; it builds with
`BASE_PATH=/<repo-name>/`.

## History

- **Version 1**, an interactive 3D order book (tag `v1`, branch `v1-archive`).
- **Version 2**, *Food Truck Rush*, a food-truck game about FIFO lines.
- **Match the Book** (this version) replaces both on the live site. The state right before the
  rework is tagged `v1-before-game`. Check out any tag to run an older version.

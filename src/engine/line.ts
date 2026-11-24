import { OrderQueue } from './queue'

/**
 * One price level's queue in the game: the linked-list OrderQueue
 * (O(1) enqueue at the tail, O(1) dequeue at the head) plus one extra,
 * taking an order out of the middle, which is what a queue jump costs.
 * A queue has no shortcut for that, so it takes O(n): every order is walked
 * through once and put back in the same order.
 */
export class Line<T> extends OrderQueue<T> {
  /** Remove the first item matching `pred`. O(n). Returns it, if found. */
  removeWhere(pred: (v: T) => boolean): T | undefined {
    let found: T | undefined
    const n = this.size
    for (let i = 0; i < n; i++) {
      const v = this.dequeue() as T
      if (found === undefined && pred(v)) found = v
      else this.enqueue(v)
    }
    return found
  }
}

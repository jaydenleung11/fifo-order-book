import { OrderQueue } from '@/engine/queue'

/**
 * The line at a food-truck window. It is Version 1's linked-list queue
 * (O(1) enqueue at the back, O(1) dequeue at the front) plus one extra:
 * removing someone from the middle, which is what "cutting the line" costs.
 * A queue has no shortcut for that, so it takes O(n): everyone is walked
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

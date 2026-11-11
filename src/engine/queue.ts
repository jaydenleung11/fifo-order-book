/**
 * A queue built from a doubly linked list.
 *
 *   HEAD (oldest)                        TAIL (newest)
 *   [ a ] <-> [ b ] <-> [ c ] <-> [ d ]
 *
 * enqueue()  adds at the tail     O(1)
 * dequeue()  removes the head     O(1)
 * peek()     reads the head       O(1)
 *
 * popTail() / peekTail() exist only so the visualization can show what
 * happens under LIFO (taking from the tail turns the queue into a stack).
 * A real exchange never uses them for matching.
 */
class Node<T> {
  value: T
  prev: Node<T> | null = null
  next: Node<T> | null = null
  constructor(value: T) {
    this.value = value
  }
}

export class OrderQueue<T> implements Iterable<T> {
  private head: Node<T> | null = null
  private tail: Node<T> | null = null
  private count = 0

  get size(): number {
    return this.count
  }

  isEmpty(): boolean {
    return this.count === 0
  }

  /** Add at the tail. O(1). */
  enqueue(value: T): void {
    const node = new Node(value)
    if (this.tail === null) {
      this.head = node
      this.tail = node
    } else {
      node.prev = this.tail
      this.tail.next = node
      this.tail = node
    }
    this.count++
  }

  /** Remove and return the head (the oldest item). O(1). */
  dequeue(): T | undefined {
    const node = this.head
    if (node === null) return undefined
    this.head = node.next
    if (this.head === null) this.tail = null
    else this.head.prev = null
    this.count--
    return node.value
  }

  /** Remove and return the tail (the newest item). O(1). LIFO demo only. */
  popTail(): T | undefined {
    const node = this.tail
    if (node === null) return undefined
    this.tail = node.prev
    if (this.tail === null) this.head = null
    else this.tail.next = null
    this.count--
    return node.value
  }

  peek(): T | undefined {
    return this.head?.value
  }

  peekTail(): T | undefined {
    return this.tail?.value
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let n = this.head; n !== null; n = n.next) yield n.value
  }

  /** Items from head to tail. O(n); used for snapshots, never for matching. */
  toArray(): T[] {
    return Array.from(this)
  }

  map<U>(fn: (value: T) => U): OrderQueue<U> {
    const out = new OrderQueue<U>()
    for (const v of this) out.enqueue(fn(v))
    return out
  }
}

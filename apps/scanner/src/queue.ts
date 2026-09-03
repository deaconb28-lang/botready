/**
 * A concurrency gate, in process. Not a job queue: QStash is the queue and it
 * owns retries. This only stops the worker from opening five browsers at once
 * on a box with 512 MB of memory.
 *
 * Deduplicating on scan id matters for the nightly index run, where a retry can
 * arrive while the first delivery is still working.
 */

import { env } from './env';

export class ConcurrencyGate {
  readonly limit: number;
  /** Accepted work, keyed by scan id, whether or not it holds a slot yet. */
  #accepted = new Map<string, Promise<void>>();
  /** Work that holds a slot right now. */
  #running = 0;
  #waiters: Array<() => void> = [];

  constructor(limit: number) {
    this.limit = Math.max(1, limit);
  }

  /** Scans actually executing. */
  get inFlight(): number {
    return this.#running;
  }

  /** Scans accepted and waiting for a slot. */
  get waiting(): number {
    return this.#waiters.length;
  }

  /**
   * Runs `work` when a slot frees up. A second call with a key already accepted
   * joins the first rather than starting a duplicate scan.
   */
  run(key: string, work: () => Promise<void>): Promise<void> {
    const existing = this.#accepted.get(key);
    if (existing) return existing;

    const task = (async () => {
      await this.#acquire();
      try {
        await work();
      } finally {
        this.#running -= 1;
        this.#accepted.delete(key);
        this.#wake();
      }
    })();

    this.#accepted.set(key, task);
    return task;
  }

  async #acquire(): Promise<void> {
    if (this.#running < this.limit) {
      this.#running += 1;
      return;
    }
    await new Promise<void>((resolve) => this.#waiters.push(resolve));
    this.#running += 1;
  }

  #wake(): void {
    const next = this.#waiters.shift();
    if (next) next();
  }

  /** Wait for everything accepted, up to a deadline. Used on SIGTERM. */
  async drain(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.#accepted.size > 0 && Date.now() < deadline) {
      await Promise.race([
        Promise.allSettled([...this.#accepted.values()]),
        new Promise((resolve) => setTimeout(resolve, 250)),
      ]);
    }
  }
}

export const queue = new ConcurrencyGate(env.concurrency);

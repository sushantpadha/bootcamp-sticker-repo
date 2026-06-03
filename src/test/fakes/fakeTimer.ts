import type { Timer, TimerHandle } from '../../app/ports/timer';

interface Pending {
  fireAt: number;
  cb: () => void;
}

// Deterministic Timer fake. Tests call advance(ms) to fire callbacks.
// Honors the Timer port contract: setTimeout schedules; clearTimeout cancels.
export class FakeTimer implements Timer {
  private nowMs = 0;
  private nextHandle = 1;
  private readonly pending = new Map<number, Pending>();

  setTimeout(cb: () => void, ms: number): TimerHandle {
    const handle = this.nextHandle++;
    this.pending.set(handle, { fireAt: this.nowMs + ms, cb });
    return handle;
  }

  clearTimeout(h: TimerHandle): void {
    if (typeof h === 'number') this.pending.delete(h);
  }

  // Advance fake time by `ms`. Fires all callbacks whose fireAt <= new time
  // in insertion order. Newly-scheduled callbacks during firing are included
  // if their fireAt also falls within the new time.
  advance(ms: number): void {
    const target = this.nowMs + ms;
    // Loop because callbacks may schedule more timers.
    for (;;) {
      const due = [...this.pending.entries()]
        .filter(([, p]) => p.fireAt <= target)
        .sort(([, a], [, b]) => a.fireAt - b.fireAt);
      if (due.length === 0) break;
      for (const [handle, p] of due) {
        if (!this.pending.has(handle)) continue; // cleared during a previous fire
        this.nowMs = p.fireAt;
        this.pending.delete(handle);
        p.cb();
      }
    }
    this.nowMs = target;
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}

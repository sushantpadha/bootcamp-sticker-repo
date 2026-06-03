import type { Timer, TimerHandle } from '../ports/timer';

// Single 2-second flash timer (STATE.md §Flash scheduling).
// Setting a new flash replaces any current one and resets the timer.
// Timer-driven (NOT raw setTimeout) so tests can advance deterministically.
export class FlashScheduler {
  private handle: TimerHandle | null = null;
  private readonly timer: Timer;

  constructor(timer: Timer) {
    this.timer = timer;
  }

  schedule(ms: number, onClear: () => void): void {
    if (this.handle !== null) this.timer.clearTimeout(this.handle);
    this.handle = this.timer.setTimeout(() => {
      this.handle = null;
      onClear();
    }, ms);
  }

  cancel(): void {
    if (this.handle !== null) {
      this.timer.clearTimeout(this.handle);
      this.handle = null;
    }
  }
}

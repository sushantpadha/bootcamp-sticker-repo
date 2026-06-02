// Manages the single 2-second flash timer (STATE.md §Flash scheduling).
// Setting a new flash replaces any current one and resets the timer.
// Flash is orthogonal to mode transitions — the scheduler has no awareness of modes.
export class FlashScheduler {
  private timerId: ReturnType<typeof setTimeout> | null = null;

  // Schedule onClear to fire after `ms` milliseconds.
  // Cancels any previously pending timer before scheduling the new one.
  schedule(ms: number, onClear: () => void): void {
    if (this.timerId !== null) clearTimeout(this.timerId);
    this.timerId = setTimeout(() => {
      this.timerId = null;
      onClear();
    }, ms);
  }

  cancel(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}

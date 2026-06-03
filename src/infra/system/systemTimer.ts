import type { Timer, TimerHandle } from '../../app/ports/timer';

// Production Timer adapter — wraps globalThis.setTimeout / clearTimeout.
// This is the only place in the app that may call these globals directly
// (ARCHITECTURE.md composition-root rule).
export class SystemTimer implements Timer {
  setTimeout(cb: () => void, ms: number): TimerHandle {
    return globalThis.setTimeout(cb, ms);
  }

  clearTimeout(h: TimerHandle): void {
    globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>);
  }
}

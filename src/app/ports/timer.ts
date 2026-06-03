// Abstraction over globalThis.setTimeout / clearTimeout so flash scheduling
// and NormalMode's gg/digit-buffer timers can be controlled in tests.
//
// [LSP] setTimeout MUST schedule the callback to fire after `ms` ms of
//       wall-clock time (real impl) or fake time (FakeTimer.advance).
//       clearTimeout MUST cancel a pending callback; calling it on an
//       already-fired/cleared handle is a no-op.

export type TimerHandle = number | object;

export interface Timer {
  setTimeout(cb: () => void, ms: number): TimerHandle;
  clearTimeout(h: TimerHandle): void;
}

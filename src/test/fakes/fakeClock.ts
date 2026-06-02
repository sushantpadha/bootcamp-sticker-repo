import type { Clock } from '../../app/ports/clock';

export class FakeClock implements Clock {
  private time: number;

  constructor(time = 0) {
    this.time = time;
  }

  now(): number {
    return this.time;
  }

  // Advance the clock by the given number of milliseconds.
  advance(ms: number): void {
    this.time += ms;
  }

  // Set the clock to an absolute timestamp.
  set(ms: number): void {
    this.time = ms;
  }
}

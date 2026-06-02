import type { Clock } from '../../app/ports/clock';

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

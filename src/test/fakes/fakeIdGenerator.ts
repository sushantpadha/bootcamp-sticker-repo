import type { IdGenerator } from '../../app/ports/idGenerator';

export class FakeIdGenerator implements IdGenerator {
  private counter = 0;

  // Returns deterministic IDs of the form "id-1", "id-2", … for tests.
  uuid(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }

  // Reset the counter (useful between test cases).
  reset(): void {
    this.counter = 0;
  }
}

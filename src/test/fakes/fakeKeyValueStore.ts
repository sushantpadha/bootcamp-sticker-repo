import type { KeyValueStore } from '../../app/ports/keyValueStore';

export class FakeKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  get(k: string): string | null {
    return this.data.get(k) ?? null;
  }

  set(k: string, v: string): void {
    this.data.set(k, v);
  }
}

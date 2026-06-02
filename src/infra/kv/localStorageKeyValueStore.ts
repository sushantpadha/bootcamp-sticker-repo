import type { KeyValueStore } from '../../app/ports/keyValueStore';

export class LocalStorageKeyValueStore implements KeyValueStore {
  get(k: string): string | null {
    return localStorage.getItem(k);
  }

  set(k: string, v: string): void {
    localStorage.setItem(k, v);
  }
}

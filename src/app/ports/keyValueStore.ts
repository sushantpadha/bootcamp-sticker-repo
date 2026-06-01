// Synchronous key–value store for lightweight persistence (e.g. theme preference).
// [LSP] get returns null for missing keys (not undefined, not throws).
//       set throws on write failure; never silently drops.
export interface KeyValueStore {
  get(k: string): string | null;
  set(k: string, v: string): void;
}

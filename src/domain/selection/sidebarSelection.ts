import type { Sticker } from '../entities/sticker';

// [LSP] Only the genuinely common behaviour of All/Pack/Ungrouped rows is in the
// supertype: a stable key, a label, and a grid predicate. Rename/delete/persist are
// intentionally absent — not every selection can honour them (see DOMAIN.md §SidebarSelection).
export interface SidebarSelection {
  readonly key: string;   // "all" | "pack:<id>" | "ungrouped"
  label(): string;
  matches(s: Sticker): boolean;
}

export class AllSelection implements SidebarSelection {
  readonly key = 'all';
  label(): string { return 'All'; }
  matches(_s: Sticker): boolean { return true; }
}

export class PackSelection implements SidebarSelection {
  readonly key: string;
  constructor(private readonly packId: string, private readonly packName: string) {
    this.key = `pack:${packId}`;
  }
  label(): string { return this.packName; }
  matches(s: Sticker): boolean { return s.packIds.includes(this.packId); }
  get id(): string { return this.packId; }
}

export class UngroupedSelection implements SidebarSelection {
  readonly key = 'ungrouped';
  label(): string { return '(ungrouped)'; }
  matches(s: Sticker): boolean { return s.packIds.length === 0; }
}

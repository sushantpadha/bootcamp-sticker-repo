import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import type { SidebarSelection } from '../../domain/selection/sidebarSelection';
import type { StickerSort } from '../../domain/sort/stickerSort';
import type { StickerCandidate } from '../../domain/values/stickerCandidate';
import type { ModeName } from '../../domain/values/modeName';
import { buildSearchPredicate } from '../../domain/search/searchPredicate';

export interface Flash {
  text: string;
  isError: boolean;
}

export interface QueuedSticker {
  candidate: StickerCandidate;
  name: string;      // prefilled from candidate.defaultName
  tags: string[];
  packNames: string[]; // resolved to packIds on save
}

export interface AppState {
  // in-memory source of truth loaded from IDB
  stickers: Sticker[];
  packs: Pack[];

  // view controls — ephemeral (decision D)
  selection: SidebarSelection;
  sort: StickerSort;
  search: string;

  // focus by identity (decision E)
  focusId: string | null;

  // mode / input
  modeName: ModeName;
  statusInput: string;

  // transient
  uploadQueue: QueuedSticker[];
  flash: Flash | null;
  theme: 'dark' | 'light';
}

// ── Derived values — computed fresh each render, never stored ──────────────────

export function computeVisibleGrid(state: AppState): Sticker[] {
  const searchPred = buildSearchPredicate(state.search);
  return [...state.stickers]
    .filter(s => state.selection.matches(s) && searchPred(s))
    .sort((a, b) => state.sort.compare(a, b));
}

export function computeFocusIndex(focusId: string | null, grid: Sticker[]): number {
  if (focusId === null) return -1;
  return grid.findIndex(s => s.id === focusId);
}

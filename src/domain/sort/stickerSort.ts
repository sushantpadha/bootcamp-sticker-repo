import type { Sticker } from '../entities/sticker';

// [LSP] compare MUST be a strict weak ordering with a stable id tie-breaker so that
// focus-by-id stays stable when sort is swapped (STATE.md decision E).
export interface StickerSort {
  readonly id: 'recent' | 'added' | 'name';
  compare(a: Sticker, b: Sticker): number;
}

function byId(a: Sticker, b: Sticker): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export const RecentSort: StickerSort = {
  id: 'recent',
  compare(a, b) {
    const d = b.lastUsedAt - a.lastUsedAt;
    return d !== 0 ? d : byId(a, b);
  },
};

export const AddedSort: StickerSort = {
  id: 'added',
  compare(a, b) {
    const d = b.createdAt - a.createdAt;
    return d !== 0 ? d : byId(a, b);
  },
};

export const NameSort: StickerSort = {
  id: 'name',
  compare(a, b) {
    const d = a.name.localeCompare(b.name);
    return d !== 0 ? d : byId(a, b);
  },
};

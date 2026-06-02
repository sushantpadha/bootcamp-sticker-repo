import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import type { SidebarSelection } from '../../domain/selection/sidebarSelection';
import type { StickerSort } from '../../domain/sort/stickerSort';
import type { StickerCandidate } from '../upload/stickerCandidate';
import type { ModeName } from '../../domain/values/modeName';
import {
  AllSelection,
  PackSelection,
  UngroupedSelection,
} from '../../domain/selection/sidebarSelection';
import { type AppState, computeVisibleGrid, type QueuedSticker } from './appState';

export type FocusDir = 'up' | 'down' | 'left' | 'right' | 'first' | 'last' | 'rowStart' | 'rowEnd';

// ── Public Intent union (STATE.md §Intent catalog) ────────────────────────────
// Dispatchable by modes, services, UI. The engine also produces internal
// changes (see EngineInternalChange below) but those are not exported.
export type Intent =
  | { type: 'loadAll'; stickers: Sticker[]; packs: Pack[] }

  // Focus
  | { type: 'moveFocus'; id: string | null }
  | { type: 'moveFocusDir'; dir: FocusDir; cols: number }
  | { type: 'searchNext' }
  | { type: 'searchPrev' }

  // Sidebar / view controls
  | { type: 'setSelection'; selection: SidebarSelection }
  | { type: 'cycleSelection'; delta: 1 | -1 }
  | { type: 'jumpToPack'; index: number }   // 1-indexed; clamps to last real pack
  | { type: 'setSort'; sort: StickerSort }
  | { type: 'setSearch'; query: string }
  | { type: 'setGridCols'; cols: number }

  // Upload queue
  | { type: 'enqueueCandidates'; candidates: StickerCandidate[] }
  | { type: 'editQueueRow'; index: number; patch: Partial<Pick<QueuedSticker, 'name' | 'tags' | 'packNames'>> }
  | { type: 'removeQueueRow'; index: number }

  // Persistence triggers (IDB-touching — engine routes to services)
  | { type: 'yankFocused' }
  | { type: 'saveUpload' }
  | { type: 'deleteFocused' }
  | { type: 'renameFocused'; name: string }
  | { type: 'setTags'; tags: string[] }
  | { type: 'assignPacks'; packNames: string[] }
  | { type: 'toggleFavourite' }

  // Theme (persists via KeyValueStore)
  | { type: 'setTheme'; theme: 'dark' | 'light' }

  // Mode / input
  | { type: 'setStatusInput'; value: string }
  | { type: 'transitionMode'; modeName: ModeName }

  // Flash (public emit — only `clear` is internal)
  | { type: 'flash'; text: string; isError: boolean };

// ── Engine-internal change union ──────────────────────────────────────────────
// NOT exported. Only the engine produces these (after async service results).
export type EngineInternalChange =
  | { type: 'applySticker'; sticker: Sticker }
  | { type: 'applyStickers'; stickers: Sticker[] }
  | { type: 'removeSticker'; id: string }
  | { type: 'applyPack'; pack: Pack }
  | { type: 'removePack'; id: string }
  | { type: 'clearFlash' }
  | { type: 'clearUploadQueue' };

// Union of everything the reducer can process. Engine treats them uniformly.
export type AnyChange = Intent | EngineInternalChange;

// ── Pure reducer ───────────────────────────────────────────────────────────────

export function reduce(state: AppState, change: AnyChange): AppState {
  switch (change.type) {
    case 'loadAll': {
      const grid = computeVisibleGridFrom(change.stickers, state);
      const focusId = change.stickers.length > 0
        ? (change.stickers.find(s => s.id === state.focusId)
            ? state.focusId
            : grid[0]?.id ?? null)
        : null;
      return { ...state, stickers: change.stickers, packs: change.packs, focusId };
    }

    case 'moveFocus':
      return state.focusId === change.id ? state : { ...state, focusId: change.id };

    case 'moveFocusDir': {
      const grid = computeVisibleGrid(state);
      if (grid.length === 0) return state;
      const cur = state.focusId ? grid.findIndex(s => s.id === state.focusId) : -1;
      const safe = cur < 0 ? 0 : cur;
      const cols = Math.max(1, change.cols);
      const rowStart = Math.floor(safe / cols) * cols;
      const rowEnd = Math.min(rowStart + cols - 1, grid.length - 1);
      let next: number;
      switch (change.dir) {
        case 'first': next = 0; break;
        case 'last':  next = grid.length - 1; break;
        case 'rowStart': next = rowStart; break;
        case 'rowEnd':   next = rowEnd; break;
        case 'left': {
          // Wrap to previous row's last cell on col 0
          next = safe === 0 ? grid.length - 1 : safe - 1;
          break;
        }
        case 'right': {
          // Wrap to next row's first cell on last grid cell
          next = safe === grid.length - 1 ? 0 : safe + 1;
          break;
        }
        case 'up':   next = safe - cols < 0 ? safe : safe - cols; break;
        case 'down': next = safe + cols > grid.length - 1 ? safe : safe + cols; break;
      }
      const id = grid[next].id;
      return state.focusId === id ? state : { ...state, focusId: id };
    }

    case 'searchNext':
    case 'searchPrev': {
      if (state.search === '') return state;
      const grid = computeVisibleGrid(state);
      if (grid.length === 0) return state;
      const cur = state.focusId ? grid.findIndex(s => s.id === state.focusId) : -1;
      const delta = change.type === 'searchNext' ? 1 : -1;
      const safe = cur < 0 ? (delta === 1 ? -1 : 0) : cur;
      const next = ((safe + delta) % grid.length + grid.length) % grid.length;
      const id = grid[next].id;
      return state.focusId === id ? state : { ...state, focusId: id };
    }

    case 'setSelection': {
      const grid = computeVisibleGridWith(state, { selection: change.selection });
      const focusId = clampFocus(state.focusId, grid);
      return { ...state, selection: change.selection, focusId };
    }

    case 'cycleSelection': {
      const options = buildSelectionRing(state);
      const cur = options.findIndex(o => o.key === state.selection.key);
      const next = (cur < 0 ? 0 : cur) + change.delta;
      const selection = options[(next + options.length) % options.length];
      const grid = computeVisibleGridWith(state, { selection });
      return { ...state, selection, focusId: clampFocus(state.focusId, grid) };
    }

    case 'jumpToPack': {
      // 1-indexed; index 1 = first real pack. Out-of-range clamps to last pack.
      if (state.packs.length === 0) return state;
      const i = Math.max(1, Math.min(change.index, state.packs.length)) - 1;
      const pack = state.packs[i];
      const selection = new PackSelection(pack.id, pack.name);
      const grid = computeVisibleGridWith(state, { selection });
      return { ...state, selection, focusId: clampFocus(state.focusId, grid) };
    }

    case 'setSort': {
      // focusId is by id so it survives sort changes without adjustment
      return state.sort.id === change.sort.id ? state : { ...state, sort: change.sort };
    }

    case 'setSearch': {
      const grid = computeVisibleGridWith(state, { search: change.query });
      return {
        ...state,
        search: change.query,
        focusId: clampFocus(state.focusId, grid),
      };
    }

    case 'setGridCols': {
      const cols = Math.max(1, change.cols);
      return state.gridCols === cols ? state : { ...state, gridCols: cols };
    }

    case 'enqueueCandidates': {
      const newRows: QueuedSticker[] = change.candidates.map(c => ({
        candidate: c,
        name: c.defaultName,
        tags: [],
        packNames: [],
      }));
      return { ...state, uploadQueue: [...state.uploadQueue, ...newRows] };
    }

    case 'editQueueRow': {
      const { index, patch } = change;
      if (index < 0 || index >= state.uploadQueue.length) return state;
      const row = state.uploadQueue[index];
      const updated = { ...row, ...patch };
      const queue = state.uploadQueue.map((r, i) => i === index ? updated : r);
      return { ...state, uploadQueue: queue };
    }

    case 'removeQueueRow': {
      if (change.index < 0 || change.index >= state.uploadQueue.length) return state;
      const queue = state.uploadQueue.filter((_, i) => i !== change.index);
      return { ...state, uploadQueue: queue };
    }

    // IDB-touching intents — handled asynchronously in engine.ts; reducer is a no-op.
    case 'yankFocused':
    case 'saveUpload':
    case 'deleteFocused':
    case 'renameFocused':
    case 'setTags':
    case 'assignPacks':
    case 'toggleFavourite':
      return state;

    case 'applySticker': {
      const exists = state.stickers.findIndex(s => s.id === change.sticker.id);
      const stickers = exists >= 0
        ? state.stickers.map(s => s.id === change.sticker.id ? change.sticker : s)
        : [...state.stickers, change.sticker];
      return { ...state, stickers };
    }

    case 'applyStickers': {
      const incoming = new Map(change.stickers.map(s => [s.id, s]));
      const merged = state.stickers.map(s => incoming.get(s.id) ?? s);
      for (const s of change.stickers) {
        if (!state.stickers.find(e => e.id === s.id)) merged.push(s);
      }
      return { ...state, stickers: merged };
    }

    case 'removeSticker': {
      const stickers = state.stickers.filter(s => s.id !== change.id);
      const focusId = state.focusId === change.id
        ? clampFocus(state.focusId, computeVisibleGridFrom(stickers, state))
        : state.focusId;
      return { ...state, stickers, focusId };
    }

    case 'applyPack': {
      const exists = state.packs.findIndex(p => p.id === change.pack.id);
      const packs = exists >= 0
        ? state.packs.map(p => p.id === change.pack.id ? change.pack : p)
        : [...state.packs, change.pack];
      return { ...state, packs };
    }

    case 'removePack': {
      const packs = state.packs.filter(p => p.id !== change.id);
      // Strip the deleted packId from any sticker that referenced it.
      const stickers = state.stickers.map(s =>
        s.packIds.includes(change.id)
          ? { ...s, packIds: s.packIds.filter(id => id !== change.id) }
          : s,
      );
      const selection = state.selection.key === `pack:${change.id}`
        ? new AllSelection()
        : state.selection;
      return { ...state, packs, stickers, selection };
    }

    case 'setTheme':
      return state.theme === change.theme ? state : { ...state, theme: change.theme };

    case 'setStatusInput':
      return state.statusInput === change.value ? state : { ...state, statusInput: change.value };

    case 'transitionMode':
      return state.modeName === change.modeName ? state : { ...state, modeName: change.modeName };

    case 'flash':
      return { ...state, flash: { text: change.text, isError: change.isError } };

    case 'clearFlash':
      return state.flash === null ? state : { ...state, flash: null };

    case 'clearUploadQueue':
      return state.uploadQueue.length === 0 ? state : { ...state, uploadQueue: [] };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeVisibleGridFrom(stickers: Sticker[], state: AppState): Sticker[] {
  return computeVisibleGrid({ ...state, stickers });
}

function computeVisibleGridWith(state: AppState, overrides: Partial<AppState>): Sticker[] {
  return computeVisibleGrid({ ...state, ...overrides });
}

// Sidebar cycle order: All → packs (in state.packs order) → Ungrouped → All
function buildSelectionRing(state: AppState): SidebarSelection[] {
  return [
    new AllSelection(),
    ...state.packs.map(p => new PackSelection(p.id, p.name)),
    new UngroupedSelection(),
  ];
}

// If focusId still in the new grid, keep it; otherwise take the first item.
function clampFocus(focusId: string | null, grid: Sticker[]): string | null {
  if (focusId !== null && grid.some(s => s.id === focusId)) return focusId;
  return grid[0]?.id ?? null;
}

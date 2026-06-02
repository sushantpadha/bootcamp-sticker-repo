import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import type { SidebarSelection } from '../../domain/selection/sidebarSelection';
import type { StickerSort } from '../../domain/sort/stickerSort';
import type { StickerCandidate } from '../../domain/values/stickerCandidate';
import type { ModeName } from '../../domain/values/modeName';
import {
  AllSelection,
  PackSelection,
  UngroupedSelection,
} from '../../domain/selection/sidebarSelection';
import { AppState, computeVisibleGrid, QueuedSticker } from './appState';

// Direction for grid navigation; cols is the number of grid columns at dispatch time.
export type FocusDir = 'up' | 'down' | 'left' | 'right' | 'first' | 'last';

// ── Intent union (STATE.md §Intent catalog) ────────────────────────────────────
export type Intent =
  // Data load — applied after the async DB read completes outside the engine
  | { type: 'loadAll'; stickers: Sticker[]; packs: Pack[] }

  // Focus
  | { type: 'moveFocus'; id: string | null }
  | { type: 'moveFocusDir'; dir: FocusDir; cols: number }

  // Sidebar / view controls
  | { type: 'setSelection'; selection: SidebarSelection }
  | { type: 'cycleSelection'; delta: 1 | -1 }
  | { type: 'setSort'; sort: StickerSort }
  | { type: 'setSearch'; query: string }

  // Upload queue
  | { type: 'enqueueCandidates'; candidates: StickerCandidate[] }
  | { type: 'editQueueRow'; index: number; patch: Partial<Pick<QueuedSticker, 'name' | 'tags' | 'packNames'>> }
  | { type: 'removeQueueRow'; index: number }

  // Persistence (IDB-touching — wired to services in M8; stubs in M4)
  | { type: 'yankFocused' }
  | { type: 'saveUpload' }
  | { type: 'deleteFocused' }
  | { type: 'renameFocused'; name: string }
  | { type: 'setTags'; tags: string[] }
  | { type: 'assignPacks'; packNames: string[] }
  | { type: 'toggleFavourite' }

  // State updates produced by services after async IDB work
  | { type: 'applySticker'; sticker: Sticker }
  | { type: 'applyStickers'; stickers: Sticker[] }
  | { type: 'removeSticker'; id: string }
  | { type: 'applyPack'; pack: Pack }
  | { type: 'removePack'; id: string }

  // Theme (persists via KeyValueStore)
  | { type: 'setTheme'; theme: 'dark' | 'light' }

  // Mode / input
  | { type: 'setStatusInput'; value: string }
  | { type: 'transitionMode'; modeName: ModeName }

  // Flash
  | { type: 'flash'; text: string; isError: boolean }
  | { type: 'clearFlash' };

// ── Pure reducer ───────────────────────────────────────────────────────────────
// Returns the same reference when nothing changes so getSnapshot stays stable.

export function reduce(state: AppState, intent: Intent): AppState {
  switch (intent.type) {
    case 'loadAll': {
      const grid = computeVisibleGridFrom(intent.stickers, state);
      const focusId = intent.stickers.length > 0
        ? (intent.stickers.find(s => s.id === state.focusId)
            ? state.focusId
            : grid[0]?.id ?? null)
        : null;
      return { ...state, stickers: intent.stickers, packs: intent.packs, focusId };
    }

    case 'moveFocus':
      return state.focusId === intent.id ? state : { ...state, focusId: intent.id };

    case 'moveFocusDir': {
      const grid = computeVisibleGrid(state);
      if (grid.length === 0) return state;
      const cur = state.focusId ? grid.findIndex(s => s.id === state.focusId) : -1;
      const safe = cur < 0 ? 0 : cur;
      let next: number;
      switch (intent.dir) {
        case 'first': next = 0; break;
        case 'last':  next = grid.length - 1; break;
        case 'left':  next = Math.max(0, safe - 1); break;
        case 'right': next = Math.min(grid.length - 1, safe + 1); break;
        case 'up':    next = Math.max(0, safe - intent.cols); break;
        case 'down':  next = Math.min(grid.length - 1, safe + intent.cols); break;
      }
      const id = grid[next].id;
      return state.focusId === id ? state : { ...state, focusId: id };
    }

    case 'setSelection': {
      const grid = computeVisibleGridWith(state, { selection: intent.selection });
      const focusId = clampFocus(state.focusId, grid);
      return { ...state, selection: intent.selection, focusId };
    }

    case 'cycleSelection': {
      const options: SidebarSelection[] = [
        new AllSelection(),
        ...state.packs.map(p => new PackSelection(p.id, p.name)),
        new UngroupedSelection(),
      ];
      const cur = options.findIndex(o => o.key === state.selection.key);
      const next = (cur < 0 ? 0 : cur) + intent.delta;
      const selection = options[(next + options.length) % options.length];
      const grid = computeVisibleGridWith(state, { selection });
      return { ...state, selection, focusId: clampFocus(state.focusId, grid) };
    }

    case 'setSort': {
      // focusId is by id so it survives sort changes without adjustment
      return state.sort.id === intent.sort.id ? state : { ...state, sort: intent.sort };
    }

    case 'setSearch': {
      const grid = computeVisibleGridWith(state, { search: intent.query });
      return {
        ...state,
        search: intent.query,
        focusId: clampFocus(state.focusId, grid),
      };
    }

    case 'enqueueCandidates': {
      const newRows: QueuedSticker[] = intent.candidates.map(c => ({
        candidate: c,
        name: c.defaultName,
        tags: [],
        packNames: [],
      }));
      return { ...state, uploadQueue: [...state.uploadQueue, ...newRows] };
    }

    case 'editQueueRow': {
      const { index, patch } = intent;
      if (index < 0 || index >= state.uploadQueue.length) return state;
      const row = state.uploadQueue[index];
      const updated = { ...row, ...patch };
      const queue = state.uploadQueue.map((r, i) => i === index ? updated : r);
      return { ...state, uploadQueue: queue };
    }

    case 'removeQueueRow': {
      if (intent.index < 0 || intent.index >= state.uploadQueue.length) return state;
      const queue = state.uploadQueue.filter((_, i) => i !== intent.index);
      return { ...state, uploadQueue: queue };
    }

    // IDB-touching intents — handled asynchronously in engine.ts; reducer is a no-op.
    // The engine dispatches applySticker / removeSticker / flash after the async work.
    case 'yankFocused':
    case 'saveUpload':
    case 'deleteFocused':
    case 'renameFocused':
    case 'setTags':
    case 'assignPacks':
    case 'toggleFavourite':
      return state;

    case 'applySticker': {
      const exists = state.stickers.findIndex(s => s.id === intent.sticker.id);
      const stickers = exists >= 0
        ? state.stickers.map(s => s.id === intent.sticker.id ? intent.sticker : s)
        : [...state.stickers, intent.sticker];
      return { ...state, stickers };
    }

    case 'applyStickers': {
      const incoming = new Map(intent.stickers.map(s => [s.id, s]));
      const merged = state.stickers.map(s => incoming.get(s.id) ?? s);
      for (const s of intent.stickers) {
        if (!state.stickers.find(e => e.id === s.id)) merged.push(s);
      }
      return { ...state, stickers: merged };
    }

    case 'removeSticker': {
      const stickers = state.stickers.filter(s => s.id !== intent.id);
      const focusId = state.focusId === intent.id
        ? clampFocus(state.focusId, computeVisibleGridFrom(stickers, state))
        : state.focusId;
      return { ...state, stickers, focusId };
    }

    case 'applyPack': {
      const exists = state.packs.findIndex(p => p.id === intent.pack.id);
      const packs = exists >= 0
        ? state.packs.map(p => p.id === intent.pack.id ? intent.pack : p)
        : [...state.packs, intent.pack];
      return { ...state, packs };
    }

    case 'removePack': {
      const packs = state.packs.filter(p => p.id !== intent.id);
      // If the removed pack was selected, fall back to AllSelection
      const selection = state.selection.key === `pack:${intent.id}`
        ? new AllSelection()
        : state.selection;
      return { ...state, packs, selection };
    }

    case 'setTheme':
      return state.theme === intent.theme ? state : { ...state, theme: intent.theme };

    case 'setStatusInput':
      return state.statusInput === intent.value ? state : { ...state, statusInput: intent.value };

    case 'transitionMode':
      return state.modeName === intent.modeName ? state : { ...state, modeName: intent.modeName };

    // flash and clearFlash are handled in engine.ts (need the timer side-effect);
    // these cases are unreachable from reduce() but kept for exhaustiveness.
    case 'flash':
      return { ...state, flash: { text: intent.text, isError: intent.isError } };

    case 'clearFlash':
      return state.flash === null ? state : { ...state, flash: null };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeVisibleGridFrom(stickers: Sticker[], state: AppState): Sticker[] {
  const overridden: AppState = { ...state, stickers };
  return computeVisibleGrid(overridden);
}

function computeVisibleGridWith(state: AppState, overrides: Partial<AppState>): Sticker[] {
  return computeVisibleGrid({ ...state, ...overrides });
}

// If focusId is still in the new grid keep it; otherwise take the first item.
function clampFocus(focusId: string | null, grid: Sticker[]): string | null {
  if (focusId !== null && grid.some(s => s.id === focusId)) return focusId;
  return grid[0]?.id ?? null;
}

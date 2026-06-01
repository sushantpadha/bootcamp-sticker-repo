# STATE

Authoritative for: the AppState snapshot, what is stored vs derived, the
React-facing engine surface, the intent catalog, and flash timing. Mode-facing
engine APIs are in MODES.md; entity and view-type shapes are in DOMAIN.md.

## AppState snapshot

Immutable. Every mutation produces a new top-level object (new reference) so React
can detect change by identity. Referenced types (`Sticker`, `Pack`,
`SidebarSelection`, `StickerSort`, `StickerCandidate`) are defined in DOMAIN.md;
`ModeName` and `StatuslineModel` in MODES.md.

interface AppState {
  // ── loaded from IDB into memory (the in-memory source of truth) ──
  stickers: Sticker[];          // full snapshot; the grid is derived from this
  packs: Pack[];                // real packs only — never All/Ungrouped

  // ── view controls (ephemeral — see decision D) ──
  selection: SidebarSelection;  // active sidebar selection; default AllSelection
  sort: StickerSort;            // active sort; default RecentSort
  search: string;               // query; "" means inactive

  // ── focus by identity (see decision E) ──
  focusId: string | null;       // focused sticker id; grid index is derived

  // ── mode / input ──
  modeName: ModeName;           // identity of the one active mode
  statusInput: string;          // engine-owned statusline buffer (contract in MODES.md)

  // ── transient ──
  uploadQueue: QueuedSticker[]; // only meaningful in UPLOAD mode
  flash: Flash | null;          // active flash, else null
  theme: 'dark' | 'light';      // mirrors <html> class; persistence below
}

interface QueuedSticker {       // one editable row in the upload modal
  candidate: StickerCandidate;  // source (see DOMAIN.md)
  name: string;                 // prefilled from candidate.defaultName
  tags: string[];
  packNames: string[];          // resolved to packIds on save
}

interface Flash { text: string; isError: boolean; }

NormalMode's `gg` / `[n]p` / digit buffers are **not** in this snapshot; they are
mode-internal (see MODES.md, decision H).

## Decision D — what persists

Only `theme` persists, via `KeyValueStore` (key `theme`, values `dark`|`light`;
applied as `theme-dark` / `theme-light` on `<html>`). On load: `selection` =
AllSelection, `sort` = RecentSort, `search` = "", `focusId` = first sticker in the
default view. `selection`, `sort`, and `search` are ephemeral and reset on reload.

## Stored vs derived (never store a derived value)

**Stored** (fields above): `stickers`, `packs`, `selection`, `sort`, `search`,
`focusId`, `modeName`, `statusInput`, `uploadQueue`, `flash`, `theme`.

**Derived on read, recomputed each render — never persisted as state:**

| Derived value | Computed from |
|---|---|
| Visible grid list | `stickers` filtered by `selection.matches` AND the search predicate (DOMAIN.md), then ordered by `sort.compare` |
| Focus index | `indexOf(focusId)` within the visible grid list |
| Pack count (per row) | count of `stickers` matching that selection's predicate |
| Search match count | length of the search-filtered set |
| `(ungrouped)` count | count of `stickers` with `packIds.length === 0` |

Selection + search compose with **AND**. Focus is stored by id (decision E) so that
swapping `sort` or `selection` never scrambles focus — this is what makes the
`StickerSort` strategy genuinely substitutable (see DOMAIN.md §StickerSort).

## Decision A — useSyncExternalStore contract

The engine is a framework-agnostic store. React reads it through
`useSyncExternalStore`; the engine has zero React imports. The React-facing surface:

interface EngineStore {
  getSnapshot(): AppState;          // returns the SAME reference until state changes;
                                    // a new object only on actual mutation (no tearing)
  subscribe(listener: () => void): () => void;  // returns unsubscribe
  dispatch(intent: Intent): void;   // the only mutation entry point for UI + modes
}

`ui/useEngine.ts` wraps `useSyncExternalStore(subscribe, getSnapshot)` and returns
`{ snapshot, dispatch }`. Components never hold derived values in their own state;
they recompute from `snapshot` per the table above.

## Intent catalog

`dispatch` accepts a closed `Intent` union. Handlers (`app/engine/intents.ts`) are
the only code that produces a new `AppState`. Names (params elided):

`loadAll`, `moveFocus(dir|target)`, `setSelection`, `cycleSelection(±1)`,
`setSort`, `setSearch`, `yankFocused`, `enqueueCandidates`, `editQueueRow`,
`removeQueueRow`, `saveUpload`, `deleteFocused`, `renameFocused`, `setTags`,
`assignPacks`, `toggleFavourite`, `setTheme`, `setStatusInput`, `flash`,
`transitionMode`.

Modes invoke these via the mode-facing engine handle (MODES.md). All IDB-touching
intents go through services (`app/services/**`) and surface failures as flashes
per IDB.md (decision J).

## Flash scheduling

- `flash` holds at most one active message. Setting a new flash **replaces** any
  current one and **resets** the single pending 2s timer (`Clock`-driven).
- On timer fire, `flash` is cleared to `null`; the statusline then reverts to
  whatever the active mode renders (MODES.md §6).
- Flash is **orthogonal to mode**: a mode transition neither clears nor extends an
  active flash. While a flash is live it overrides only the statusline's left label;
  the active mode still supplies `input`/`right` segments. A flash that fires after
  its origin mode has exited still displays for its full remaining duration.
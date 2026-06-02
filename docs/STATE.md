# STATE

Authoritative for: the AppState snapshot, what is stored vs derived, the
React-facing engine surface, the intent catalog, and flash timing. Mode-facing
engine APIs are in MODES.md; entity and view-type shapes are in DOMAIN.md.

## AppState snapshot

Immutable. Every mutation produces a new top-level object (new reference) so React
can detect change by identity. Referenced types (`Sticker`, `Pack`,
`SidebarSelection`, `StickerSort`, `StickerCandidate`) are defined in DOMAIN.md;
`ModeName` and `StatuslineModel` in MODES.md.

```
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

  // ── viewport feedback from UI (for 2-D nav) ──
  gridCols: number;             // current visible-grid column count; published
                                // by ui/Grid via ResizeObserver. Default 1.

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
```

NormalMode's `gg` / `[n]p` / digit buffers are **not** in this snapshot; they are
mode-internal (see MODES.md, decision H).

## Decision D — what persists

Only `theme` persists, via `KeyValueStore` (key `theme`, values `dark`|`light`;
applied as `theme-dark` / `theme-light` on `<html>`). On load: `selection` =
AllSelection, `sort` = RecentSort, `search` = "", `focusId` = first sticker in the
default view. `selection`, `sort`, and `search` are ephemeral and reset on reload.

## Decision E — focus-by-id (not by index)

`focusId: string | null` stores a sticker identity, not a grid index. The grid
position is **derived** (`indexOf(focusId)` within the visible grid list).
Invariant: when `sort` or `selection` changes, the focused sticker stays
focused — the index moves, the identity doesn't. This is what makes
`StickerSort` strategies LSP-substitutable (DOMAIN.md §StickerSort): a sort
swap could otherwise teleport focus to a different sticker, breaking user
expectation. Reducers that change the visible grid (`setSelection`,
`setSort`, `setSearch`, `loadAll`, `removeSticker`) MUST preserve `focusId`
if the sticker is still in the new visible grid; if not (e.g. a search
excludes it), `focusId` falls back to `grid[0]?.id ?? null`.

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

```
interface EngineStore {
  getSnapshot(): AppState;          // returns the SAME reference until state changes;
                                    // a new object only on actual mutation (no tearing)
  subscribe(listener: () => void): () => void;  // returns unsubscribe
  dispatch(intent: Intent): void;   // the only mutation entry point for UI + modes
}
```

`ui/useEngine.ts` wraps `useSyncExternalStore(subscribe, getSnapshot)` and returns
`{ snapshot, dispatch }`. Components never hold derived values in their own state;
they recompute from `snapshot` per the table above.

## Intent catalog

`dispatch` accepts a closed `Intent` union. Handlers (`app/engine/intents.ts`) are
the only code that produces a new `AppState`. Public intents (params elided):

`loadAll`, `moveFocus(id)`, `moveFocusDir(dir, cols)`, `setSelection`,
`cycleSelection(±1)`, `setSort`, `setSearch`, `setGridCols`, `yankFocused`,
`enqueueCandidates`, `editQueueRow`, `removeQueueRow`, `saveUpload`,
`deleteFocused`, `renameFocused`, `setTags`, `assignPacks`, `toggleFavourite`,
`setTheme`, `setStatusInput`, `flash`, `transitionMode`.

`moveFocus(id)` sets focus to a specific sticker id; `moveFocusDir(dir, cols)`
moves focus relatively in the grid (`up|down|left|right|first|last`) using
`cols` for 2-D semantics (UI publishes via `setGridCols` on resize).

**Engine-internal changes** (NOT part of the public Intent union; not
dispatchable from outside the engine): `applySticker`, `applyStickers`,
`removeSticker`, `applyPack`, `removePack`, `clearFlash`, `clearUploadQueue`.
The engine produces these after async service results; user-facing code uses
the public intents above only.

Modes invoke public intents via the mode-facing engine handle (MODES.md). All
IDB-touching intents go through services (`app/services/**`) and surface
failures as flashes per IDB.md (decision J).

## Flash strings catalog

These are the canonical user-facing strings for success and error flashes.
Inline literals at call sites (DECISIONS §18); this catalog is reference only.

| Trigger | Flash | Error? |
|---|---|---|
| Yank success | `yanked: <name>.<ext>` (ext via DOMAIN.md decision G) | no |
| Yank clipboard fail (download fallback) | `(no clipboard: downloading)` | no |
| Rename success | `renamed: <resolved-name>` | no |
| Toggle favourite on | `tagged: favourite` | no |
| Toggle favourite off | `untagged: favourite` | no |
| Upload save success | `added: <N> stickers` | no |
| Import success | `imported: <N> stickers, <M> packs (<K> skipped)` | no |
| Export start | `exporting...` | no |
| Export finish | `done: <N> stickers` | no |
| Sort change | `sort: <id>` | no |
| Theme change | `theme: <dark\|light>` | no |
| `:tag add foo` | `tagged: foo` | no |
| `:tag remove foo` | `untagged: foo` | no |
| `:tag rename old new` | `renamed tag "old" → "new" (<N> stickers)` | no |
| `:pack new <name>` | `pack "<name>" created` | no |
| `:pack rename <name>` | `pack renamed to "<name>"` | no |
| `:pack delete` | `pack "<name>" deleted (<M> stickers updated)` | no |
| `:pack move <name>` (created) | `moved to pack "<name>" (created)` | no |
| `:pack move <name>` (existed) | `moved to pack "<name>"` | no |
| `:pack move <name>` (already in) | `already in pack "<name>"` | no |
| Unknown command | `E492: Not an editor command: <input>` | yes |
| `:pack rename/delete` outside PackSelection | `E: no pack selected` | yes |
| `:pack new` collision | `E: pack "<name>" already exists` | yes |
| Service / IDB exception | `E: <error.message>` | yes |

No flash is emitted for: silent navigation, `t` tags edit (visible change is
its own confirmation), `d` delete after y (sticker disappearance is confirmation),
`m` packassign save (visible sidebar update is confirmation).

## Flash scheduling

- `flash` holds at most one active message. Setting a new flash **replaces** any
  current one and **resets** the single pending 2s timer (`Timer`-driven via
  the port in `app/ports/timer.ts`).
- On timer fire, the engine produces an internal `clearFlash` change; `flash`
  becomes `null`; the statusline reverts to whatever the active mode renders.
- Flash is **orthogonal to mode**: a mode transition neither clears nor extends an
  active flash. While a flash is live it overrides only the statusline's left label;
  the active mode still supplies `input`/`right` segments. A flash that fires after
  its origin mode has exited still displays for its full remaining duration.
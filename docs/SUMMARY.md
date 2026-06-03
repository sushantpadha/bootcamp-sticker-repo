# SUMMARY — Guided tour & usage guide

This document is two things stacked together:

1. **Part A — Architectural tour.** What the program is, how the layers are
   organized, how a keystroke becomes a pixel, where everything lives.
2. **Part B — User guide.** What every key and command does.

Both reflect the post-rebuild state on branch `ashwin` (commit `68bb1c2` and
later). REVIEW.md Part 4 has the rebuild changelog; DECISIONS.md has the
decisions that shaped it; SPEC.md is the product source of truth.

---

# Part A — Guided tour of the program

## A.0 What this program is

A single-page keyboard-driven sticker manager. Drop in PNG/GIF/WebP/APNG
images, organize them with packs and tags, find them with `/`-search, yank
to clipboard with `yy`, export the whole library as a zip. Everything is
controlled from the keyboard (vim-style); mouse interactions are
nice-to-have, not required.

Persistence: IndexedDB (browser-local). One DB, two stores: `stickers` and
`packs`. Image bytes live as `ArrayBuffer` (never `Blob`). Themes (terminal
green on black / GitHub Light) persist via localStorage.

## A.1 Layer architecture

```
                         ┌──────────────────────────────┐
                    UI   │ React: AppRoot, Grid,        │
                 (outer) │ Sidebar, Statusline,         │
                         │ overlays, KeyboardCapture    │
                         └─────────────┬────────────────┘
                                       │  reads snapshot
                                       │  dispatches intents
                         ┌─────────────▼────────────────┐
                Application │ Engine (store + Mode FSM),│
                            │ Commands, Intents,         │
                            │ Services (yank/pack/tag/   │
                            │ export/import), Upload     │
                         └─────────────┬────────────────┘
                                       │  depends on port
                                       │  interfaces only
                         ┌─────────────▼────────────────┐
                  Ports  │ Database, Repositories,       │
                         │ ClipboardPort, FilePickerPort,│
                         │ ZipCodecPort, KeyValueStore,  │
                         │ Clock, IdGenerator, Timer     │
                         └─────────────┬────────────────┘
                                       │  implemented by ▲
                         ┌─────────────▼────────────────┐
                  Domain │ Entities (Sticker, Pack),     │
                 (inner) │ Selections, Sort, Search,     │
                         │ Naming (collision, complete), │
                         │ Values (mime, modeName, …)    │
                         └──────────────────────────────┘

       Infra (sibling of Ports, implements them):
       IdbDatabase, IdbRepos, NavigatorClipboard, JsZipCodec,
       LocalStorageKeyValueStore, DomFilePicker, SystemClock,
       CryptoIdGenerator, SystemTimer
```

**Inner layers never import outer layers.** The whole tree is held together
by Liskov substitutability: every port interface is implemented twice (real
infra adapter + test fake), and the Application layer is byte-identical
under either.

## A.2 The file tree (annotated)

```
src/
├── domain/                          ← inner: pure, no browser/React
│   ├── entities/
│   │   ├── sticker.ts               · Sticker type + createSticker factory
│   │   └── pack.ts                  · Pack type + createPack factory
│   ├── values/
│   │   ├── mime.ts                  · SupportedMime union + extension map
│   │   ├── modeName.ts              · ModeName union (9 modes)
│   │   └── favouriteTag.ts          · FAVOURITE_TAG = 'favourite'
│   ├── selection/
│   │   └── sidebarSelection.ts      · All/Pack/Ungrouped (LSP-substitutable)
│   ├── sort/
│   │   └── stickerSort.ts           · RecentSort/AddedSort/NameSort
│   ├── search/
│   │   └── searchPredicate.ts       · buildSearchPredicate(query)
│   └── naming/
│       ├── resolveNameCollision.ts  · per-pack collision suffix
│       └── completeToken.ts         · Tab autocomplete helper
│
├── app/
│   ├── ports/                       ← interfaces only
│   │   ├── database.ts              · Database, Repository, TxScope
│   │   ├── clipboardPort.ts         · ClipboardPort.write
│   │   ├── filePickerPort.ts        · pickImages / pickZip
│   │   ├── zipCodecPort.ts          · pack/unpack + ExportManifest schema
│   │   ├── keyValueStore.ts         · sync get/set
│   │   ├── clock.ts                 · now()
│   │   ├── idGenerator.ts           · uuid()
│   │   └── timer.ts                 · setTimeout/clearTimeout
│   ├── engine/
│   │   ├── engine.ts                · EngineImpl (store + FSM + service routing)
│   │   ├── engineHandle.ts          · narrow handle exposed to modes
│   │   ├── commandContext.ts        · wider context exposed to commands
│   │   ├── appState.ts              · AppState shape + derived computeVisibleGrid
│   │   ├── intents.ts               · Intent union + EngineInternalChange + reduce()
│   │   └── flash.ts                 · FlashScheduler (Timer-driven 2s clear)
│   ├── modes/                       ← one per ModeName
│   │   ├── mode.ts                  · Mode interface (LSP contract)
│   │   ├── normalMode.ts            · grid + pack nav + action keys
│   │   ├── searchMode.ts            · live /-filter
│   │   ├── commandMode.ts           · :-command palette + Tab autocomplete
│   │   ├── renameMode.ts            · statusline rename input
│   │   ├── tagsMode.ts              · statusline tags input
│   │   ├── packAssignMode.ts        · statusline packs input + Tab autocomplete
│   │   ├── confirmMode.ts           · y/n destructive confirm
│   │   ├── uploadMode.ts            · UPLOAD exclusive mode (modal overlay)
│   │   ├── helpMode.ts              · HELP exclusive mode (modal overlay)
│   │   └── modeRegistry.ts          · ModeName → singleton Mode instance
│   ├── commands/                    ← :command implementations
│   │   ├── command.ts               · Command interface (TOTAL, atomic)
│   │   ├── registry.ts              · trie resolver (longest path wins; E492)
│   │   ├── packCommands.ts          · :pack new/rename/delete/move
│   │   ├── tagCommands.ts           · :tag(s) add/remove/rename/clear
│   │   ├── sortCommands.ts          · :sort recent/added/name
│   │   ├── themeCommands.ts         · :theme dark/light/toggle
│   │   ├── helpCommand.ts           · :help → HELP mode
│   │   └── ioCommands.ts            · :export / :import
│   ├── services/                    ← IDB-touching business logic
│   │   ├── yankService.ts           · clipboard write + download fallback + rename + tags
│   │   ├── packService.ts           · create/rename/delete/move/assignPacks
│   │   ├── tagService.ts            · global :tag rename
│   │   ├── exportService.ts         · build ZIP blob + SPEC filename
│   │   └── importService.ts         · upload save + ZIP import (skip-by-id)
│   └── upload/                      ← upload-source layer (per ARCHITECTURE)
│       ├── stickerCandidate.ts      · interface
│       ├── fileCandidate.ts         · File → candidate (drag/picker)
│       ├── clipboardCandidate.ts    · Blob → candidate (Ctrl+V)
│       ├── uploadQueue.ts           · QueuedSticker type
│       └── mimeCoercion.ts          · APNG → image/png boundary + accept string
│
├── infra/                           ← only place that touches browser globals
│   ├── idb/
│   │   ├── schema.ts                · DB name/version + applySchema
│   │   ├── idbDatabase.ts           · single-tx implementation
│   │   ├── idbStickerRepository.ts  · CRUD on stickers store
│   │   └── idbPackRepository.ts     · CRUD on packs store
│   ├── clipboard/navigatorClipboard.ts   · navigator.clipboard.write
│   ├── files/domFilePicker.ts            · <input type=file> picker
│   ├── zip/jsZipCodec.ts                 · JSZip wrapper
│   ├── kv/localStorageKeyValueStore.ts   · localStorage
│   └── system/
│       ├── systemClock.ts           · Date.now()
│       ├── cryptoIdGenerator.ts     · crypto.randomUUID()
│       └── systemTimer.ts           · globalThis.setTimeout/clearTimeout
│
├── ui/                              ← React components
│   ├── AppRoot.tsx                  · three-region layout
│   ├── useEngine.ts                 · useSyncExternalStore bridge
│   ├── useObjectURLs.ts             · Sticker.data → object URL cache (effect-only)
│   ├── KeyboardCapture.tsx          · document-level keydown → engine.handleKey
│   ├── Sidebar.tsx                  · "PACKS [N]" header + PackRow list
│   ├── PackRow.tsx                  · "> name [count]" / "  name [count]"
│   ├── Grid.tsx                     · grid + empty states + ResizeObserver→gridCols
│   ├── StickerCell.tsx              · 96×96 cell + scale-1.15 hover + tooltip
│   ├── Statusline.tsx               · mode label + input + right/hint
│   ├── overlays/
│   │   ├── UploadModal.tsx          · drop zone + queue rows + ADD ALL
│   │   └── HelpModal.tsx            · two-column read-only keys + commands
│   └── theme/
│       ├── themeVars.css            · 9 SPEC vars + --overlay-bg (per theme)
│       └── styles.ts                · ~30 named shared style constants
│
├── bootstrap/
│   └── composition.ts               · the ONLY place infra is instantiated
├── main.tsx                         · mount AppRoot, initAsync
└── test/
    ├── fakes/                       · in-memory fakes for every port
    └── rebuild.test.ts              · 30 tests over the post-rebuild surface
```

## A.3 The Mode FSM is the spine

The application is, fundamentally, a finite-state machine over 9 modes:

```
              ┌──────┐ /   ┌────────┐
       ┌──────► SEARCH│◄────┤        │
       │      └──────┘     │        │
       │      ┌──────┐ :   │        │
       │      │COMMAND│◄────┤        │
       │      └──────┘     │        │
       │      ┌──────┐ d   │        │
       │      │CONFIRM│◄────┤        │
       │      └──────┘     │ NORMAL │
       │      ┌──────┐ r   │ (start)│
       │      │RENAME│◄────┤        │
       │      └──────┘     │        │
       │      ┌──────┐ t   │        │
       │      │ TAGS │◄────┤        │
       │      └──────┘     │        │
       │      ┌─────────┐m │        │
       │      │PACKASSIGN│◄┤        │
       │      └─────────┘  │        │
       │      ┌──────┐ a   │        │
       │      │UPLOAD│◄────┤        │
       │      └──────┘     │        │
       │      ┌──────┐ ?   │        │
       │      │ HELP │◄────┤        │
       │      └──────┘     └────────┘
       │                     (back via Enter/Esc/y/n/q)
       └──── always reachable ─────────────┘
```

**Exactly one mode is active at all times.** Transitions go through one
function: `engine.transitionTo(name)`, which runs `current.onExit →
set modeName → next.onEnter` with React notifications batched (one
re-render per transition, not three).

Every mode implements one TOTAL interface:

```ts
interface Mode {
  readonly name: ModeName;
  onEnter(engine: Engine): void;                  // idempotent
  handleKey(key: KeyEvent, engine: Engine): void; // TOTAL: unknown key = no-op
  statusline(engine: Engine): StatuslineModel;    // TOTAL: always renderable
  overlay(engine: Engine): OverlayModel | null;   // null except UPLOAD/HELP
  onExit(engine: Engine): void;                   // clears all transient state
}
```

The keydown path is literally `currentMode.handleKey(evt, engine)`. Swap
the active mode and the same keydown does a different thing — that's the
single substitution site for the entire input grammar.

## A.4 Data flow: keystroke → IDB → screen

Concrete example: user presses `r` to rename, types "pepe", presses Enter.

1. **DOM keydown.** Browser fires `keydown` on the document.
2. **`KeyboardCapture`** (in `ui/`) normalizes the DOM event into a
   `KeyEvent` and calls `engine.handleKey(evt)`. In NORMAL mode it
   `preventDefault`s every non-modifier key so browser shortcuts don't fire.
3. **`EngineImpl.handleKey`** routes to `currentMode.handleKey(evt, handle)`.
4. **`NormalMode.handleKey`** sees `r`, checks `state.focusId !== null`
   (empty-grid guard), calls `engine.transitionTo('RENAME')`.
5. **`transitionTo`** batches three steps:
   - `NormalMode.onExit` — clears gg/digit/yy buffers.
   - `applyChange({type:'transitionMode', modeName:'RENAME'})` — reducer
     produces a new `AppState` with `modeName='RENAME'`.
   - `RenameMode.onEnter` — reads focused sticker, calls
     `engine.setStatusInput(focused.name)` which dispatches
     `setStatusInput`, producing a new `AppState` with `statusInput="pepe"`.
   - At end of batch: single `notify()` to all subscribers.
6. **React re-renders.** `useSyncExternalStore` calls `engine.getSnapshot()`,
   sees the new snapshot reference, re-renders.
   - `Statusline` reads `engine.getStatuslineModel()` which calls
     `RenameMode.statusline(handle)` → `{mode:'RENAME', input:'pepe'}`.
   - The user types — each keystroke goes through the same path,
     dispatching `setStatusInput` with the new buffer.
7. **User presses Enter.**
   - `RenameMode.handleKey` reads `engine.getStatusInput()`, dispatches
     `renameFocused`.
   - **`EngineImpl.dispatch`** routes `renameFocused` to
     `handleRenameFocused`, which calls
     `YankService.renameSticker(sticker, "pepe", allStickers)`.
   - **`YankService`** runs `resolveNameCollision` (pure domain), produces
     a new sticker object, then opens ONE IDB tx and writes.
   - On promise resolve: engine dispatches the engine-internal
     `applySticker` change, then `setFlash("renamed: pepe", false)`.
8. **Flash timer.** `FlashScheduler` (via injected Timer) schedules a
   2000ms clearance. Two seconds later it fires `applyChange('clearFlash')`,
   the snapshot updates, React re-renders, the flash disappears.

Every other action follows the same shape: keystroke → mode → intent →
(service →) reducer → notify → React.

## A.5 The Intent contract

`dispatch(intent)` is the only mutation entry point for UI and modes.
There are exactly 22 public intents (`loadAll`, `moveFocus`, `moveFocusDir`,
`setSelection`, `cycleSelection`, `jumpToPack`, `setSort`, `setSearch`,
`setGridCols`, `enqueueCandidates`, `editQueueRow`, `removeQueueRow`,
`saveUpload`, `yankFocused`, `deleteFocused`, `renameFocused`, `setTags`,
`assignPacks`, `toggleFavourite`, `setTheme`, `setStatusInput`,
`transitionMode`, `flash`, `searchNext`, `searchPrev`).

The engine produces 7 **internal** changes that callers cannot dispatch:
`applySticker`, `applyStickers`, `removeSticker`, `applyPack`, `removePack`,
`clearFlash`, `clearUploadQueue`. Services resolve, the engine applies the
internal change, no external code can bypass the timing rules.

## A.6 The port/adapter seam (LSP)

Every IDB-touching service depends on `app/ports/` interfaces only. The
real adapters live in `infra/`; the fakes live in `test/fakes/`.
Composition root (`bootstrap/composition.ts`) is the single point that
constructs adapters and wires them into the engine.

```ts
// composition.ts — to run tests against fakes, flip ONE line per port:
const db: Database = new IdbDatabase();        // → new FakeDatabase()
const stickers   = new IdbStickerRepository(); // → new FakeStickerRepository()
const timer: Timer = new SystemTimer();        // → new FakeTimer()
// …
```

The engine code is byte-identical under either set. That's the substitution
guarantee that makes the test suite trustworthy — a behavior verified
against `FakeDatabase` must hold against `IdbDatabase`.

Three port families exist:

- **Persistence**: `Database`, `StickerRepository`, `PackRepository` —
  single-tx discipline; reads + writes share one IDB transaction.
- **Side-effects**: `ClipboardPort`, `FilePickerPort`, `ZipCodecPort`,
  `Clock`, `IdGenerator`, `Timer`, `KeyValueStore`.
- **Downloader**: a plain closure (`downloadBlob`) created in
  composition.ts and passed to the engine; powers both yank-fallback and
  `:export`.

## A.7 The styling system

The whole visual surface is driven by **two files**, intentionally:

- `ui/theme/themeVars.css` — defines exactly the 9 SPEC CSS variables
  (`--bg`, `--bg-subtle`, `--border`, `--border-focus`, `--text`,
  `--text-dim`, `--text-error`, `--highlight-bg`, `--highlight-border`)
  plus one extension (`--overlay-bg`) per theme. Two themes:
  `.theme-dark` (terminal green on black) and `.theme-light` (GitHub Light).
- `ui/theme/styles.ts` — exports ~30 named JS style constants
  (`SIDEBAR_PANEL_STYLE`, `CELL_STYLE`, `CELL_HOVER_STYLE`,
  `MODAL_BACKDROP_STYLE`, `INPUT_STYLE`, `BUTTON_PRIMARY_STYLE`,
  `TOOLTIP_STYLE`, etc.) plus dimension constants (`SIDEBAR_WIDTH_PX = 180`,
  `CELL_SIZE_PX = 96`, `HOVER_SCALE = 1.15`, `STICKER_NAME_MAX = 12`, …)
  and a `truncate(s, max)` helper.

Every component imports from `styles.ts`. **No component inlines a
hardcoded color, size, or layout dimension.** To change the palette: edit
themeVars.css. To change a cell size, hover scale, or which border the
focused state uses: edit styles.ts. Components don't need touching.

The two files cover:

| Concern | Where to edit |
|---|---|
| Colors | `themeVars.css` (per theme) |
| Theme variable additions | `themeVars.css` (and DECISIONS.md §22 if SPEC-violating) |
| Sizes (180px sidebar, 96px cell, etc.) | `styles.ts` exported constants |
| Hover effect (scale + z-index) | `styles.ts` `CELL_HOVER_STYLE` |
| Tooltip appearance | `styles.ts` `TOOLTIP_STYLE` |
| Modal panel chrome | `styles.ts` `MODAL_*_STYLE` |
| Truncation cutoff | `styles.ts` `STICKER_NAME_MAX` / `PACK_NAME_MAX` |
| Drop-zone over visual | `styles.ts` `DROP_ZONE_OVER_STYLE` |
| Statusline label color | `styles.ts` `STATUS_LABEL_STYLE` |

## A.8 The Mode/Engine relationship in pseudocode

```
EngineImpl {
  state: AppState
  registry: ModeRegistry
  services: Services       // built from injected ports
  timer: Timer             // injected; drives FlashScheduler

  dispatch(intent) {
    routeIntent(intent)       // theme persistence, service calls, flash schedule
    applyChange(intent)       // reducer produces new AppState
  }

  handleKey(evt) {
    registry.get(state.modeName).handleKey(evt, asEngineHandle())
  }

  transitionTo(name) {
    batching = true
    current.onExit(h)
    applyChange({type:'transitionMode', modeName: name})
    next.onEnter(h)
    batching = false
    if dirty: notify()
  }

  // service handlers (async; promises resolve into internal changes)
  handleYankFocused() {
    services.yank.yank(sticker)
      .then(({sticker, downloaded}) => {
        applyChange({type:'applySticker', sticker})
        setFlash(downloaded ? '(no clipboard: downloading)' : `yanked: ${sticker.name}.${ext}`)
      })
      .catch(err => setFlash(`E: ${err.message}`, true))
  }
  // ... etc
}
```

## A.9 Key invariants (and where they live)

| Invariant | Location |
|---|---|
| `Sticker.data` is always `ArrayBuffer`, never `Blob` | DOMAIN.md + Repository.put guards |
| `Pack.id` is always a UUID (no virtual packs in `packs[]`) | DOMAIN.md + createPack factory |
| `(ungrouped)` is a virtual selection, never persisted | `SidebarSelection` split (DOMAIN.md decision) |
| Focus stored by id, not by index (sort-swap safe) | STATE.md Decision E |
| One IDB transaction per service operation | IDB.md + IdbDatabase.tx single-tx impl |
| No foreign awaits inside a tx body | IDB.md + body's synchronous-after-prepareViews contract |
| Flash auto-clears after 2000ms via injected Timer | STATE.md + FlashScheduler |
| Only theme persists across reloads | STATE.md Decision D |
| Mode FSM has exactly one active mode | MODES.md Decision B + transitionTo |
| Browser globals only inside `infra/` | ARCHITECTURE.md + composition root rule |
| No Tailwind hardcoded colors; everything via CSS vars | M11 + themeVars.css + styles.ts |
| Empty-grid silent no-op on action keys | MODES.md NormalMode table |
| Grid focus wraps at row edges | MODES.md NormalMode table + moveFocusDir |

## A.10 Build / run / test

```bash
npm install              # install deps (vitest, jszip, react, vite)
npm run dev              # start dev server on http://localhost:5173
npm run check            # tsc + lint + vite build (must pass before pushing)
npm test                 # vitest run (30 tests)
npm run build            # vite production bundle
```

---

# Part B — Usage guide

Practical "how to drive the app". Everything below WORKS as of the current
build.

## Adding stickers

1. Press **`a`** — opens the upload modal.
2. Get images into the queue (any of):
   - **Drop** PNG/GIF/WebP/APNG files onto the dashed box.
   - **Click** the dashed box → file picker (multi-select).
   - **Ctrl+V** while the modal is open → paste an image from clipboard.
3. For each queued row, edit the **Name** / **Tags** / **Packs**. Tab in
   the Pack field autocompletes against existing pack names.
4. Click **ADD ALL** or press **Enter** → saves to IDB; flashes
   `added: N stickers`; modal closes.
5. **Esc** closes without saving.

## Navigating the grid

| Key | Action |
|---|---|
| `h` / `←` | left |
| `l` / `→` | right |
| `j` / `↓` | down one row |
| `k` / `↑` | up one row |
| `gg` (within 500ms) | first sticker |
| `G` | last sticker |
| `0` | first sticker in current row |
| `$` | last sticker in current row |
| Click a cell | focus it |

Row-edge wrap: `h` at col 0 wraps to the last cell of the previous row;
`l` at the last cell of a row wraps to the first cell of the next row.

## Pack navigation

| Key | Action |
|---|---|
| `p` | next pack (cycles All → packs → Ungrouped → All) |
| `P` | previous pack |
| `[n]p` | jump to nth pack (1-indexed; e.g. `3p` selects 3rd pack) |
| `Tab` / `Ctrl+N` | alias for `p` |
| `Shift+Tab` / `Ctrl+P` | alias for `P` |
| Click sidebar row | select it |

## Actions on focused sticker

| Key | Action | Flash |
|---|---|---|
| `yy` or `Enter` or `y` | yank (copy to clipboard) | `yanked: name.ext` or `(no clipboard: downloading)` |
| `r` | rename (statusline input; Enter saves, Esc cancels) | `renamed: <newname>` |
| `t` | edit tags (comma-separated; Enter saves) | — |
| `m` | assign packs (statusline; Tab autocompletes; Enter saves) | — |
| `d` | delete with confirm prompt (`y` confirms, `n`/`Esc` cancels) | — |
| `f` | toggle the `favourite` tag | `tagged: favourite` / `untagged: favourite` |

Empty-grid silent no-op: when there's no focused sticker, all the keys
above do nothing (no flash, no mode transition).

## Search & command palette

- **`/`** — SEARCH mode. Live filter on name + tags (case-insensitive
  substring). Statusline shows `<matchCount> matches`.
  - `Esc` clears the search and returns to NORMAL.
  - `Enter` keeps the filter active and returns to NORMAL.
- **`n` / `N`** in NORMAL — cycle to next/previous search match (no-op
  unless a search is active).
- **`:`** — COMMAND mode. `Tab` autocompletes the first token. `Enter`
  runs. `Esc` cancels.
- **`?`** — HELP modal (two columns: keys on left, commands on right).
  `q` or `Esc` closes.

## Commands

```
:pack new <name>                  create pack (E: pack "<name>" already exists if duplicate)
:pack rename <name>               rename current pack (requires PackSelection)
:pack delete                      delete current pack; strip its id from all stickers
:pack move <name>                 add focused sticker to pack (create if missing)

:tag add <tag>                    add tag to focused sticker
:tag remove <tag>                 remove tag from focused sticker
:tag rename <old> <new>           global rename across all stickers (atomic, case-sensitive)
:tag clear                        clear all tags on focused sticker
:tags add <tag>                   alias for :tag add (plural also accepted)
:tags remove / rename / clear     plural aliases of all of the above

:sort recent                      sort by lastUsedAt desc (default)
:sort added                       sort by createdAt desc
:sort name                        sort by name asc

:theme dark                       force dark theme
:theme light                      force light theme
:theme toggle                     flip theme

:export                           download stickerdb-export-YYYY-MM-DD.zip
:import                           pick a zip and merge (skip-by-id dedup)

:help                             open HELP modal (same as `?`)
```

Unknown command → `E492: Not an editor command: <input>`.

## Themes

- **Dark** (default): terminal green on black per SPEC.
- **Light**: GitHub Light per SPEC.

Toggle via `:theme toggle` or `Ctrl+T`. Choice persists in localStorage
under key `theme`.

## Persistence reality

- Stickers added via the upload modal **persist** to IDB.
- Edits via `r` / `t` / `m` / `f` **persist**.
- Pack create/rename/delete/move **persist** (via PackService through `:pack` commands).
- `:tag rename` global update is atomic in a single tx.
- `:export` writes nothing to IDB; `:import` writes new stickers/packs (skip-by-id).
- Theme **persists** (localStorage). Sort, selection, search **don't** persist (reload resets).

## Flash messages reference

| Trigger | Flash text |
|---|---|
| Yank success | `yanked: <name>.<ext>` |
| Yank → download fallback | `(no clipboard: downloading)` |
| Rename | `renamed: <newname>` |
| Favourite on/off | `tagged: favourite` / `untagged: favourite` |
| Upload save | `added: N stickers` |
| Import | `imported: N stickers, M packs (K skipped)` |
| Export | `exporting...` then `done: N stickers` |
| Sort | `sort: recent` / `added` / `name` |
| Theme | `theme: dark` / `light` |
| Tag add | `tagged: <tag>` |
| Tag remove | `untagged: <tag>` |
| Tag rename | `renamed tag "old" → "new" (N stickers)` |
| Pack create | `pack "<name>" created` |
| Pack rename | `pack renamed to "<name>"` |
| Pack delete | `pack "<name>" deleted (M stickers updated)` |
| Pack move (existed) | `moved to pack "<name>"` |
| Pack move (created) | `moved to pack "<name>" (created)` |
| Pack move (already in) | `already in pack "<name>"` |
| Unknown command | `E492: Not an editor command: <input>` |
| Service error | `E: <error.message>` |

Every flash auto-clears after 2 seconds. Setting a new flash resets the
timer.

## TL;DR happy path

`a` → drop a few PNGs → `Enter` → navigate with `h`/`l` (or `j`/`k` for
2-D) → `r` to rename → `t` to add tags → `m` to assign packs → `yy` or
`Enter` to yank → `/foo` to filter → `n`/`N` to cycle matches →
`:export` to back up → `?` for help.

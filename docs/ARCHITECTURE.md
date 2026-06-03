# ARCHITECTURE

Authoritative for: directory structure, layer boundaries, import rules, the
composition root, and the LSP macro-decisions that shaped them. Type-level
contracts live in DOMAIN.md, IDB.md, MODES.md, STATE.md — referenced here by name.

## Directory tree

```
src/
  domain/
    entities/
      sticker.ts            # Sticker type, invariants, factory
      pack.ts               # Pack type, invariants, factory
    values/
      mime.ts               # SupportedMime union + extension map (png/gif/webp; apng->png)
      modeName.ts
    selection/
      sidebarSelection.ts   # interface
      allSelection.ts
      packSelection.ts
      ungroupedSelection.ts
    sort/
      stickerSort.ts        # interface
      recentSort.ts  addedSort.ts  nameSort.ts
    search/
      searchPredicate.ts    # buildSearchPredicate(query) => (Sticker)=>boolean
    naming/
      collision.ts          # resolveNameCollision(name, siblings) => uniqueName

  app/
    engine/
      appState.ts           # immutable snapshot shape
      engine.ts             # store: getSnapshot/subscribe/dispatch; owns the Mode FSM
      intents.ts            # intent union + handlers
      flash.ts              # 2s flash scheduling via Clock
    modes/
      mode.ts               # Mode interface
      normalMode.ts ... helpMode.ts
      modeRegistry.ts
    commands/
      command.ts            # Command interface
      registry.ts           # trie resolver + E492
      packCommands.ts tagCommands.ts sortCommands.ts ioCommands.ts themeCommands.ts helpCommand.ts
    upload/
      stickerCandidate.ts   # interface (moved from domain/values)
      fileCandidate.ts      # FileStickerCandidate (from <input> / drag-drop)
      clipboardCandidate.ts # ClipboardStickerCandidate (from Ctrl+V paste)
      uploadQueue.ts        # QueuedSticker type (moved from engine/appState)
    services/
      yankService.ts        # ClipboardPort write + download fallback; updates lastUsedAt
      packService.ts        # create/rename/delete/move w/ collision + single-tx writes
      exportService.ts importService.ts
    ports/
      database.ts stickerRepository.ts packRepository.ts
      clipboardPort.ts filePickerPort.ts zipCodecPort.ts
      keyValueStore.ts clock.ts idGenerator.ts timer.ts

  infra/
    idb/ idbDatabase.ts idbStickerRepository.ts idbPackRepository.ts schema.ts
    clipboard/ navigatorClipboard.ts
    files/ domFilePicker.ts domDownloader.ts (closure in composition.ts)
    zip/ jsZipCodec.ts
    kv/ localStorageKeyValueStore.ts
    system/ systemClock.ts cryptoIdGenerator.ts systemTimer.ts

  ui/
    AppRoot.tsx             # mounts engine; useSyncExternalStore
    useEngine.ts            # hook -> { snapshot, dispatch }
    useObjectURLs.ts        # Sticker[] → object URL cache (effect-driven)
    KeyboardCapture.tsx     # document keydown; preventDefault in NORMAL only
    Sidebar.tsx PackRow.tsx
    Grid.tsx StickerCell.tsx
    Statusline.tsx          # renders StatuslineModel from active mode
    overlays/ UploadModal.tsx HelpModal.tsx
    theme/
      themeVars.css         # .theme-dark / .theme-light CSS custom properties
      styles.ts             # shared inline-style objects (input, cell, modal,
                            #   layout) — single source of truth for repeated
                            #   styling fragments. Component files import
                            #   constants from here rather than inlining.

  bootstrap/
    composition.ts          # the ONLY place infra is instantiated + injected
  main.tsx

  test/
    fakes/ fakeDatabase.ts fakeRepositories.ts fakeClipboard.ts ...
```

## Layer diagram

Dependencies point inward. Inner layers never import outer layers.

```
            ┌─────────────────────────────────────────────┐
   UI       │  React: AppRoot, KeyboardCapture, Sidebar,   │
 (outer)    │  Grid, Statusline, Upload/Help overlays      │
            └───────────────┬─────────────────────────────┘
                            │ reads snapshot / dispatches keys+intents
            ┌───────────────▼─────────────────────────────┐
 Application│  Engine (store + Mode FSM), Commands,         │
            │  Intents, Services (yank/export/import/pack)  │
            └───────────────┬─────────────────────────────┘
                            │ depends on PORT interfaces only
            ┌───────────────▼─────────────────────────────┐
   Ports    │  Database/UnitOfWork, StickerRepository,      │
            │  PackRepository, Clipboard, FilePicker,        │
            │  ZipCodec, KeyValueStore, Clock, IdGenerator   │
            └───────────────┬─────────────────────────────┘
                  implemented by ▲ (Infra), consumed by ▲ (App)
            ┌───────────────▼─────────────────────────────┐
   Domain   │  Entities (Sticker, Pack), Selections, Sort,  │
 (inner)    │  Search, Naming — pure, no browser, no React  │
            └─────────────────────────────────────────────┘

   Infra (sibling of Ports): IdbDatabase, IdbRepositories,
   NavigatorClipboard, JsZipCodec, LocalStorageKeyValueStore,
   SystemClock, CryptoIdGenerator — implement the Port interfaces.
```

## LSP macro-decisions (binding; these shaped the whole tree)

These four decisions are the backbone of the design. Treat them as load-bearing
wherever you touch the relevant layer.

1. **Ports-and-adapters exists *because* of LSP.** All Application code is written
   against the port interfaces in IDB.md, never against infra. The IDB adapter and
   the in-memory test fake are *subtypes* of those ports and must be drop-in
   interchangeable — the engine code is byte-identical under either. A fake that
   weakened any postcondition (e.g. swallowed a missing-key error) would break the
   substitution and is forbidden.

2. **The Mode FSM is a single substitution site.** The keydown path is
   `currentMode.handleKey(evt, engine)`. Correctness must never depend on *which*
   mode is active. This forces the one total `Mode` contract in MODES.md and makes
   it the FSM's spine, not a bolt-on.

3. **The selection axis is split from the entity axis** to avoid the LSP violation
   the spec invites (the `(ungrouped)` virtual pack). The substitutable view type
   `SidebarSelection` (DOMAIN.md) carries only label + count + predicate; mutation
   lives only on the real `Pack` entity. Never reunite them.

4. **Keep every supertype narrow.** Across the codebase: find the behavior that is
   *genuinely* common and make only that the supertype; never widen a base type with
   an operation some subtype cannot honor. Violations show up as `if (x.isSpecial)`
   guards — treat any such guard on a substitutable type as a design defect.

## Module dependency rules

| Module group | MAY import | MUST NOT import |
|---|---|---|
| `domain/**` | other `domain/**` only | `app`, `infra`, `ui`, any browser global |
| `app/ports/**` | `domain/**` (entity types) | `infra`, `app/engine`, `app/modes`, `ui` |
| `app/{engine,modes,commands,services,upload}/**` | `domain/**`, `app/ports/**`, sibling `app/**` modules (engine/commands/services/upload/modes) | `infra/**`, `ui/**`, browser globals, `Date.now()`, `setTimeout`/`clearTimeout` (use `Clock` and `Timer` ports instead) |
| `infra/**` | `domain/**`, `app/ports/**` | `app/{engine,modes,commands,services}`, `ui` |
| `ui/**` | `app` engine surface + `domain/**` types for rendering | `infra/**` directly |
| `bootstrap/composition.ts` | everything (it is the wiring) | — |
| `test/fakes/**` | `domain/**`, `app/ports/**` | `infra/**` |

Browser globals (`indexedDB`, `navigator`, `localStorage`, `crypto`) may be
referenced **only** inside the matching `infra/**` adapter, never elsewhere.

## Composition root contract

`bootstrap/composition.ts` is the *sole* instantiation site for infra adapters:
`IdbDatabase`, `IdbStickerRepository`, `IdbPackRepository`, `NavigatorClipboard`,
`DomFilePicker`, `JsZipCodec`, `LocalStorageKeyValueStore`, `SystemClock`,
`CryptoIdGenerator`. It constructs them, calls `Database.init()`, and injects every
adapter into the engine constructor.

No other module may `new` an adapter or read a browser global. This is the
enforcement mechanism for LSP macro-decision #1: because the engine depends only on
port interfaces, substituting the real infra for `test/fakes/**` is a one-line change
at the root. Any module that reaches for a global bypasses the seam and silently
voids the substitution guarantee — so it is prohibited.

The `composition.ts` adapter constructions are grouped so the one-line-swap claim
holds in practice: a single `const useFakes = false` (or per-port equivalent) flips
each adapter to its fake, no other file changes required.

## Visual constants (SPEC-derived; binding)

These constants are referenced by `ui/theme/themeVars.css` and `ui/theme/styles.ts`.
They are derived from SPEC.md and must not be drifted from without a SPEC change.

| Constant | Value | Used in |
|---|---|---|
| Sidebar width | 180 px | AppRoot layout |
| Statusline height | 28 px | AppRoot layout |
| Sticker cell size | 96 × 96 px | StickerCell, Grid template |
| Sticker thumbnail (upload modal) | 48 × 48 px | UploadModal QueueRow |
| Sticker hover scale | 1.15 | StickerCell |
| Hover z-index | 10 | StickerCell |
| Sticker name truncation | 12 chars + `..` | StickerCell |
| Pack name truncation | 14 chars + `..` | PackRow |
| Sidebar active marker | `> ` (2 chars) | PackRow |
| Sidebar inactive marker | `  ` (2 spaces) | PackRow (alignment) |
| Pack count format | `[<n>]` | Sidebar header, PackRow |
| Flash duration | 2000 ms | engine FlashScheduler |
| `gg` window | 500 ms | NormalMode |
| `[n]p` digit buffer | 1000 ms | NormalMode |
| Drop zone | dashed border, centered `DROP STICKERS HERE` | UploadModal |
| Border | 1 px solid | global (themeVars.css) |
| Border radius | 0 | global (themeVars.css) |
| Font family | JetBrains Mono | global (themeVars.css) |

## CSS variables (binding)

Defined in `ui/theme/themeVars.css`. The SPEC-mandated nine plus one overlay
helper:

| Var | Dark | Light | Used for |
|---|---|---|---|
| `--bg` | `#0a0a0a` | `#ffffff` | window background |
| `--bg-subtle` | `#0d1a0d` | `#f6f8fa` | sidebar, statusline, modal panel |
| `--border` | `#003300` | `#d0d7de` | every visible border |
| `--border-focus` | `#00ff00` | `#0969da` | focused cell, drop zone over |
| `--text` | `#00ff00` | `#24292f` | primary text, mode label |
| `--text-dim` | `#005500` | `#57606a` | secondary text, hints, counts |
| `--text-error` | `#ff0000` | `#cf222e` | flash error text |
| `--highlight-bg` | `#0d1a0d` | `#ddf4ff` | focused sticker background |
| `--highlight-border` | `#00ff00` | `#0969da` | focused sticker border |
| `--overlay-bg` (extension) | `rgba(0,0,0,0.7)` | `rgba(255,255,255,0.7)` | modal backdrop |

No other CSS custom properties are permitted. No Tailwind hardcoded colors.
All component styles read from these vars via `var(--*)`.

## Styling system

The whole visual surface is driven by exactly two files:

- **`ui/theme/themeVars.css`** — the nine SPEC CSS variables plus `--overlay-bg`
  (see CSS variables table above), with `.theme-dark` and `.theme-light` rule sets.
  Terminal green on black for dark; GitHub Light for light. Scrollbars hidden globally
  (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).

- **`ui/theme/styles.ts`** — exports ~30 named JS inline-style constants, dimension
  constants (`SIDEBAR_WIDTH_PX = 180`, `CELL_SIZE_PX = 96`, `HOVER_SCALE = 1.15`,
  `STICKER_NAME_MAX = 12`, `PACK_NAME_MAX = 14`, …), and a `truncate(s, max)`
  helper that produces `"<prefix>.."` at the spec-mandated char count.

Every component imports from `styles.ts` — no component inlines a hardcoded color,
size, or layout dimension.

| To change… | Edit |
|---|---|
| Theme colors | `themeVars.css` (per `.theme-dark` / `.theme-light` block) |
| New CSS variable (must be SPEC-justified) | `themeVars.css` |
| Sizes (sidebar 180px, cell 96px, etc.) | `styles.ts` exported constants |
| Hover effect (scale + z-index) | `styles.ts` `CELL_HOVER_STYLE` |
| Tooltip appearance | `styles.ts` `TOOLTIP_STYLE` |
| Modal panel chrome | `styles.ts` `MODAL_*_STYLE` |
| Truncation cutoff | `styles.ts` `STICKER_NAME_MAX` / `PACK_NAME_MAX` |
| Drop-zone visual | `styles.ts` `DROP_ZONE_STYLE` / `DROP_ZONE_OVER_STYLE` |
| Statusline label style | `styles.ts` `STATUSLINE_LABEL_STYLE` |

## Key invariants

Quick lookup: which invariant is enforced where.

| Invariant | Enforced by |
|---|---|
| `Sticker.data` is always `ArrayBuffer`, never `Blob` | DOMAIN.md + `Repository.put` type + service layer |
| `Pack.id` is always a UUID (no virtual packs in `packs[]`) | DOMAIN.md + `createPack` factory |
| `(ungrouped)` is a virtual selection, never persisted | `SidebarSelection` split (DOMAIN.md) |
| Focus stored by id, not by index (sort-swap safe) | STATE.md Decision E + `AppState.focusId` |
| One IDB transaction per service operation | IDB.md + `IdbDatabase.tx` single-tx impl |
| No foreign awaits inside a tx body | IDB.md transaction discipline |
| Flash auto-clears after 2000ms via injected `Timer` | STATE.md + `FlashScheduler` |
| Only theme persists across reloads | STATE.md Decision D + `LocalStorageKeyValueStore` |
| Mode FSM has exactly one active mode | MODES.md Decision B + `transitionTo` |
| Browser globals only inside `infra/` | Composition root rule (this doc) |
| No hardcoded colors; all via CSS vars | `themeVars.css` + `styles.ts` |
| Empty-grid action keys are silent no-ops | MODES.md NormalMode keybinding table |
| Grid focus wraps at row edges | MODES.md NormalMode + `moveFocusDir` reducer |
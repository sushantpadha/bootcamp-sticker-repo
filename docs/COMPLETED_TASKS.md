# TASKS

Ordered build milestones for sequential execution. Each task names what to build,
the files to touch, and an acceptance condition. Contracts are defined in
ARCHITECTURE.md, STATE.md, IDB.md, MODES.md, DOMAIN.md — referenced by name.

## Global ordering gates (do not violate)

- **G1.** No UI task (M11+) starts until the IDB layer (M2–M3) and the AppState shape
  (M4) are complete.
- **G2.** No mode task (M6+) starts until the Mode interface and the engine shell
  (M5) exist.
- Build strictly in numeric order; a task's acceptance must pass before the next.

## M1 — Domain entities & values
Build the pure entity types, the SupportedMime value, and extension map.
Files: `src/domain/entities/sticker.ts`, `src/domain/entities/pack.ts`,
`src/domain/values/mime.ts`, `src/domain/values/modeName.ts`.
Acceptance: types compile; `Sticker.data` is `ArrayBuffer`; mime + extension map per
DOMAIN.md (decision G). No browser or React imports anywhere under `domain/`.

## M2 — Ports (interfaces only)
Declare every port interface; no implementations.
Files: everything under `src/app/ports/`.
Acceptance: `Database`, `Repository`/`StickerRepository`/`PackRepository`,
`ClipboardPort`, `FilePickerPort`, `ZipCodecPort`, `KeyValueStore`, `Clock`,
`IdGenerator`, and `StoreName` match IDB.md verbatim, including the `tx`-body and
uniform-error-surface annotations. Ports import only `domain/`.

## M3 — Infra fakes
Implement in-memory fakes for all ports. Purpose: enable the composition root
to swap real infra for fakes in one line, proving LSP substitutability.
Files: src/test/fakes/fakeDatabase.ts, fakeRepositories.ts, fakeClipboard.ts,
plus fakes for remaining ports.
Acceptance: fakes honor the same throw conditions and ArrayBuffer storage
discipline as the real adapters (IDB.md). No test runner required. Fakes
import only domain/ and app/ports/.

## M4 — Engine shell + AppState + intents + flash
Define the AppState snapshot, the React-facing `EngineStore`
(getSnapshot/subscribe/dispatch), the `Intent` union with handlers, derived-value
computation, and flash scheduling.
Files: `src/app/engine/appState.ts`, `engine.ts`, `intents.ts`, `flash.ts`.
Acceptance: matches STATE.md — snapshot fields and `QueuedSticker`; only `theme`
persists (decision D); focus stored by id (decision E); `getSnapshot` returns a
stable reference until mutation; derived grid/counts are computed, never stored;
flash replaces+resets a single 2s timer and is orthogonal to mode transitions.
Engine injects ports via constructor (no globals). UI not started yet (G1).

## M5 — Mode FSM + NormalMode
Build the Mode interface, the mode-facing engine handle, `transitionTo`, the
keydown router, the mode registry, and NormalMode (grid + pack navigation, sticker
action keys that dispatch intents).
Files: `src/app/modes/mode.ts`, `modeRegistry.ts`, `normalMode.ts`; extend
`src/app/engine/engine.ts` with `transitionTo` + keydown routing.
Acceptance: `Mode` matches MODES.md verbatim with LSP annotations; `transitionTo`
runs onExit→set modeName→onEnter atomically (decision B, single-active invariant);
`handleKey` is total (unknown keys are no-ops, never throw); NormalMode's gg/[n]p
buffers are mode-internal and time-bounded (decision H). Keydown path is literally
`currentMode.handleKey(evt, engine)`.

## M6 — Remaining modes
Build SEARCH, COMMAND, CONFIRM, RENAME, TAGS, PACKASSIGN, UPLOAD, HELP.
Files: the corresponding `src/app/modes/*.ts`.
Acceptance: each conforms to the Mode contract and the MODES.md enter/exit table;
they use the single engine-owned `statusInput` and clear it on exit (decision I);
UPLOAD/HELP are exclusive modes whose modal UI is `overlay()` output only. Each
`statusline()` returns the MODES.md model for its mode (decision C).

## M7 — Command registry + commands
Build the Command interface, the trie resolver (E492 on miss), and all commands.
Files: `src/app/commands/command.ts`, `registry.ts`, `packCommands.ts`,
`tagCommands.ts`, `sortCommands.ts`, `ioCommands.ts`, `themeCommands.ts`,
`helpCommand.ts`.
Acceptance: `Command`/`CommandOutcome` match DOMAIN.md; every command is total
(returns Ok|Err, never throws) and atomic (no half-applied state on failure);
pack rename/delete fail with `E: no pack selected` unless the active selection is a
`PackSelection`; unknown input flashes `E492: Not an editor command: <input>`.

## M8 — Services
Build yank (clipboard write + download fallback, updates lastUsedAt), pack
create/rename/delete/move (collision + single-tx writes), export, import.
Files: `src/app/services/yankService.ts`, `packService.ts`, `exportService.ts`,
`importService.ts`.
Acceptance: all foreign async (arrayBuffer, zip parse) runs before opening a tx, then
one tx per operation (IDB.md transaction rule); ArrayBuffer↔Blob conversions occur in
the service layer per IDB.md boundary; naming uses DOMAIN.md decision-F scoping;
failures surface as `E: <message>` flashes (decision J). Verified against M3 fakes.

## M9 — Real infra adapters
Implement the IDB schema and all real adapters.
Files: everything under `src/infra/` (`idb/idbDatabase.ts`, `idbStickerRepository.ts`,
`idbPackRepository.ts`, `schema.ts`, `clipboard/`, `files/`, `zip/`, `kv/`,
`system/`).
Acceptance: schema matches IDB.md (DB `stickerdb` v1; stores + indexes incl.
`packIds` multiEntry; `navigator.storage.persist()` on init); each adapter passes the
same port contract-test suite the fakes passed (LSP substitutability proven). Browser
globals appear only inside these adapters.

## M10 — Substitutability checkpoint
In bootstrap/composition.ts, swap real adapters for fakes and confirm the
app boots and core flows work (add a sticker, yank, pack assign). Then swap
back. No automated suite needed — the point is proving the engine code is
unchanged under either set of adapters.
Acceptance: the swap is a one-line change at the composition root and nothing
else needs touching. If it isn't, find the module that leaked a concrete
dependency and fix it before M11.

## M11 — Theme CSS
Add the dark/light custom-property sets and global typography.
Files: `src/ui/theme/themeVars.css`.
Acceptance: `.theme-dark` / `.theme-light` define all `--*` vars from the original
palette; JetBrains Mono global; no Tailwind hardcoded colors (all via `var(--*)`);
1px solid borders, no rounded corners.

## M12 — UI layout + keyboard capture + theme wiring (gate G1 satisfied)
Build AppRoot, the useSyncExternalStore hook, the three-region layout, and
document-level keyboard capture.
Files: `src/ui/AppRoot.tsx`, `useEngine.ts`, `KeyboardCapture.tsx`.
Acceptance: layout is sidebar(180px)/grid/statusline(28px), no page scroll,
scrollbars hidden but scrollable; `useEngine` reads via `useSyncExternalStore`
(decision A); KeyboardCapture normalizes DOM events to `KeyEvent` (MODES.md) and
forwards to the engine, with `preventDefault` for NORMAL keys. No infra imported in UI.

## M13 — Grid + Sidebar
Build the grid cells and the pack sidebar from derived state.
Files: `src/ui/Grid.tsx`, `StickerCell.tsx`, `Sidebar.tsx`, `PackRow.tsx`.
Acceptance: grid renders the derived visible list (STATE.md), 96×96 contain, name
truncation, focus/hover styling, GIF/APNG via `<img>`; sidebar shows All + packs +
`(ungrouped)` from `SidebarSelection` implementations with derived counts; no derived
value is held in component state.

## M14 — Statusline
Render the active mode's StatuslineModel, including flash override.
Files: `src/ui/Statusline.tsx`.
Acceptance: renders left/input/hint/right per MODES.md decision-C table; flash
overrides the left label only, errors in `var(--text-error)`; reverts when the flash
timer clears (STATE.md).

## M15 — Upload modal
Build the upload overlay with drop zone, picker, Ctrl+V, editable queue rows.
Files: `src/ui/overlays/UploadModal.tsx`.
Acceptance: renders only as UPLOAD mode's overlay; rows bind to `uploadQueue`
(STATE.md) and produce `StickerCandidate`s (DOMAIN.md); save dispatches the upload
intent which resolves all bytes before a single tx (IDB.md); thumbnails revoked on
close (MODES.md UPLOAD exit).

## M16 — Help modal
Build the read-only help overlay.
Files: `src/ui/overlays/HelpModal.tsx`.
Acceptance: renders only as HELP mode's overlay; two-column keys/commands, themed via
CSS vars; `q`/`Esc` close via the mode's handleKey.

## M17 — Composition root + wiring
Instantiate all real adapters and inject them into the engine; mount the app.
Files: `src/bootstrap/composition.ts`, `src/main.tsx`.
Acceptance: composition.ts is the only module that constructs infra or reads a
browser global (ARCHITECTURE.md composition-root contract); `Database.init()` runs at
startup; swapping infra for M3 fakes is a one-line change here.
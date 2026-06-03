# MODES

Authoritative for: the Mode FSM contract, the mode-facing engine handle, the
single-active-mode invariant, per-mode enter/exit behavior, the input buffer, and
the statusline model. State shape is in STATE.md; intents are catalogued there.

## ModeName and KeyEvent

```
type ModeName =
  | 'NORMAL' | 'SEARCH' | 'COMMAND' | 'CONFIRM' | 'RENAME'
  | 'TAGS' | 'PACKASSIGN' | 'UPLOAD' | 'HELP';

interface KeyEvent {                 // normalized by ui/KeyboardCapture from DOM
  key: string;                       // e.g. 'h', 'Enter', 'Escape', 'g'
  ctrl: boolean; shift: boolean; alt: boolean; meta: boolean;
  preventDefault(): void;
}
```

The mode-facing `Engine` handle passed to modes exposes: read access to the current
`AppState` (STATE.md), `dispatch(intent)` (intent catalog in STATE.md),
`transitionTo(name)`, `setFlash(text, isError)`, and `getStatusInput()` /
`setStatusInput(s)`.

## Mode interface (verbatim, with LSP annotations)
```
interface Mode {
  readonly name: ModeName;                       // stable identity

  onEnter(engine: Engine): void;                 // [LSP] idempotent; must not assume
                                                  //       any particular prior mode
  handleKey(key: KeyEvent, engine: Engine): void;// [LSP] TOTAL: accepts ANY KeyEvent,
                                                  //       never throws; unknown key = no-op
                                                  //       (preconditions never strengthened)
  statusline(engine: Engine): StatuslineModel;   // [LSP] TOTAL: always returns a
                                                  //       renderable model, never throws
  overlay(engine: Engine): OverlayModel | null;  // null for non-overlay modes
  onExit(engine: Engine): void;                  // [LSP] releases ALL transient buffers,
                                                  //       restores focus invariants
}
```

Substitution obligations every concrete mode MUST uphold:
- **Total input.** No mode may demand a narrower key domain; non-meaningful keys are
  silently dropped, never errors. (No precondition strengthening.)
- **Total output.** `statusline()` and `overlay()` always succeed. (No postcondition
  weakening.)
- **Single-active invariant.** A mode changes state only via `engine.transitionTo`;
  it never mutates another mode or assumes which mode comes next.
- **History constraint.** The state a mode leaves on `onExit` must be valid input for
  *any* successor mode (e.g. focus-by-id invariant intact, statusInput cleared).

The engine keydown path is exactly `currentMode.handleKey(evt, engine)` — swapping
in any conforming Mode is correct by construction.

## Decision B — single-active-mode invariant

Exactly one mode is active at all times. `engine.transitionTo(next)` is the only way
to change it and runs atomically: `current.onExit(engine)` → set `modeName` →
`next.onEnter(engine)`. The three steps run with subscriber notifications batched
so React observers see exactly one snapshot after the transition (not three
intermediates).

`UPLOAD` and `HELP` are **exclusive modes**, not overlays on
NORMAL; their modal UI is merely their `overlay()` output. Because `handleKey` routes
only to the active mode, underlying NORMAL keybindings are inert while UPLOAD/HELP are
active. In NORMAL, `handleKey` calls `preventDefault()` on every non-modifier key so
no browser shortcut fires. **In every other mode**, `preventDefault()` is called
only for `Enter`, `Tab`, and `Escape` — so browser shortcuts (Ctrl+R, F12, etc.)
remain usable while typing in input modes.

## Decision I — engine-owned input buffer

There is a single `statusInput` string owned by the engine (STATE.md). The input
modes (SEARCH, COMMAND, RENAME, TAGS, PACKASSIGN) read and write it via
`get/setStatusInput`. Every `onExit` clears it to `""`, guaranteeing no input mode
ever inherits a stale buffer. NORMAL does not use it. UPLOAD does not use it — the
upload modal is the only place inputs live outside the statusline, and those are
DOM inputs bound to `uploadQueue` rows.

## Decision H — NormalMode internal buffers

NormalMode's `gg` detection, the `[n]p` digit accumulator, and any key-sequence
buffer are **internal to NormalMode**, time-bounded (gg within 500ms; digit buffer
clears after 1s) via the `Timer` port (NOT raw `setTimeout`), and reset in `onExit`.
They are not part of the Mode contract and not part of AppState (STATE.md).

NO other mode is permitted to hold mode-internal state beyond what the per-mode
enter/exit table below sanctions. In particular, SearchMode does NOT remember
its pre-enter search value — Esc clears `state.search` to `""` per SPEC.
ConfirmMode's `pending` action ref is sanctioned by the per-mode table.

## NormalMode keybindings (binding; SPEC-mirror with aliases)

| Key | Action |
|---|---|
| `h` / `←` | move focus left |
| `l` / `→` | move focus right |
| `j` / `↓` | move focus down one row (uses `state.gridCols`) |
| `k` / `↑` | move focus up one row (uses `state.gridCols`) |
| `gg` (within 500ms) | jump to first sticker |
| `G` | jump to last sticker |
| `0` | first sticker in current row |
| `$` | last sticker in current row |
| `p` | next pack (cycle: All → packs → Favourites → Ungrouped → All) |
| `P` | previous pack |
| `[n]p` | jump to nth pack (1-indexed; index 1 = first user pack; digit buffer clears after 1s; out-of-range clamps to last) |
| `Tab` / `Ctrl+N` | alias for `p` |
| `Shift+Tab` / `Ctrl+P` | alias for `P` |
| `Enter` / `yy` | yank focused sticker |
| `f` | toggle `favourite` tag on focused sticker |
| `a` | enter UPLOAD mode |
| `d` | enter CONFIRM (delete focused) |
| `r` | enter RENAME (focused) |
| `t` | enter TAGS (focused) |
| `m` | enter PACKASSIGN (focused) |
| `/` | enter SEARCH |
| `n` | next search match (wraps; no-op if `state.search === ""`) |
| `N` | previous search match (wraps; no-op if `state.search === ""`) |
| `:` | enter COMMAND |
| `?` | enter HELP |
| `Ctrl+T` | toggle theme |

**Extensions beyond SPEC (intentional; documented here as canonical):**

| Key | Action |
|---|---|
| `Space` | open preview overlay for focused sticker (focusId must be non-null; dispatches `setPreviewOpen`) |
| `Ctrl+=` | zoom in — increase `cellZoom` by 16 px (clamps at 192) |
| `Ctrl+-` | zoom out — decrease `cellZoom` by 16 px (clamps at 64) |

**Edge cases the keybinding layer must honor:**
- Row-edge wrap: `h` at col 0 wraps to last col of previous row; `l` at last
  col wraps to first col of next row. (Vertical edges clamp normally.)
- Empty-grid silent no-op: when `state.focusId === null`, keys `d`, `r`, `t`,
  `m`, `f`, `yy`, `Enter` are no-ops (no flash, no transition).
- `0` alone is the row-start jump (not the digit accumulator); a leading `0`
  with no prior non-zero digit must be treated as the row-start command.

## Per-mode enter/exit behavior

| Mode | onEnter prefills / sets | onExit clears |
|---|---|---|
| NORMAL | nothing | internal gg/[n]p/digit buffers |
| SEARCH | statusInput ← current `search` | statusInput |
| COMMAND | statusInput ← `""` | statusInput |
| CONFIRM | captures pending destructive action; builds hint | pending action ref |
| RENAME | statusInput ← focused sticker name | statusInput |
| TAGS | statusInput ← focused tags joined `", "` | statusInput |
| PACKASSIGN | statusInput ← focused sticker's pack names joined `", "` | statusInput |
| UPLOAD | ensures `uploadQueue` is initialized (may be empty) | clears `uploadQueue`, revokes thumbnail object URLs |
| HELP | nothing | nothing |

## Decision C — StatuslineModel and per-mode content

The spec's statusline format table was truncated; this is the canonical model.

```
interface StatuslineModel {
  mode: ModeName;          // left-most label, uppercased
  input?: string;          // SEARCH/COMMAND/RENAME/TAGS/PACKASSIGN
  hint?: string;           // e.g. confirm prompt
  right?: string;          // contextual right-aligned info
}
```

| Mode | left | input | right |
|---|---|---|---|
| NORMAL | `NORMAL` | — | `<sort> · <selection label> · [focusIndex+1/total]` |
| SEARCH | `SEARCH` | `/query` (live) | `<matchCount> matches` |
| COMMAND | `COMMAND` | `:buffer` (tab-completes 1st token) | — |
| CONFIRM | `CONFIRM` | — | `delete "name"? [y/n]` |
| RENAME | `RENAME` | prefilled name | — |
| TAGS | `TAGS` | prefilled `tag1, tag2` | — |
| PACKASSIGN | `PACKASSIGN` | prefilled pack names (tab-completes token) | — |
| UPLOAD | `UPLOAD` | — | `<queue length> queued` |
| HELP | `HELP` | — | `q/Esc to close` |

Flash interaction (timing owned by STATE.md): while a flash is live it overrides the
`left` label only; `input`/`right` still come from the active mode. Errors render in
`var(--text-error)`.

## Modal Overlays

Some features render a full-screen overlay without entering a new mode. They are NOT
modes (no `Mode` contract, no `transitionTo` call, no `onEnter`/`onExit` lifecycle).
They intercept keyboard input via an early return inside `NormalMode.handleKey` before
any normal keybinding is processed. The flag driving each overlay lives in `AppState`
and is ephemeral (not persisted, resets on reload).

### Preview Overlay (`previewOpen: boolean`)

**Open:** `Space` in NORMAL when `focusId` is non-null (dispatches
`{ type: 'setPreviewOpen', open: true }`).

**Close:** `Escape` or `Space` (both dispatch `{ type: 'setPreviewOpen', open: false }`);
clicking the backdrop also closes.

**Content** (rendered by `ui/overlays/PreviewModal.tsx`):
- Full-size sticker image (max 512×512, `object-fit: contain`)
- Sticker name (bold, 20 px)
- Tags line (if sticker has any tags)
- Packs line (if sticker belongs to any packs)
- Hint: `esc / space to close`

**Key capture:** while `state.previewOpen === true`, NormalMode's `handleKey` returns
immediately after dispatching the close intent for `Escape`/`Space`, consuming all
other keys silently. No UPLOAD/HELP/CONFIRM transitions can be triggered while the
overlay is open.
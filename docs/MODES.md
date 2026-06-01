# MODES

Authoritative for: the Mode FSM contract, the mode-facing engine handle, the
single-active-mode invariant, per-mode enter/exit behavior, the input buffer, and
the statusline model. State shape is in STATE.md; intents are catalogued there.

## ModeName and KeyEvent

type ModeName =
  | 'NORMAL' | 'SEARCH' | 'COMMAND' | 'CONFIRM' | 'RENAME'
  | 'TAGS' | 'PACKASSIGN' | 'UPLOAD' | 'HELP';

interface KeyEvent {                 // normalized by ui/KeyboardCapture from DOM
  key: string;                       // e.g. 'h', 'Enter', 'Escape', 'g'
  ctrl: boolean; shift: boolean; alt: boolean; meta: boolean;
  preventDefault(): void;
}

The mode-facing `Engine` handle passed to modes exposes: read access to the current
`AppState` (STATE.md), `dispatch(intent)` (intent catalog in STATE.md),
`transitionTo(name)`, `setFlash(text, isError)`, and `getStatusInput()` /
`setStatusInput(s)`.

## Mode interface (verbatim, with LSP annotations)

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
`next.onEnter(engine)`. `UPLOAD` and `HELP` are **exclusive modes**, not overlays on
NORMAL; their modal UI is merely their `overlay()` output. Because `handleKey` routes
only to the active mode, underlying NORMAL keybindings are inert while UPLOAD/HELP are
active. In NORMAL, `handleKey` calls `preventDefault()` on every non-modifier key so
no browser shortcut fires.

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
clears after 1s), and reset in `onExit`. They are not part of the Mode contract and
not part of AppState (STATE.md).

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

interface StatuslineModel {
  mode: ModeName;          // left-most label, uppercased
  input?: string;          // SEARCH/COMMAND/RENAME/TAGS/PACKASSIGN
  hint?: string;           // e.g. confirm prompt
  right?: string;          // contextual right-aligned info
}

| Mode | left | input | right |
|---|---|---|---|
| NORMAL | `NORMAL` | — | `<sort> · <selection label> · [focusIndex+1/total]` |
| SEARCH | `SEARCH` | `/query` (live) | `<matchCount> matches` |
| COMMAND | `COMMAND` | `:buffer` (tab-completes 1st token) | — |
| CONFIRM | `CONFIRM` | — | hint: `delete "name"? [y/n]` |
| RENAME | `RENAME` | prefilled name | — |
| TAGS | `TAGS` | prefilled `tag1, tag2` | — |
| PACKASSIGN | `PACKASSIGN` | prefilled pack names (tab-completes token) | — |
| UPLOAD | `UPLOAD` | — | `<queue length> queued` |
| HELP | `HELP` | — | `q/Esc to close` |

Flash interaction (timing owned by STATE.md): while a flash is live it overrides the
`left` label only; `input`/`right` still come from the active mode. Errors render in
`var(--text-error)`.
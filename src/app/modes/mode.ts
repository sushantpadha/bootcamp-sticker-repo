import type { ModeName } from '../../domain/values/modeName';
import type { Engine } from '../engine/engineHandle';

// ── KeyEvent ──────────────────────────────────────────────────────────────────
// Normalized keyboard event produced by ui/KeyboardCapture from a DOM keydown.
// Modes receive this shape; they never see the raw DOM event.
export interface KeyEvent {
  key: string;        // e.g. 'h', 'Enter', 'Escape', 'ArrowLeft', 'G'
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  preventDefault(): void;
}

// ── StatuslineModel ───────────────────────────────────────────────────────────
// Per-mode statusline content (MODES.md §Decision C).
// Flash overrides `mode` (the left label) externally; `input` and `right` are
// always sourced from the active mode — the Statusline renderer merges them.
export interface StatuslineModel {
  mode: ModeName;     // left-most label, uppercased by the renderer
  input?: string;     // SEARCH / COMMAND / RENAME / TAGS / PACKASSIGN
  hint?: string;      // CONFIRM prompt
  right?: string;     // NORMAL: sort · selection · [n/total]
}

// ── OverlayModel ──────────────────────────────────────────────────────────────
// Opaque descriptor returned by Mode.overlay(). UI layers (M15, M16) switch on
// `type` to choose the correct modal component. null means no overlay.
export interface OverlayModel {
  type: string;
}

// ── Mode interface (MODES.md §Mode interface, verbatim with LSP annotations) ──
//
// LSP substitution obligations every concrete mode MUST satisfy:
//
//   Total input  — no mode may narrow the key domain; non-meaningful keys are
//                  silently dropped, never errors. (No precondition strengthening.)
//
//   Total output — statusline() and overlay() always succeed. (No postcondition
//                  weakening.)
//
//   Single-active invariant — a mode changes state only via engine.transitionTo;
//                  it never mutates another mode or assumes which mode comes next.
//
//   History constraint — the state a mode leaves in onExit must be valid input
//                  for *any* successor mode (focus-by-id invariant intact,
//                  statusInput cleared).
export interface Mode {
  // Stable identity — used by the engine FSM to set AppState.modeName.
  readonly name: ModeName;

  // [LSP] Idempotent; must not assume any particular prior mode.
  onEnter(engine: Engine): void;

  // [LSP] TOTAL: accepts ANY KeyEvent, never throws; unknown key = no-op.
  //             Preconditions must never be strengthened beyond KeyEvent's shape.
  handleKey(key: KeyEvent, engine: Engine): void;

  // [LSP] TOTAL: always returns a renderable StatuslineModel, never throws.
  statusline(engine: Engine): StatuslineModel;

  // null for non-overlay modes (NORMAL, SEARCH, COMMAND, CONFIRM, RENAME,
  // TAGS, PACKASSIGN). UPLOAD and HELP return a non-null OverlayModel.
  overlay(engine: Engine): OverlayModel | null;

  // [LSP] Releases ALL transient buffers and restores focus invariants.
  //       Must clear statusInput so no successor inherits a stale buffer
  //       (MODES.md §Decision I).
  onExit(engine: Engine): void;
}

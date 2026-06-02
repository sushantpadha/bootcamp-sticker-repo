import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

// ── ConfirmMode ────────────────────────────────────────────────────────────────
//
// Destructive-action confirmation dialog (currently: delete focused sticker).
//
// The pending action is captured as internal state on onEnter and cleared on
// onExit (MODES.md per-mode enter/exit table, CLAUDE.md M6 constraint).
// It is never stored in AppState — the mode owns it.
//
// enter/exit table (MODES.md):
//   onEnter  — captures pending destructive action; builds hint
//   onExit   — clears pending action ref
//
// Key bindings:
//   y / Y    — execute pending action, transition to NORMAL
//   n / N    — cancel, transition to NORMAL
//   Escape   — cancel, transition to NORMAL

type PendingAction = { kind: 'delete'; stickerName: string };

export class ConfirmMode implements Mode {
  readonly name = 'CONFIRM' as const;

  // Mode-internal; NOT part of AppState (MODES.md enter/exit table).
  private pending: PendingAction | null = null;

  // [LSP] Idempotent; captures the focused sticker as the pending delete target.
  // If there is no focused sticker, pending stays null and hint shows a generic prompt.
  onEnter(engine: Engine): void {
    const state = engine.getSnapshot();
    const focused = state.stickers.find(s => s.id === state.focusId);
    this.pending = focused
      ? { kind: 'delete', stickerName: focused.name }
      : null;
  }

  // [LSP] TOTAL: accepts any KeyEvent; unknown keys are silent no-ops.
  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    evt.preventDefault();

    if (key === 'y' || key === 'Y') {
      if (this.pending !== null) {
        engine.dispatch({ type: 'deleteFocused' });
      }
      engine.transitionTo('NORMAL');
      return;
    }
    if (key === 'n' || key === 'N' || key === 'Escape') {
      engine.transitionTo('NORMAL');
      return;
    }
    // other keys: no-op (total input contract)
  }

  // [LSP] TOTAL: always returns a renderable model (MODES.md §Decision C).
  // The hint appears on the right of the statusline: delete "name"? [y/n]
  statusline(_engine: Engine): StatuslineModel {
    const hint = this.pending !== null
      ? `delete "${this.pending.stickerName}"? [y/n]`
      : '[y/n]';
    return { mode: 'CONFIRM', hint };
  }

  // CONFIRM has no overlay.
  overlay(_engine: Engine): OverlayModel | null {
    return null;
  }

  // [LSP] Clears the pending action ref so no successor mode inherits it.
  onExit(_engine: Engine): void {
    this.pending = null;
  }
}

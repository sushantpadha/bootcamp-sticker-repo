import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

// ── HelpMode ───────────────────────────────────────────────────────────────────
//
// EXCLUSIVE mode (MODES.md §Decision B): HELP is not an overlay bolted onto
// NORMAL. It is its own active mode. The modal UI is the `overlay()` output only
// (rendered by M16: HelpModal). While HELP is active, NORMAL keybindings are
// completely inert — only HelpMode.handleKey sees events.
//
// enter/exit table (MODES.md):
//   onEnter  — nothing
//   onExit   — nothing
//
// Key bindings:
//   q / Escape  — transition to NORMAL (close help)
export class HelpMode implements Mode {
  readonly name = 'HELP' as const;

  // [LSP] Idempotent; nothing to prefill.
  onEnter(_engine: Engine): void {}

  // [LSP] TOTAL: accepts any KeyEvent; unknown keys are silent no-ops.
  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    evt.preventDefault();

    if (key === 'q' || key === 'Escape') {
      engine.transitionTo('NORMAL');
      return;
    }
    // unknown key: no-op (total input contract)
  }

  // [LSP] TOTAL: always returns a renderable model (MODES.md §Decision C).
  // Format: HELP | — | q/Esc to close
  statusline(_engine: Engine): StatuslineModel {
    return { mode: 'HELP', right: 'q/Esc to close' };
  }

  // HELP is an exclusive mode; its modal content comes from overlay() only.
  overlay(_engine: Engine): OverlayModel {
    return { type: 'HELP' };
  }

  // [LSP] Nothing to clear.
  onExit(_engine: Engine): void {}
}
